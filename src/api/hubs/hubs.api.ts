import { API } from 'reactjs-platform/utilities';
import type {
  IDepartmentItem,
  IProjectItem,
  IHubStatsAPIResponse,
  IHubFoldersAPIResponse,
  IHubRecentActivityAPIResponse,
} from './hubs.type';

const API_COMMON = import.meta.env.VITE_API_COMMON || 'drive_edms.api';

export const getHubFoldersAPI = async (category: 'Department' | 'Project'): Promise<IHubFoldersAPIResponse[]> => {
  return API.request<{ message: { data: IHubFoldersAPIResponse[] } }>({
    method: 'GET',
    url: `/api/method/${API_COMMON}.university_hub.get_hub_folders`,
    data: { category },
    headers: {
      'Content-Type': 'application/json',
    },
  }).then((response) => response.data.message.data);
};

export const listDepartmentsAPI = async (): Promise<IDepartmentItem[]> => {
  return getHubFoldersAPI('Department').then((data) =>
    data.map((item) => {
      let iconKey: IDepartmentItem['iconKey'] = 'folder';
      const mime = item.mime_type.toLowerCase();
      if (mime.includes('word') || mime.includes('document')) {
        iconKey = 'code';
      } else if (mime.includes('pdf')) {
        iconKey = 'biology';
      } else if (mime.includes('sheet') || mime.includes('excel')) {
        iconKey = 'math';
      }
      return {
        id: item.name,
        name: item.file_name,
        size: '1.2 MB',
        filesCount: 1,
        iconKey,
      };
    })
  );
};

export const archiveDepartmentAPI = async (id: string): Promise<void> => {
  return API.post(`/api/v1/hubs/departments/${id}/archive`).then(() => undefined);
};

export const listProjectsAPI = async (): Promise<IProjectItem[]> => {
  return getHubFoldersAPI('Project').then((data) =>
    data.map((item) => {
      let iconKey: IProjectItem['iconKey'] = 'folder';
      const mime = item.mime_type.toLowerCase();
      if (mime.includes('video')) {
        iconKey = 'rocket';
      } else if (mime.includes('image')) {
        iconKey = 'leaf';
      } else if (mime.includes('brain') || mime.includes('ai')) {
        iconKey = 'brain';
      }
      return {
        id: item.name,
        name: item.file_name,
        size: '17.07 MB',
        filesCount: 1,
        iconKey,
      };
    })
  );
};

export const archiveProjectAPI = async (id: string): Promise<void> => {
  return API.post(`/api/v1/hubs/projects/${id}/archive`).then(() => undefined);
};

export const getHubStatsAPI = async (): Promise<IHubStatsAPIResponse> => {
  return API.get<{ message: IHubStatsAPIResponse }>(
    `/api/method/${API_COMMON}.university_hub.get_hub_stats`
  ).then((response) => response.data.message);
};

export const getHubRecentActivityAPI = async (): Promise<IHubRecentActivityAPIResponse[]> => {
  return API.request<{ message: { data: IHubRecentActivityAPIResponse[] } }>({
    method: 'GET',
    url: `/api/method/${API_COMMON}.university_hub.get_recent_activity`,
    data: {},
    headers: {
      'Content-Type': 'application/json',
    },
  }).then((response) => response.data.message.data);
};
