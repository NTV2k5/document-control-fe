import { API } from 'reactjs-platform/utilities';
import { formatBytes } from '../my-hubs/my-hubs.api';
import type {
  IDepartmentItem,
  IProjectItem,
  IHubStatsAPIResponse,
  IHubFoldersAPIResponse,
  IHubRecentActivityAPIResponse,
  IListDriveFilesPayload,
  IDriveFileItem,
  IRenameDriveFilePayload,
  IMoveDriveFilesPayload,
  IShareDriveFilePayload,
  IDeleteDriveFilesPayload,
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
        size: formatBytes(item.total_size || 0),
        filesCount: item.total_files || 0,
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
        size: formatBytes(item.total_size || 0),
        filesCount: item.total_files || 0,
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

export const listDriveFilesAPI = async (
  payload: IListDriveFilesPayload,
): Promise<IDriveFileItem[]> => {
  return API.request<{ message: IDriveFileItem[] }>({
    method: 'GET',
    url: '/api/method/drive.api.list.files',
    data: payload,
    headers: {
      'Content-Type': 'application/json',
    },
  }).then((response) => response.data.message);
};

export const renameDriveFileAPI = async (
  payload: IRenameDriveFilePayload,
): Promise<void> => {
  return API.post(
    '/api/method/drive.api.files.rename',
    payload,
  ).then(() => undefined);
};

export const moveDriveFilesAPI = async (
  payload: IMoveDriveFilesPayload,
): Promise<void> => {
  return API.post(
    '/api/method/drive.api.files.move',
    payload,
  ).then(() => undefined);
};

export const shareDriveFileAPI = async (
  payload: IShareDriveFilePayload,
): Promise<void> => {
  return API.post(
    '/api/method/drive.api.files.update_access',
    payload,
  ).then(() => undefined);
};

export const deleteDriveFilesAPI = async (
  payload: IDeleteDriveFilesPayload,
): Promise<void> => {
  return API.post(
    '/api/method/drive.api.files.remove_or_restore',
    payload,
  ).then(() => undefined);
};

