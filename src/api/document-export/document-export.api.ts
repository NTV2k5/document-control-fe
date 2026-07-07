import { API } from 'reactjs-platform/utilities';
import axios from 'axios';

const DOCUMENT_EXPORT_BASE_URL = '/api/v1/document-export';
const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const readBlobErrorMessage = async (blob: Blob) => {
  const text = await blob.text().catch(() => '');
  if (!text.trim()) return '';

  try {
    const parsed = JSON.parse(text) as { message?: unknown; error?: unknown };
    if (Array.isArray(parsed.message)) return parsed.message.join(', ');
    if (typeof parsed.message === 'string') return parsed.message;
    if (typeof parsed.error === 'string') return parsed.error;
  } catch {
    return text;
  }

  return text;
};

const resolveExportErrorMessage = async (error: unknown) => {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : 'Cannot export document.';
  }

  const responseData = error.response?.data;

  if (responseData instanceof Blob) {
    const blobMessage = await readBlobErrorMessage(responseData);
    if (blobMessage) return blobMessage;
  }

  if (typeof responseData === 'object' && responseData !== null && 'message' in responseData) {
    const message = (responseData as { message?: unknown }).message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
  }

  return error.message || 'Cannot export document.';
};

export const convertDocxToPdfAPI = async (buffer: ArrayBuffer, fileName = 'document.docx'): Promise<Blob> => {
  const formData = new FormData();
  const normalizedFileName = fileName.toLowerCase().endsWith('.docx') ? fileName : `${fileName}.docx`;

  formData.append(
    'file',
    new Blob([buffer], {
      type: DOCX_MIME_TYPE,
    }),
    normalizedFileName,
  );

  try {
    return await API.post<Blob>(`${DOCUMENT_EXPORT_BASE_URL}/pdf`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      responseType: 'blob',
    }).then((response) => response.data);
  } catch (error) {
    throw new Error(await resolveExportErrorMessage(error));
  }
};
