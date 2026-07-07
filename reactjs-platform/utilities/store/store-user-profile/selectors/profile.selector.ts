import type { IUserProfile } from 'reactjs-platform/utilities/models';
import { profileStore } from '../user-profile.store';

export const getProfileSelector = (): IUserProfile | null => {
  return profileStore().profile;
};
