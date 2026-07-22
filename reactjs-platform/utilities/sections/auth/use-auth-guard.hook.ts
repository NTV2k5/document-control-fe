'use client';

import { useAuth } from 'reactjs-platform/utilities/hooks';
import {
  canAccessDashboard,
  canAccessDocuments,
  canAccessTechRoot,
  canAccessTemplates,
  canManageUsers,
} from 'reactjs-platform/utilities/utils/access-control.utils';
import { profileStore } from 'reactjs-platform/utilities/store/store-user-profile/user-profile.store';
import { CoreUserProfileStore } from 'reactjs-platform/utilities';
import { useRouter, useLocation } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface UseAuthGuardOptions {
  publicRoutes?: string[];
  locale?: string;
  groupPriority?: string[];
  groupAreaMap?: Record<string, string>;
  groupAccessMap?: Record<string, string[]>;
}

/**
 * Derive the user's group keys from user_type stored in the profile.
 *
 * user_type mapping (matches auth.config.ts groupAccessMap keys):
 *   2  → ['/admin']          ADMIN — can access everything including /admin
 *   1  → ['/templates']      USER  — regular user
 *   *  → ['/templates']      fallback
 */
function groupsFromProfile(profile: ReturnType<typeof profileStore.getState>['profile']): string[] {
  if (!profile) return ['/viewer'];

  const groups: string[] = [];
  if (canManageUsers(profile)) {
    groups.push('/admin');
  }
  if (canAccessTechRoot(profile)) {
    groups.push('/tech-root');
  }
  if (canAccessDashboard(profile)) {
    groups.push('/dashboard');
  }
  if (canAccessTemplates(profile)) {
    groups.push('/templates');
  }
  if (canAccessDocuments(profile)) {
    groups.push('/documents');
  }

  return groups.length ? groups : ['/viewer'];
}

export function useAuthGuard({
  publicRoutes = [],
  locale = '',
  groupPriority,
  groupAreaMap,
  groupAccessMap,
}: UseAuthGuardOptions) {
  const router = useRouter();
  const { pathname } = useLocation();
  const { isAuthenticated, isLoading, isHydrated } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);

  // Subscribe to profile store so the effect re-runs when profile loads
  const profile = profileStore((s) => s.profile);
  const isProfileLoading = profileStore((s) => s.isFetchingProfile);

  const normalizePath = useCallback(
    (path: string): string => {
      const segments = path.split('/');
      if (locale && segments.length > 1 && segments[1]?.length === 2) {
        return `/${segments.slice(2).join('/')}`.replace(/\/$/, '');
      }
      return path.replace(/\/$/, '');
    },
    [locale],
  );

  const isPublicRoute = useMemo(() => {
    const path = pathname.replace(/\/+$/, '');
    if (!publicRoutes) return false;
    return publicRoutes.some(
      (route) =>
        path === route ||
        (locale && path === `/${locale}${route}`) ||
        path.startsWith(`${route}/`) ||
        (locale && path.startsWith(`/${locale}${route}/`)),
    );
  }, [pathname, publicRoutes, locale]);

  const getRedirectArea = useCallback(
    (groups: string[]): string => {
      if (!groupPriority || !groupAreaMap) return '/';
      for (const group of groupPriority) {
        if (groups.includes(group)) return groupAreaMap[group] || '/';
      }
      return '/';
    },
    [groupPriority, groupAreaMap],
  );

  const isAllowedPath = useCallback(
    (groups: string[], currentPath: string): boolean => {
      if (!groupAccessMap) return true;
      const normalized = normalizePath(currentPath);
      for (const group of groups) {
        const allowedPaths = groupAccessMap[group] || [];
        for (const path of allowedPaths) {
          if (normalized === path || normalized.startsWith(`${path}/`) || normalized.startsWith(`${path}-`)) {
            return true;
          }
        }
      }
      return false;
    },
    [groupAccessMap, normalizePath],
  );

  const localePath = useCallback(
    (path: string): string => {
      if (!locale) return path;
      return `/${locale}${path}`.replace(/\/{2,}/g, '/');
    },
    [locale],
  );

  const handleRedirectByGroup = useCallback(
    (groups: string[]) => {
      const redirectArea = getRedirectArea(groups);
      router.navigate({ to: localePath(redirectArea) as any, replace: true });
    },
    [router, getRedirectArea, localePath],
  );

  useEffect(() => {
    if (isHydrated && isAuthenticated && !profile && !isProfileLoading) {
      CoreUserProfileStore.fetchProfileAction();
    }
  }, [isHydrated, isAuthenticated, profile, isProfileLoading]);

  useEffect(() => {
    if (!isHydrated || isLoading) return;

    // While authenticated but profile hasn't loaded yet, wait
    if (isAuthenticated && isProfileLoading) return;

    setIsInitialized(true);

    // Derive groups from profile user_type (not JWT — Keycloak JWT has no 'groups' field)
    const groups = isAuthenticated ? groupsFromProfile(profile) : [];

    // 🟡 Root path → redirect by role if logged in, otherwise /sign-in
    if (pathname === '/' || (locale && pathname === `/${locale}`)) {
      if (!isAuthenticated) {
        router.navigate({ to: localePath('/sign-in') as any, replace: true });
        return;
      }
      handleRedirectByGroup(groups);
      return;
    }

    // 🔴 Not logged in + not a public route → /sign-in
    if (!isAuthenticated && !isPublicRoute) {
      router.navigate({ to: localePath('/sign-in') as any, replace: true });
      return;
    }

    // ✅ Logged in + on /sign-in → redirect by group or backUrl
    if (isAuthenticated && (pathname === '/sign-in' || (locale && pathname === `/${locale}/sign-in`))) {
      const searchParams = new URLSearchParams(window.location.search);
      const backUrl = searchParams.get('backUrl');
      if (backUrl) {
        try {
          router.navigate({ to: decodeURIComponent(backUrl) as any });
          return;
        } catch {
          // fall through to group redirect
        }
      }
      handleRedirectByGroup(groups);
      return;
    }

    // ✅ Logged in + public route → allow
    if (isAuthenticated && isPublicRoute) return;

    // ✅ Logged in + check path access
    if (isAuthenticated && groupAccessMap) {
      if (!isAllowedPath(groups, pathname)) {
        handleRedirectByGroup(groups);
      }
    }
  }, [
    isAuthenticated,
    isLoading,
    isPublicRoute,
    pathname,
    router,
    isHydrated,
    locale,
    groupPriority,
    groupAreaMap,
    groupAccessMap,
    handleRedirectByGroup,
    isAllowedPath,
    getRedirectArea,
    localePath,
    profile,
    isProfileLoading,
  ]);

  return { isInitialized, isPublicRoute };
}
