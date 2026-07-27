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

export const formatBytes = (bytes?: number | null): string => {
  if (!bytes || isNaN(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const index = Math.min(i, sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, index)).toFixed(2)) + ' ' + sizes[index];
};

export const mapFileType = (mimeType?: string | null, fileName?: string | null): 'pdf' | 'docx' | 'xlsx' | 'other' => {
  const mimeLower = (mimeType || '').toLowerCase();
  if (mimeLower.includes('pdf')) return 'pdf';
  if (mimeLower.includes('word') || mimeLower.includes('document') || mimeLower.includes('text/plain')) return 'docx';
  if (mimeLower.includes('sheet') || mimeLower.includes('excel') || mimeLower.includes('spreadsheet')) return 'xlsx';
  
  if (fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (ext === 'docx' || ext === 'doc' || ext === 'txt') return 'docx';
    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return 'xlsx';
  }
  return 'other';
};

export const listFoldersAPI = async (): Promise<IFolderItem[]> => {
  return API.get<any>(`/api/method/${API_COMMON}.my_hubs.get_my_folders`).then((response) => {
    const raw = response.data;
    const list: IMyHubFolderAPIResponse[] =
      raw?.message?.data ??
      (Array.isArray(raw?.message) ? raw.message : null) ??
      raw?.data?.data ??
      (Array.isArray(raw?.data) ? raw.data : null) ??
      [];

    return list.map((item) => ({
      id: item.name || (item as any).id || '',
      name: item.file_name || (item as any).name || 'Untitled Folder',
      size: formatBytes(item.total_size || 0),
      filesCount: item.total_files || 0,
      team: item.team,
    }));
  });
};

export const createFolderAPI = async (name: string): Promise<IFolderItem> => {
  return API.post<{ message: any }>('/api/method/drive.api.files.create_folder', {
    file_name: name,
  }).then((response) => {
    const item = response.data?.message || response.data?.data || response.data;
    return {
      id: item.name,
      name: item.file_name,
      size: formatBytes(item.file_size || 0),
      filesCount: 0,
      team: item.team,
    };
  });
};

export const deleteFolderAPI = async (id: string): Promise<void> => {
  return API.delete(`/api/v1/my-hubs/folders/${id}`).then(() => undefined);
};

export const listFilesAPI = async (): Promise<IFileItem[]> => {
  return API.get<any>(`/api/method/${API_COMMON}.my_hubs.get_my_files`).then((response) => {
    const raw = response.data;
    const list: IMyHubFileAPIResponse[] =
      raw?.message?.data ??
      (Array.isArray(raw?.message) ? raw.message : null) ??
      raw?.data?.data ??
      (Array.isArray(raw?.data) ? raw.data : null) ??
      [];

    return list.map((item) => ({
      id: item.name || (item as any).id || '',
      name: item.file_name || (item as any).name || 'Untitled',
      size: formatBytes(item.file_size || 0),
      fileType: mapFileType(item.mime_type, item.file_name),
      fileUrl: (item as any).file_url || null,
      mimeType: item.mime_type || null,
    }));
  });
};

export const createFileAPI = async (file: File): Promise<IFileItem> => {
  const formData = new FormData();
  formData.append('file', file);

  return API.post<{ message: any }>('/api/method/drive.api.files.upload_file', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }).then((response) => {
    const item = response.data?.message || response.data?.data || response.data;
    return {
      id: item.name,
      name: item.file_name,
      size: formatBytes(item.file_size || 0),
      fileType: mapFileType(item.mime_type || '', item.file_name),
      fileUrl: item.file_url || null,
    };
  });
};

export const deleteFileAPI = async (id: string): Promise<void> => {
  return API.delete(`/api/v1/my-hubs/files/${id}`).then(() => undefined);
};

export const getMyStatsAPI = async (): Promise<IMyHubStatsAPIResponse> => {
  return API.get<any>(`/api/method/${API_COMMON}.my_hubs.get_my_stats`).then((response) => {
    const raw = response.data;
    const data = raw?.message?.Images ? raw.message : (raw?.data?.Images ? raw.data : raw?.message || raw?.data || {});
    return {
      Images: { count: data?.Images?.count || 0, size: data?.Images?.size || 0 },
      Videos: { count: data?.Videos?.count || 0, size: data?.Videos?.size || 0 },
      Documents: { count: data?.Documents?.count || 0, size: data?.Documents?.size || 0 },
      Other: { count: data?.Other?.count || 0, size: data?.Other?.size || 0 },
    };
  });
};

export const getMyRecentActivityAPI = async (): Promise<IMyHubRecentActivityAPIResponse[]> => {
  return API.get<any>(`/api/method/${API_COMMON}.my_hubs.get_my_recent_activity`).then((response) => {
    const raw = response.data;
    return (
      raw?.message?.data ??
      (Array.isArray(raw?.message) ? raw.message : null) ??
      raw?.data?.data ??
      (Array.isArray(raw?.data) ? raw.data : null) ??
      []
    );
  });
};
