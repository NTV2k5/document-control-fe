import { API } from 'reactjs-platform/utilities';
import type {
  IFolderItem,
  IFileItem,
  IMyHubFolderAPIResponse,
  IMyHubFileAPIResponse,
  IMyHubRecentActivityAPIResponse,
  IMyHubStatsAPIResponse,
} from './my-hubs.type';

const API_COMMON = import.meta.env.VITE_API_COMMON || 'drive_edms.api';

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const mapFileType = (mimeType: string, fileName?: string): 'pdf' | 'docx' | 'xlsx' | 'other' => {
  const mimeLower = mimeType.toLowerCase();
  if (mimeLower.includes('pdf')) return 'pdf';
  if (mimeLower.includes('word') || mimeLower.includes('document') || mimeLower.includes('text/plain')) return 'docx';
  if (mimeLower.includes('sheet') || mimeLower.includes('excel') || mimeLower.includes('spreadsheet')) return 'xlsx';
  
  if (fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (ext === 'docx' || ext === 'doc' || ext === 'txt') return 'docx';
    if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  }
  return 'other';
};

export const listFoldersAPI = async (): Promise<IFolderItem[]> => {
  return API.get<{ message: { data: IMyHubFolderAPIResponse[] } }>(
    `/api/method/${API_COMMON}.my_hubs.get_my_folders`
  ).then((response) =>
    (response.data?.message?.data ?? []).map((item) => ({
      id: item.name,
      name: item.file_name,
      size: formatBytes(item.total_size),
      filesCount: item.total_files,
    }))
  );
};

export const createFolderAPI = async (name: string): Promise<IFolderItem> => {
  return API.post<{ data: IFolderItem }>('/api/v1/my-hubs/folders', { name }).then(
    (response) => response.data.data,
  );
};

export const deleteFolderAPI = async (id: string): Promise<void> => {
  return API.delete(`/api/v1/my-hubs/folders/${id}`).then(() => undefined);
};

export const listFilesAPI = async (): Promise<IFileItem[]> => {
  return API.get<{ message: { data: IMyHubFileAPIResponse[] } }>(
    `/api/method/${API_COMMON}.my_hubs.get_my_files`
  ).then((response) =>
    (response.data?.message?.data ?? []).map((item) => ({
      id: item.name,
      name: item.file_name,
      size: formatBytes(item.file_size),
      fileType: mapFileType(item.mime_type, item.file_name),
      fileUrl: (item as any).file_url || null,
    }))
  );
};

export const createFileAPI = async (payload: {
  name: string;
  size: string;
  fileType: 'pdf' | 'docx' | 'xlsx' | 'other';
}): Promise<IFileItem> => {
  return API.post<{ data: IFileItem }>('/api/v1/my-hubs/files', payload).then(
    (response) => response.data.data,
  );
};

export const deleteFileAPI = async (id: string): Promise<void> => {
  return API.delete(`/api/v1/my-hubs/files/${id}`).then(() => undefined);
};

export const getMyStatsAPI = async (): Promise<IMyHubStatsAPIResponse> => {
  return API.get<{ message: IMyHubStatsAPIResponse }>(
    `/api/method/${API_COMMON}.my_hubs.get_my_stats`
  ).then((response) => response.data.message);
};

export const getMyRecentActivityAPI = async (): Promise<IMyHubRecentActivityAPIResponse[]> => {
  return API.get<{ message: { data: IMyHubRecentActivityAPIResponse[] } }>(
    `/api/method/${API_COMMON}.my_hubs.get_my_recent_activity`
  ).then((response) => response.data?.message?.data ?? []);
};
