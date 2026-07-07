import type { IUserProfile } from 'reactjs-platform/utilities/models';

export interface IUserProfileStore {
  profile: IUserProfile | null;
  isFetchingProfile: boolean;
  fetchProfileError: string | null;
}
