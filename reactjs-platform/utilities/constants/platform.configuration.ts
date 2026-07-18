const getClientEnv = (value: string | undefined, fallback: string) => {
  return value && value.trim().length > 0 ? value : fallback;
};

const getApiEndpoint = () => {
  // In development, use empty string to leverage Vite proxy
  // The proxy will forward /api requests to VITE_API_URL / VITE_API_ENDPOINT
  if (import.meta.env.DEV) {
    return '';
  }

  // In production, use VITE_API_URL or VITE_API_ENDPOINT or fallback to 100.106.138.47
  const configuredEndpoint = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_ENDPOINT)?.trim();
  if (configuredEndpoint) {
    return configuredEndpoint;
  }

  return 'http://100.106.138.47:8000';
};

const API_ENDPOINT = getApiEndpoint();
const DEFAULT_TIMEZONE = getClientEnv(import.meta.env.VITE_DEFAULT_TIMEZONE, 'Asia/Ho_Chi_Minh');
const DOCUMENT_EDITOR_ENGINE = getClientEnv(import.meta.env.VITE_DOCUMENT_EDITOR_ENGINE, 'ckeditor');
// const TECH_CONFIG_VARIABLE_ENABLED = false;

const TECH_CONFIG_VARIABLE_ENABLED =
  getClientEnv(import.meta.env.TECH_CONFIG_VARIABLE_ENABLED?.trim(), 'false') === 'true';

const DOCUMENT_DOCX_PREVIEW_EDITOR =
  getClientEnv(import.meta.env.VITE_DOCUMENT_DOCX_PREVIEW_EDITOR?.trim(), 'false') === 'false';

const CURRENCY_ENABLE_COMPACT = true;
const ALLOW_EDIT_ALL_STATUS = true;
const ADMISSION_CRM_ENDPOINT = getClientEnv(
  import.meta.env.VITE_ADMISSION_CRM_ENDPOINT?.trim(),
  'https://admission-crm-dev.giadinh.edu.vn',
);
const MSAL_CLIENT_ID = getClientEnv(
  import.meta.env.VITE_MSAL_CLIENT_ID?.trim(),
  'dbe680fc-2a36-4946-832b-dc9d15f28a5d',
);
const MSAL_TENANT_ID = getClientEnv(
  import.meta.env.VITE_MSAL_TENANT_ID?.trim(),
  '33feb0af-7bc8-4dde-af23-96e8c35bcf45',
);
const MSAL_REDIRECT_URI = getClientEnv(
  import.meta.env.VITE_MSAL_REDIRECT_URI?.trim(),
  'auth://druce.merchant',
);

export {
  API_ENDPOINT,
  DEFAULT_TIMEZONE,
  DOCUMENT_EDITOR_ENGINE,
  TECH_CONFIG_VARIABLE_ENABLED,
  DOCUMENT_DOCX_PREVIEW_EDITOR,
  CURRENCY_ENABLE_COMPACT,
  ALLOW_EDIT_ALL_STATUS,
  ADMISSION_CRM_ENDPOINT,
  MSAL_CLIENT_ID,
  MSAL_TENANT_ID,
  MSAL_REDIRECT_URI,
};
