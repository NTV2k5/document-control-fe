import { API } from 'reactjs-platform/utilities';

export interface IFolderItem {
  id: string;
  name: string;
  size: string;
  filesCount: number;
}

export interface IFileItem {
  id: string;
  name: string;
  size: string;
  fileType: 'pdf' | 'docx' | 'xlsx' | 'other';
}

export const listFoldersAPI = async (): Promise<IFolderItem[]> => {
  return API.get<{ data: IFolderItem[] }>('/api/v1/my-hubs/folders').then(
    (response) => response.data.data,
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
  return API.get<{ data: IFileItem[] }>('/api/v1/my-hubs/files').then(
    (response) => response.data.data,
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
