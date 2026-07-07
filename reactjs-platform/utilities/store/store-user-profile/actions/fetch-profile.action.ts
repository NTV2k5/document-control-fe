import { fetchUserProfileApi } from 'reactjs-platform/utilities/api';
import { profileStore } from '../user-profile.store';

export const fetchProfileAction = async (): Promise<void> => {
  const setState = profileStore.setState;

  try {
    setState({ isFetchingProfile: true, fetchProfileError: null });

    const profile = await fetchUserProfileApi();

    setState({ profile, isFetchingProfile: false });
  } catch (error: any) {
    setState({
      isFetchingProfile: false,
      fetchProfileError: error?.message || 'Failed to fetch user profile',
    });
  }
};
