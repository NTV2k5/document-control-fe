import { API } from 'reactjs-platform/utilities';

export const getFileContentAPI = async (entityName: string): Promise<Blob> => {
  return API.request<Blob>({
    method: 'GET',
    url: '/api/method/drive.api.files.get_file_content',
    params: {
      entity_name: entityName,
      trigger_download: 0,
    },
    responseType: 'blob',
  }).then((response) => response.data);
};
