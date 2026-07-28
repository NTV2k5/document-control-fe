import { API } from 'reactjs-platform/utilities';

export interface ISearchFileResult {
  name: string;
  file_name: string;
  file_type: string;
  content_doctype: string | null;
  content_docname: string | null;
  user_name: string;
  user_image: string | null;
  full_name: string;
}

export const searchFilesAPI = async (query: string): Promise<ISearchFileResult[]> => {
  const formData = new FormData();
  formData.append('query', query);

  return API.request<any>({
    method: 'POST',
    url: '/api/method/drive.api.files.search',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }).then((response) => response.data?.message ?? []);
};
