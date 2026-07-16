import { PublicClientApplication, type Configuration } from '@azure/msal-browser';
import { MSAL_CLIENT_ID, MSAL_TENANT_ID, MSAL_REDIRECT_URI } from '../constants';

const msalConfig: Configuration = {
  auth: {
    clientId: MSAL_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${MSAL_TENANT_ID}`,
    redirectUri: MSAL_REDIRECT_URI,
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);

let initPromise: Promise<void> | null = null;

export const initMsal = (): Promise<void> => {
  if (!initPromise) {
    initPromise = msalInstance.initialize().catch((err) => {
      console.error('Failed to initialize MSAL:', err);
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
};
