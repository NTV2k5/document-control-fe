import type { IUserProfileStore } from './user-profile.types';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const profileStore = create<IUserProfileStore>()(
  persist(
    (_) => ({
      profile: null,
      isFetchingProfile: false,
      fetchProfileError: null,
    }),
    {
      name: 'profile-storage',
      partialize: (state) => ({
        profile: state.profile,
        isFetchingProfile: state.isFetchingProfile,
        fetchProfileError: state.fetchProfileError,
      }),
    },
  ),
);
