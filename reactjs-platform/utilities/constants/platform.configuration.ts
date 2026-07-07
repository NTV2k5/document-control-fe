const getClientEnv = (value: string | undefined, fallback: string) => {
  return value && value.trim().length > 0 ? value : fallback;
};

const getApiEndpoint = () => {
  const configuredEndpoint = import.meta.env.VITE_API_ENDPOINT?.trim();

  if (configuredEndpoint) {
    return configuredEndpoint;
  }

  if (import.meta.env.DEV) {
    return 'http://localhost:4002';
  }

  throw new Error('Missing VITE_API_ENDPOINT at build time');
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
