import { API } from 'reactjs-platform/utilities';
import { toast } from 'react-toastify';

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

export const downloadDriveFile = async (id: string, name: string): Promise<void> => {
  try {
    toast.info(`Đang tải xuống tệp: ${name}...`);
    const blob = await getFileContentAPI(id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Đã tải xuống thành công tệp: ${name}`);
  } catch (error) {
    console.error('Failed to download file:', error);
    toast.error(`Không thể tải xuống tệp: ${name}`);
  }
};
