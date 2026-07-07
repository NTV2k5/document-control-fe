import type { IUserProfile } from 'reactjs-platform/utilities/models';
import { profileStore } from '../user-profile.store';

export const updateProfileAction = async (profile: IUserProfile | undefined): Promise<void> => {
  profileStore.setState({ profile });
};
