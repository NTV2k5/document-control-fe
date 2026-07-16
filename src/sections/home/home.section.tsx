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
  getTrendingNowAPI,
  getSummaryStatsAPI,
  getEngagementAPI,
  getFileDistributionAPI,
  getDocumentsLatestAPI,
  listApprovalDashboardDocumentsAPI,
} from 'api';
import type {
  IApprovalDashboardRow,
  ITrendingNowItem,
  ISummaryStats,
  IEngagementItem,
  IFileDistribution,
  IDocumentLatestItem,
} from 'api';
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

  const [trendingNowData, setTrendingNowData] = useState<ITrendingNowItem[]>([]);
  const [summaryStats, setSummaryStats] = useState<ISummaryStats | null>(null);
  const [engagementData, setEngagementData] = useState<IEngagementItem[]>([]);
  const [fileDistribution, setFileDistribution] = useState<IFileDistribution | null>(null);
  const [documentsLatest, setDocumentsLatest] = useState<IDocumentLatestItem[]>([]);
  const [todoDocs, setTodoDocs] = useState<IApprovalDashboardRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch all dashboard APIs and todo documents in parallel
        await Promise.all([
          // 1. Fetch trending now
          getTrendingNowAPI()
            .then((res) => {
              if (active) setTrendingNowData(res);
            })
            .catch((err) => console.error('Error fetching trending now:', err)),

          // 2. Fetch summary stats
          getSummaryStatsAPI()
            .then((res) => {
              if (active) setSummaryStats(res);
            })
            .catch((err) => console.error('Error fetching summary stats:', err)),

          // 3. Fetch engagement
          getEngagementAPI()
            .then((res) => {
              if (active) setEngagementData(res);
            })
            .catch((err) => console.error('Error fetching engagement:', err)),

          // 4. Fetch file distribution
          getFileDistributionAPI()
            .then((res) => {
              if (active) setFileDistribution(res);
            })
            .catch((err) => console.error('Error fetching file distribution:', err)),

          // 5. Fetch latest documents
          getDocumentsLatestAPI()
            .then((res) => {
              if (active) setDocumentsLatest(res);
            })
            .catch((err) => console.error('Error fetching latest documents:', err)),

          // 6. Fetch todo approval documents
          listApprovalDashboardDocumentsAPI('todo')
            .then((res) => {
              if (active) setTodoDocs(res);
            })
            .catch((err) => console.error('Error fetching todo approval documents:', err)),
        ]);
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
  }, []);

  // Mapping dynamic stats overview data
  const statsOverviewData = useMemo(() => {
    return {
      publishedFiles: {
        label: locale === 'vi' ? 'Tài liệu đã xuất bản' : 'Published Files',
        value: summaryStats ? String(summaryStats.published_files) : '0',
        trend: '↗ +12% this month',
        trendColor: 'text-green-600',
      },
      myFiles: {
        label: locale === 'vi' ? 'Tài liệu của tôi' : 'My Files',
        value: summaryStats ? String(summaryStats.my_files) : '0',
        trend: '↗ +5% increase this month',
        trendColor: 'text-green-600',
      },
      sharingFiles: {
        label: locale === 'vi' ? 'Tài liệu chia sẻ' : 'Sharing Files',
        value: summaryStats ? String(summaryStats.sharing_files) : '0',
        trend: locale === 'vi' ? 'Đang chia sẻ' : 'Sharing',
        trendColor: 'text-slate-500',
      },
    };
  }, [summaryStats, locale]);

  // Mapping Engagement Analytics
  const analyticsData = useMemo(() => {
    return engagementData.map((item) => {
      let name = item.date;
      try {
        const d = new Date(item.date);
        const day = d.getDate();
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        const month = months[d.getMonth()];
        name = `${day} ${month}`;
      } catch {
        // fallback
      }
      return {
        name: name.toUpperCase(),
        views: item.views,
      };
    });
  }, [engagementData]);

  // Mapping File Distribution dynamically based on file_distribution counts
  const fileDistributionData = useMemo(() => {
    if (!fileDistribution) return [];
    const colors: Record<string, string> = {
      DOCUMENTS: '#3b82f6',
      IMAGES: '#10b981',
      VIDEOS: '#f59e0b',
      OTHERS: '#ef4444',
    };
    return Object.entries(fileDistribution).map(([key, val]) => {
      const name = key.toUpperCase();
      return {
        name,
        value: val,
        color: colors[name] || '#8b5cf6',
      };
    });
  }, [fileDistribution]);

  // Mapping Trending Data to Overview Banner
  const trendingData = useMemo(() => {
    return trendingNowData.map((item, index) => ({
      rank: String(index + 1).padStart(2, '0'),
      title: item.file_name,
      dept: `${item.views} view${item.views !== 1 ? 's' : ''} • ${item.owner}`,
    }));
  }, [trendingNowData]);

  // Mapping Latest Published documents
  const latestPublishedDocs = useMemo(() => {
    return documentsLatest.slice(0, 3).map((doc) => ({
      id: doc.name,
      title: doc.file_name,
      description: doc.content_doctype || doc.file_type || '',
      creator: doc.owner_full_name || doc.owner || 'Admin Office',
      date: doc.creation
        ? new Date(doc.creation.replace(' ', 'T')).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : '',
      type: doc.file_type ? doc.file_type.toUpperCase() : 'POLICY',
    }));
  }, [documentsLatest, locale]);

  // Mapping Recently Interacted documents
  const recentlyInteractedDocs = useMemo(() => {
    return documentsLatest.slice(0, 6).map((doc) => {
      let docType = 'WORD';
      const fileType = (doc.file_type || '').toLowerCase();
      if (fileType.includes('spreadsheet') || fileType.includes('excel')) docType = 'EXCEL';
      else if (fileType.includes('pdf')) docType = 'PDF';
      else if (fileType.includes('presentation') || fileType.includes('powerpoint')) docType = 'PDF';
      else if (fileType.includes('image')) docType = 'IMAGE';
      else if (fileType.includes('video')) docType = 'VIDEO';
      else if (fileType.includes('text') || fileType.includes('txt')) docType = 'TXT';

      const editedTime = doc.modified ? getRelativeTime(doc.modified.replace(' ', 'T'), locale) : '';

      return {
        id: doc.name,
        title: doc.file_name,
        description: doc.content_doctype || doc.file_type || '',
        type: docType,
        edited: editedTime,
      };
    });
  }, [documentsLatest, locale]);

  // Mapping Important - Unread alert details
  const latestUrgentDoc = useMemo(() => {
    if (todoDocs.length === 0) return null;
    const latest = todoDocs[0];
    const timeText = latest.updated_at
      ? new Date(latest.updated_at).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';
    return {
      id: latest.id,
      title: latest.title,
      description:
        locale === 'vi'
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


