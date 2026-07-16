import type { ILoginFormModel, ISignInSearchParams, ISignInSectionProps } from './login.type';
import {
  CoreAuthenticationStore,
  exchangeMicrosoftOAuthCodeAPI,
  useLogin,
  msalInstance,
  initMsal,
  MSAL_REDIRECT_URI,
} from 'reactjs-platform/utilities';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Eye, EyeOff } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { LanguageSwitcher } from '../../components/i18n';
import { useTranslation } from '../../i18n';

const MICROSOFT_OAUTH_STATE_STORAGE_KEY = 'document-portal:microsoft-oauth-state';
const OAUTH_CALLBACK_QUERY_KEYS = ['code', 'state', 'session_state', 'iss', 'error', 'error_description'];

interface IMicrosoftOAuthSession {
  backUrl?: string;
  codeVerifier: string;
  state: string;
}

const MicrosoftBrandIcon = () => (
  <span aria-hidden className="grid size-4 grid-cols-2 gap-0.5">
    <span className="bg-[#f25022]" />
    <span className="bg-[#7fba00]" />
    <span className="bg-[#00a4ef]" />
    <span className="bg-[#ffb900]" />
  </span>
);

const base64UrlEncode = (bytes: Uint8Array) => {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const createRandomString = () => {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
};


const readMicrosoftOAuthSession = (): IMicrosoftOAuthSession | null => {
  const rawValue = window.sessionStorage.getItem(MICROSOFT_OAUTH_STATE_STORAGE_KEY);
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as Partial<IMicrosoftOAuthSession>;
    if (!parsed.state || parsed.codeVerifier === undefined) return null;
    return {
      backUrl: parsed.backUrl,
      codeVerifier: parsed.codeVerifier,
      state: parsed.state,
    };
  } catch {
    return null;
  }
};

const clearOAuthCallbackParams = () => {
  const url = new URL(window.location.href);
  OAUTH_CALLBACK_QUERY_KEYS.forEach((key) => {
    url.searchParams.delete(key);
  });
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
};

const getMsalCodeVerifier = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (key && key.includes('pkce.verifier')) {
        const val = window.sessionStorage.getItem(key);
        if (val) return val;
      }
    }
  } catch (error) {
    console.error('Error reading MSAL verifier from sessionStorage:', error);
  }
  return null;
};

const clearMsalStorage = () => {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (key && (key.includes('msal.') || key.includes('cc.msal.'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => window.sessionStorage.removeItem(key));
  } catch (error) {
    console.error('Error clearing MSAL storage:', error);
  }
};

export const SignInSection: React.FC<ISignInSectionProps> = () => {
  const { t } = useTranslation();
  const { handleLogin, isLoading } = useLogin();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as ISignInSearchParams;

  const [showPassword, setShowPassword] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);
  const oauthCallbackHandledRef = useRef(false);
  const isBusy = isLoading || isOAuthLoading;

  const {
    handleSubmit,
    register,
    formState: { errors: _errors },
  } = useForm<ILoginFormModel>({
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
    defaultValues: {},
  });

  const navigateAfterLogin = useCallback(
    (backUrl?: string) => {
      if (backUrl) {
        try {
          const decodedUrl = decodeURIComponent(backUrl);
          navigate({ to: decodedUrl as never });
          return;
        } catch (error) {
          console.error(t('auth.login.decodeBackUrlError'), error);
        }
      }

      navigate({ to: '/home' as never, replace: true });
    },
    [navigate, t],
  );

  const handleSubmitLogin = async (values: ILoginFormModel) => {
    const loginSuccess = await handleLogin(values.username ?? '', values.password ?? '');

    if (loginSuccess) {
      navigateAfterLogin(search?.backUrl);
      return;
    }

    toast.error(CoreAuthenticationStore.getLoginError() || t('auth.login.invalidCredentials'));
  };

  const handleMicrosoftLogin = async () => {
    setIsOAuthLoading(true);

    try {
      await initMsal();

      const state = createRandomString();

      window.sessionStorage.setItem(
        MICROSOFT_OAUTH_STATE_STORAGE_KEY,
        JSON.stringify({
          backUrl: search?.backUrl,
          codeVerifier: '',
          state,
        } satisfies IMicrosoftOAuthSession),
      );

      await msalInstance.loginRedirect({
        scopes: ['openid', 'profile', 'user.read'],
        state,
      });
    } catch (error) {
      console.error(t('auth.login.oauthStartFailed'), error);
      window.sessionStorage.removeItem(MICROSOFT_OAUTH_STATE_STORAGE_KEY);
      clearMsalStorage();
      toast.error(t('auth.login.oauthStartFailed'));
      setIsOAuthLoading(false);
    }
  };

  useEffect(() => {
    if (oauthCallbackHandledRef.current) return;
    if (!search?.code && !search?.error) return;

    oauthCallbackHandledRef.current = true;

    const completeMicrosoftOAuth = async () => {
      setIsOAuthLoading(true);

      try {
        if (search.error) {
          toast.error(search.error_description || t('auth.login.oauthFailed'));
          return;
        }

        const session = readMicrosoftOAuthSession();
        if (!session || !search.state || session.state !== search.state) {
          toast.error(t('auth.login.oauthStateInvalid'));
          return;
        }

        if (!search.code) {
          toast.error(t('auth.login.oauthFailed'));
          return;
        }

        const msalVerifier = getMsalCodeVerifier();
        if (!msalVerifier) {
          console.error('MSAL code verifier not found in storage');
          toast.error(t('auth.login.oauthStateInvalid'));
          return;
        }

        const tokens = await exchangeMicrosoftOAuthCodeAPI({
          code: search.code,
          code_verifier: msalVerifier,
          redirect_uri: MSAL_REDIRECT_URI,
        });

        const loginSuccess = await CoreAuthenticationStore.loginActionNoAPI({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
        });

        if (loginSuccess) {
          navigateAfterLogin(session.backUrl);
          return;
        }

        toast.error(t('auth.login.oauthFailed'));
      } catch (error) {
        console.error(t('auth.login.oauthFailed'), error);
        toast.error(t('auth.login.oauthFailed'));
      } finally {
        window.sessionStorage.removeItem(MICROSOFT_OAUTH_STATE_STORAGE_KEY);
        clearMsalStorage();
        clearOAuthCallbackParams();
        setIsOAuthLoading(false);
      }
    };

    void completeMicrosoftOAuth();
  }, [navigateAfterLogin, search?.code, search?.error, search?.error_description, search?.state, t]);

  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-50">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className="flex w-full max-w-[380px] flex-1 flex-col items-center justify-center px-4 pt-10">
        <div className="mb-2 text-center">
          <img
            src="/gdu/logo/vertical-logo-text.png"
            alt="Gia Dinh University"
            width={130}
            className="mx-auto mb-4 h-auto w-[130px]"
          />
        </div>

        <div className="w-full rounded-[28px] border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-center font-serif text-[30px] text-[#001B44]">{t('auth.login.title')}</h2>

          <form onSubmit={handleSubmit(handleSubmitLogin)} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="username" className="block text-sm font-medium text-[#001B44]">
                {t('auth.login.username')}
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                {...register('username', { required: t('auth.login.usernameRequired') })}
                placeholder={t('auth.login.usernamePlaceholder')}
                readOnly={isBusy}
                className="h-11 w-full rounded-lg border border-gray-200 px-4 text-sm text-gray-600 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#001B44]"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-[#001B44]">
                {t('auth.login.password')}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  {...register('password', {
                    required: t('auth.login.passwordRequired'),
                    minLength: {
                      value: 6,
                      message: t('auth.login.passwordMinLength'),
                    },
                  })}
                  placeholder={t('auth.login.passwordPlaceholder')}
                  readOnly={isBusy}
                  className="h-11 w-full rounded-lg border border-gray-200 px-4 pr-11 text-sm text-gray-600 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#001B44]"
                />
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-60">
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="flex w-full justify-center pt-1">
              <button
                type="submit"
                disabled={isBusy}
                className="mx-auto flex items-center justify-center gap-2 rounded-full bg-[#002B5B] px-10 py-2 text-white transition-colors hover:bg-[#002B5B]/90 disabled:opacity-60">
                {isLoading ? (
                  <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <span className="text-sm">{t('auth.login.submit')}</span>
                )}
              </button>
            </div>
          </form>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-medium text-gray-400">{t('auth.login.or')}</span>
            <span className="h-px flex-1 bg-gray-200" />
          </div>

          <button
            type="button"
            disabled={isBusy}
            onClick={handleMicrosoftLogin}
            className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-[#001B44] transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60">
            {isOAuthLoading ? (
              <span className="size-4 animate-spin rounded-full border-2 border-[#001B44] border-t-transparent" />
            ) : (
              <>
                <MicrosoftBrandIcon />
                <span>{t('auth.login.microsoftSubmit')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="py-6">
        <img src="/gdu/logo/logo-icon.png" alt="Gia Dinh University" width={80} className="h-auto" />
      </div>
    </div>
  );
};
