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
  trendingNow,
  statsOverview,
  dataBarMock,
  dataPieMock,
  latestPublished,
  recentlyInteracted,
} from './home.mock';

export const HomeSection = (_props: IHomeSectionProps) => {
  return (
    <div className="space-y-6 pb-10">
      {/* Hero Banner & Trending Now */}
      <OverviewBanner trendingData={trendingNow} />

      {/* Stats Cards */}
      <StatsOverview data={statsOverview} />

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <EngagementAnalytics data={dataBarMock} />
        <FileDistribution data={dataPieMock} />
      </div>

      {/* Important Unread Alert */}
      <ImportantAlert />

      {/* Latest Published */}
      <LatestPublished docs={latestPublished} />

      {/* Recently Interacted */}
      <RecentlyInteracted docs={recentlyInteracted} />

      {/* Quick Access */}
      <QuickAccess />
    </div>
  );
};
