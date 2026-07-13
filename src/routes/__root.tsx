import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { AuthProvider } from 'reactjs-platform/utilities';
import { ToastContainer } from 'react-toastify';
import { MentionAutocompleteProvider } from '../components/mentions/mention-autocomplete/mention-autocomplete.component';
import { NavigationProgress } from '../components/ui/navigation-progress/navigation-progress.component';
import { NotFound } from '../components/ui/not-found/not-found.component';
import { THEME_STORAGE_KEY, ThemeProvider } from '../components/theme/theme-toggle/theme-toggle.component';
import { TooltipProvider } from '../components/ui/tooltip/tooltip.component';
import { Error500 } from '../components/ui/error-500/error-500.component';


import { I18nProvider } from '../i18n/i18n-provider';
import { LOCALE_STORAGE_KEY } from '../i18n/config';
import { groupAccessMap, groupAreaMap, groupPriority, publicPaths } from '../lib';
import { ExtractionNotificationsSection } from '../sections';
import appCss from '../app.css?url';

const SITE_TITLE = 'Document Control';
const SITE_DESCRIPTION =
  'Document Control - hệ thống quản lý, soạn thảo, phê duyệt và kiểm soát tài liệu của Trường Đại học Gia Định.';
const SITE_IMAGE = '/gdu/logo/horizontal-long-logo-text.png';

const RootComponent = () => {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
};

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      { title: SITE_TITLE },
      {
        name: 'description',
        content: SITE_DESCRIPTION,
      },
      {
        name: 'application-name',
        content: SITE_TITLE,
      },
      {
        name: 'apple-mobile-web-app-title',
        content: SITE_TITLE,
      },
      {
        name: 'theme-color',
        content: '#243e60',
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        property: 'og:title',
        content: SITE_TITLE,
      },
      {
        property: 'og:description',
        content: SITE_DESCRIPTION,
      },
      {
        property: 'og:image',
        content: SITE_IMAGE,
      },
      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
      {
        name: 'twitter:title',
        content: SITE_TITLE,
      },
      {
        name: 'twitter:description',
        content: SITE_DESCRIPTION,
      },
      {
        name: 'twitter:image',
        content: SITE_IMAGE,
      },
    ],
    links: [
      { rel: 'apple-touch-icon', href: '/gdu/logo/logo-icon.png' },
      { rel: 'icon', type: 'image/png', href: '/gdu/logo/logo-icon.png' },
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  component: RootComponent,
  errorComponent: ({ error, reset }) => {
    return <Error500 error={error} reset={reset} />;
  },

  notFoundComponent: () => <NotFound />,
});

interface IRootDocumentProps {
  children: ReactNode;
}

const RootDocument = ({ children }: IRootDocumentProps) => {
  const themeInitScript = `
    (() => {
      try {
        const stored = localStorage.getItem("${THEME_STORAGE_KEY}-theme");
        if (stored === "light" || stored === "dark") {
          document.documentElement.setAttribute("data-theme", stored);
          return;
        }
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        if (prefersDark) {
          document.documentElement.setAttribute("data-theme", "dark");
        }
      } catch {}
    })();

    (() => {
      try {
        const stored = localStorage.getItem("${LOCALE_STORAGE_KEY}");
        const locale = stored === "en" || stored === "vi" ? stored : "vi";
        document.documentElement.setAttribute("lang", locale);
      } catch {}
    })();
  `;

  return (
    <html lang="vi" className="h-full" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="h-full antialiased" suppressHydrationWarning>
        {/** biome-ignore lint/security/noDangerouslySetInnerHtml: theming init script */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <I18nProvider>
          <AuthProvider
            locale=""
            publicRoutes={publicPaths}
            groupPriority={groupPriority}
            groupAreaMap={groupAreaMap}
            groupAccessMap={groupAccessMap}>
            <ThemeProvider>
              <TooltipProvider>
                <NavigationProgress />
                <ExtractionNotificationsSection />
                <MentionAutocompleteProvider />
                <ToastContainer
                  position="top-right"
                  autoClose={8000}
                  closeOnClick={false}
                  draggable={false}
                  hideProgressBar
                  newestOnTop
                  pauseOnFocusLoss={false}
                  style={{ top: '4rem', right: '1rem', width: 'min(360px, calc(100vw - 2rem))' }}
                />
                {children}
              </TooltipProvider>
            </ThemeProvider>
          </AuthProvider>
        </I18nProvider>
        <Scripts />
      </body>
    </html>
  );
};
