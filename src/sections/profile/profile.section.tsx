import { useState } from 'react';
import { toast } from 'react-toastify';
import { profileStore, updateProfileAction } from 'reactjs-platform/utilities';
import {
  ProfileHeader,
  PersonalInfoForm,
  StorageAnalytics,
  RecentActivity,
  ChangePasswordCard,
} from './components';
import type { IPersonalInfoFormState } from './profile.type';

export const ProfileSection = () => {
  const profile = profileStore((state) => state.profile);
  const [isSaving, setIsSaving] = useState(false);
  const [storageStats] = useState({
    documentsTb: 2.8,
    mediaAssetsTb: 1.4,
    totalStorageTb: 10,
  });

  const usedStorageTb = Number((storageStats.documentsTb + storageStats.mediaAssetsTb).toFixed(1));
  const documentsPercent = Math.round((storageStats.documentsTb / usedStorageTb) * 100);
  const mediaPercent = 100 - documentsPercent;

  const handleSaveProfile = async (formData: IPersonalInfoFormState) => {
    if (!profile) {
      toast.error('No active user session found.');
      return;
    }

    setIsSaving(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 800));

      const updatedProfile = {
        ...profile,
        first_name: formData.first_name,
        last_name: formData.last_name,
        expertise: [formData.bio], // Storing bio inside the first element of expertise
      };

      await updateProfileAction(updatedProfile);
      
      toast.success('Profile updated successfully!', {
        position: 'top-right',
        autoClose: 3000,
      });
    } catch (error) {
      console.error(error);
      toast.error('Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarClick = () => {
    toast.info('Profile picture upload feature is simulated in the development environment.', {
      position: 'top-right',
      autoClose: 4000,
    });
  };

  // Fallback profile if user is not logged in or profile is empty
  const defaultProfile = {
    id: 'EMP-2025-0982',
    username: 'sarah.jenkins',
    email: 'tam.nguyen@giadinh.edu.vn',
    first_name: 'Sarah',
    last_name: 'Jenkins',
    phone_number: '+84 982 727 272',
    user_type: 2,
    job: 'Dean of Information Systems',
    expertise: [
      'Seasoned Dean with over 15 years of experience in higher education data governance and information systems management. Leading the digital transformation initiative at University Central.',
    ],
    profile_url: 'https://i.pravatar.cc/150?u=a042581f4e29026024d',
    permission_codes: [],
    scope_assignments: [],
  };

  const activeProfile = profile || defaultProfile;

  return (
    <div className="space-y-6 pb-12">
      {/* Breadcrumbs and Title */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-slate-900">My Profile</h1>
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Dashboard &gt; Account Settings
        </div>
      </div>

      {/* Grid layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column (2/3 width) */}
        <div className="space-y-6 lg:col-span-2">
          <ProfileHeader profile={activeProfile} onAvatarClick={handleAvatarClick} />
          <PersonalInfoForm
            profile={activeProfile}
            onSave={handleSaveProfile}
            isSaving={isSaving}
          />
        </div>

        {/* Right Column (1/3 width) */}
        <div className="space-y-6 lg:col-span-1">
          <StorageAnalytics
            usedStorageTb={usedStorageTb}
            totalStorageTb={storageStats.totalStorageTb}
            documentsPercent={documentsPercent}
            mediaPercent={mediaPercent}
            documentsTb={storageStats.documentsTb}
            mediaAssetsTb={storageStats.mediaAssetsTb}
          />
          <RecentActivity />
          <ChangePasswordCard />
        </div>
      </div>
    </div>
  );
};
