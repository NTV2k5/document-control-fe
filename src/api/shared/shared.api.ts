import { API } from 'reactjs-platform/utilities';

export const listSharedFilesAPI = async (): Promise<any[]> => {
  return API.request<any>({
    method: 'GET',
    url: '/api/method/drive.api.list.shared',
    data: {
      team: 'all',
      shared_type: 'with',
      order_by: 'modified',
      ascending: false,
    },
    headers: {
      'Content-Type': 'application/json',
    },
  }).then((response) => response.data?.message ?? []);
};
