const getClientEnv = (value: string | undefined, fallback: string) => {
  return value && value.trim().length > 0 ? value : fallback;
};

const getApiEndpoint = () => {
  // In development, use empty string to leverage Vite proxy
  // The proxy will forward /api requests to https://erpnext.aurora-tech.com
  if (import.meta.env.DEV) {
    return '';
  }

  // In production, use VITE_API_ENDPOINT or fallback to ERPNext
  const configuredEndpoint = import.meta.env.VITE_API_ENDPOINT?.trim();
  if (configuredEndpoint) {
    return configuredEndpoint;
  }

  return 'https://erpnext.aurora-tech.com';
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

export {
  API_ENDPOINT,
  DEFAULT_TIMEZONE,
  DOCUMENT_EDITOR_ENGINE,
  TECH_CONFIG_VARIABLE_ENABLED,
  DOCUMENT_DOCX_PREVIEW_EDITOR,
  CURRENCY_ENABLE_COMPACT,
  ALLOW_EDIT_ALL_STATUS,
};
