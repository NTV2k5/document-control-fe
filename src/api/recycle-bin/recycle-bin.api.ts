import { API } from 'reactjs-platform/utilities';

export const listTrashFilesAPI = async (): Promise<any[]> => {
  return API.request<any>({
    method: 'GET',
    url: '/api/method/drive.api.list.trash',
    data: {
      team: 'all',
      order_by: 'modified',
      ascending: false,
    },
    headers: {
      'Content-Type': 'application/json',
    },
  }).then((response) => response.data?.message ?? []);
};

export const restoreTrashFilesAPI = async (entityNames: string[]): Promise<void> => {
  return API.request<any>({
    method: 'POST',
    url: '/api/method/drive.api.files.remove_or_restore',
    data: {
      entity_names: entityNames,
    },
    headers: {
      'Content-Type': 'application/json',
    },
  }).then((response) => response.data);
};
