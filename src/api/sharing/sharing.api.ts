import { API } from 'reactjs-platform/utilities';

export interface ISharedWithUser {
  email: string;
  full_name: string;
  user_image: string | null;
  permissions: {
    read: number;
    comment: number;
    share: number;
    write: number;
    upload: number;
  };
}

export interface ISharedByMeFile {
  name: string;
  file_name: string;
  is_folder: number;
  mime_type: string;
  file_size: number;
  file_url: string;
  owner: string;
  creation: string;
  modified: string;
  folder: string;
  _user_tags: string | null;
  shared_with: ISharedWithUser[];
}

export const getSharedByMeFilesAPI = async (): Promise<ISharedByMeFile[]> => {
  return API.request<any>({
    method: 'GET',
    url: '/api/method/drive_edms.api.sharing.get_shared_by_me',
  }).then((response) => response.data?.message?.files ?? []);
};

export const getSharedWithListAPI = async (entity: string): Promise<any[]> => {
  return API.request<any>({
    method: 'GET',
    url: '/api/method/drive.api.permissions.get_shared_with_list',
    data: {
      entity,
    },
    headers: {
      'Content-Type': 'application/json',
    },
  }).then((response) => response.data?.message ?? []);
};

export interface IUpdateFileAccessPayload {
  entity_name: string;
  method: 'share' | 'unshare';
  user: string;
  read?: number;
  write?: number;
  comment?: number;
  upload?: number;
  share?: number;
}

export const updateFileAccessAPI = async (payload: IUpdateFileAccessPayload): Promise<any> => {
  return API.request<any>({
    method: 'POST',
    url: '/api/method/drive.api.files.update_access',
    data: payload,
    headers: {
      'Content-Type': 'application/json',
    },
  }).then((response) => response.data);
};
