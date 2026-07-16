import { API } from 'reactjs-platform/utilities';
import type {
  ITrendingNowItem,
  ISummaryStats,
  IEngagementItem,
  IFileDistribution,
  IDocumentLatestItem,
} from './dashboard.type';

export const getTrendingNowAPI = async (): Promise<ITrendingNowItem[]> => {
  return API.get<{ message: ITrendingNowItem[] }>(
    '/api/method/drive_edms.api.dashboard.trending_now'
  ).then((response) => response.data.message);
};

export const getSummaryStatsAPI = async (): Promise<ISummaryStats> => {
  return API.get<{ message: ISummaryStats }>(
    '/api/method/drive_edms.api.dashboard.summary_stats'
  ).then((response) => response.data.message);
};

export const getEngagementAPI = async (): Promise<IEngagementItem[]> => {
  return API.get<{ message: IEngagementItem[] }>(
    '/api/method/drive_edms.api.dashboard.engagement'
  ).then((response) => response.data.message);
};

export const getFileDistributionAPI = async (): Promise<IFileDistribution> => {
  return API.get<{ message: IFileDistribution }>(
    '/api/method/drive_edms.api.dashboard.file_distribution'
  ).then((response) => response.data.message);
};

export const getDocumentsLatestAPI = async (): Promise<IDocumentLatestItem[]> => {
  return API.get<{ message: IDocumentLatestItem[] }>(
    '/api/method/drive_edms.api.dashboard.documents_latest'
  ).then((response) => response.data.message);
};
