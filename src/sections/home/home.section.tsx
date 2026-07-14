import { useEffect, useState, useMemo } from 'react';
import type { IHomeSectionProps } from './home.type';
import { EngagementAnalytics } from './engagement-analytics';
import { FileDistribution } from './file-distribution';
import { ImportantAlert } from './important-alert';
import { LatestPublished } from './latest-published';
import { OverviewBanner } from './overview-banner';
import { QuickAccess } from './quick-access';
import { RecentlyInteracted } from './recently-interacted';
import { StatsOverview } from './stats-overview';
import {
  trendingNow as mockTrendingNow,
  statsOverview as mockStatsOverview,
  dataBarMock,
  dataPieMock,
  latestPublished as mockLatestPublished,
  recentlyInteracted as mockRecentlyInteracted,
} from './home.mock';
import { getDocumentReportSummaryAPI, listDocumentsAPI, listApprovalDashboardDocumentsAPI } from 'api';
import type { IDocument, IEntityReportSummary, IApprovalDashboardRow } from 'api';
import { profileStore } from 'reactjs-platform/utilities';
import { Skeleton } from 'reactjs-platform/ui';
import { useTranslation } from '../../i18n';

const getRelativeTime = (isoString: string, locale: string) => {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    if (diffHours < 1) {
      const mins = Math.max(1, diffMins);
      if (locale === 'vi') return `${mins} phút trước`;
      return `${mins} minute${mins > 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      if (locale === 'vi') return `${diffHours} giờ trước`;
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      if (locale === 'vi') return `${diffDays} ngày trước`;
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }
  } catch {
    return locale === 'vi' ? 'vừa xong' : 'just now';
  }
};

export const HomeSection = (_props: IHomeSectionProps) => {
  const { locale } = useTranslation();
  const profile = profileStore((state) => state.profile);
  const userId = profile?.id;

  const [documentSummary, setDocumentSummary] = useState<IEntityReportSummary | null>(null);
  const [myFilesCount, setMyFilesCount] = useState<number>(0);
  const [latestDocs, setLatestDocs] = useState<IDocument[]>([]);
  const [recentDocs, setRecentDocs] = useState<IDocument[]>([]);
  const [todoDocs, setTodoDocs] = useState<IApprovalDashboardRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const reportParams = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 365); // Last 365 days
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      group_by: 'month' as const,
    };
  }, []);

  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch report summary with date range
        try {
          const summary = await getDocumentReportSummaryAPI(reportParams);
          if (active) setDocumentSummary(summary);
        } catch (err) {
          console.error('Error fetching document report summary:', err);
        }

        // Fetch latest published documents (no is_published: true)
        try {
          const latestResponse = await listDocumentsAPI({
            page: 1,
            page_size: 3,
            sort: 'desc:created_at',
          });
          if (active) setLatestDocs(latestResponse.data);
        } catch (err) {
          console.error('Error fetching latest published documents:', err);
        }

        // Fetch recently interacted documents
        try {
          const recentResponse = await listDocumentsAPI({
            page: 1,
            page_size: 6,
            sort: 'desc:updated_at',
          });
          if (active) setRecentDocs(recentResponse.data);
        } catch (err) {
          console.error('Error fetching recently interacted documents:', err);
        }

        // Fetch todo approval documents
        try {
          const todoResponse = await listApprovalDashboardDocumentsAPI('todo');
          if (active) setTodoDocs(todoResponse);
        } catch (err) {
          console.error('Error fetching todo approval documents:', err);
        }

        // Fetch my files count
        if (userId) {
          try {
            const myDocs = await listDocumentsAPI({
              created_by: userId,
              page: 1,
              page_size: 1,
            });
            if (active) setMyFilesCount(myDocs.pagination.total);
          } catch (err) {
            console.error('Error fetching my files count:', err);
          }
        }
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      active = false;
    };
  }, [userId, reportParams]);

  // Mapping dynamic stats overview data
  const statsOverviewData = mockStatsOverview;

  // Mapping Engagement Analytics (views last week or trend points)
  const analyticsData = useMemo(() => {
    if (!documentSummary?.trend || documentSummary.trend.length === 0) return dataBarMock;
    return documentSummary.trend.map((point) => ({
      name: point.label,
      views: point.count,
    }));
  }, [documentSummary]);

  // Mapping File Distribution dynamically based on by_template_type counts
  const fileDistributionData = useMemo(() => {
    if (!documentSummary?.by_template_type || Object.keys(documentSummary.by_template_type).length === 0) {
      return dataPieMock;
    }
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    return Object.entries(documentSummary.by_template_type).map(([key, val], index) => ({
      name: key.toUpperCase(),
      value: val,
      color: colors[index % colors.length],
    }));
  }, [documentSummary]);

  // Mapping Trending Data to Overview Banner
  const trendingData = mockTrendingNow;

  // Mapping Latest Published documents
  const latestPublishedDocs = useMemo(() => {
    if (latestDocs.length === 0) return mockLatestPublished;
    return latestDocs.map((doc) => ({
      id: doc.id,
      title: doc.title,
      description: doc.description || '',
      creator: doc.created_by || 'Admin Office',
      date: doc.created_at ? new Date(doc.created_at).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
      type: doc.template?.template_type || 'POLICY',
    }));
  }, [latestDocs, locale]);

  // Mapping Recently Interacted documents
  const recentlyInteractedDocs = useMemo(() => {
    if (recentDocs.length === 0) return mockRecentlyInteracted;
    return recentDocs.slice(0, 6).map((doc) => {
      let docType = 'WORD';
      if (doc.artifact_type === 'spreadsheet') docType = 'EXCEL';
      else if (doc.artifact_type === 'pdf' || doc.artifact_type === 'presentation') docType = 'PDF';
      else if (doc.artifact_type === 'image' || doc.artifact_type === 'image_form') docType = 'IMAGE';
      else if (doc.artifact_type === 'video') docType = 'VIDEO';
      else if (doc.artifact_type === 'txt') docType = 'TXT';

      const editedTime = doc.updated_at ? getRelativeTime(doc.updated_at, locale) : '';

      return {
        id: doc.id,
        title: doc.title,
        description: doc.description || '',
        type: docType,
        edited: editedTime,
      };
    });
  }, [recentDocs, locale]);

  // Mapping Important - Unread alert details
  const latestUrgentDoc = useMemo(() => {
    if (todoDocs.length === 0) return null;
    const latest = todoDocs[0];
    const timeText = latest.updated_at
      ? new Date(latest.updated_at).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit' })
      : '';
    return {
      id: latest.id,
      title: latest.title,
      description: locale === 'vi'
        ? `Yêu cầu: Đang chờ bạn phê duyệt ở bước "${latest.approval?.current_step?.label || ''}"`
        : `Action Required: Waiting for your approval in step "${latest.approval?.current_step?.label || ''}"`,
      time: timeText,
    };
  }, [todoDocs, locale]);

  if (loading) {
    return (
      <div className="space-y-6 pb-10">
        {/* Banner skeleton */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="min-h-[240px] rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-100 animate-pulse xl:col-span-2 space-y-4">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-10 w-28 rounded-full" />
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 animate-pulse space-y-4">
            <Skeleton className="h-4 w-1/2" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          </div>
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 animate-pulse">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-16 w-16 rounded-2xl" />
            </div>
          ))}
        </div>

        {/* Charts skeleton */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-100 animate-pulse space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-[220px] w-full rounded-xl" />
            </div>
          ))}
        </div>

        {/* Latest skeletons */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 animate-pulse space-y-4">
              <div className="flex justify-between items-center">
                <Skeleton className="h-12 w-12 rounded-2xl" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-12 w-full" />
              <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Hero Banner & Trending Now */}
      <OverviewBanner trendingData={trendingData} />

      {/* Stats Cards */}
      <StatsOverview data={statsOverviewData} />

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <EngagementAnalytics data={analyticsData} />
        <FileDistribution data={fileDistributionData} />
      </div>

      {/* Important Unread Alert */}
      <ImportantAlert urgentCount={todoDocs.length} latestUrgentDoc={latestUrgentDoc} />

      {/* Latest Published */}
      <LatestPublished docs={latestPublishedDocs} />

      {/* Recently Interacted */}
      <RecentlyInteracted docs={recentlyInteractedDocs} />

      {/* Quick Access */}
      <QuickAccess />
    </div>
  );
};


