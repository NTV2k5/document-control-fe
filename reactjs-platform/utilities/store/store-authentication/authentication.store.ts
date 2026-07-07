import type { IAuthenticationStore } from './authentication.types';
import { CONFIGURATION } from 'reactjs-platform/utilities/constants';
import { CookieService } from 'reactjs-platform/utilities/cookie-storage/cookie-storage.service';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const inBrowser = typeof window !== 'undefined';

export const authenticationStore = create<IAuthenticationStore>()(
  persist(
    (set, _) => ({
      isFetchingAuthentication: false,
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      fetchingAuthenticationError: null,
      hydrateFromCookies: () => {
        if (!inBrowser) {
          return;
        }
        const at = CookieService.getItem<string>(CONFIGURATION.ACCESS_TOKEN_LS_KEY) || null;
        const rt = CookieService.getItem<string>(CONFIGURATION.REFRESH_TOKEN_LS_KEY) || null;
        set({ accessToken: at, refreshToken: rt, isAuthenticated: !!at });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);

// import { CookieService } from 'reactjs-platform/utilities';
// import type { IAuthenticationStore } from './authentication.types';
// import { CONFIGURATION } from 'reactjs-platform/utilities/constants';
// import { create } from 'zustand';
// import { persist } from 'zustand/middleware';

// export const authenticationStore = create<
//   IAuthenticationStore
// >()(
//   persist(
//     _ => ({
//       isFetchingAuthentication: false,
//       isAuthenticated: false,
//       accessToken: CookieService.getItem(CONFIGURATION.ACCESS_TOKEN_LS_KEY) || null,
//       refreshToken: CookieService.getItem(CONFIGURATION.REFRESH_TOKEN_LS_KEY) || null,
//       fetchingAuthenticationError: null,
//     }),
//     {
//       name: 'auth-storage',
//       partialize: state => ({
//         accessToken: state.accessToken,
//         isAuthenticated: state.isAuthenticated,
//       }),
//     },
//   ),
// );
