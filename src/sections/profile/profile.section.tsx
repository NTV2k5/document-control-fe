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
    // Hidden file input is clicked internally in ProfileHeader
  };

  const handleAvatarChange = async (url: string) => {
    try {
      const updatedProfile = {
        ...activeProfile,
        profile_url: url,
      };
      await updateProfileAction(updatedProfile);
      toast.success('Profile picture updated successfully!', {
        position: 'top-right',
        autoClose: 3000,
      });
    } catch (error) {
      console.error(error);
      toast.error('Failed to update profile picture.');
    }
  };

  // Dynamic storage stats
  const [storageData] = useState({
    usedStorageTb: 4.2,
    totalStorageTb: 10,
    documentsPercent: 65,
    mediaPercent: 35,
    documentsTb: 2.8,
    mediaTb: 1.4,
  });

  // Dynamic recent activities
  const [activities] = useState([
    {
      id: '1',
      type: 'document' as const,
      title: 'Updated "Enrollment_Form_V2"',
      timestamp: '2 hours ago • Document',
      iconName: 'document' as const,
    },
    {
      id: '2',
      type: 'security' as const,
      title: 'Login from New Device',
      timestamp: 'Yesterday at 10:45 AM • Security',
      iconName: 'shield' as const,
    },
    {
      id: '3',
      type: 'security' as const,
      title: 'Password Changed',
      timestamp: 'Oct 24, 2025 • Security',
      iconName: 'lock' as const,
    },
  ]);

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
          <ProfileHeader
            profile={activeProfile}
            onAvatarClick={handleAvatarClick}
            onAvatarChange={handleAvatarChange}
          />
          <PersonalInfoForm
            profile={activeProfile}
            onSave={handleSaveProfile}
            isSaving={isSaving}
          />
        </div>

        {/* Right Column (1/3 width) */}
        <div className="space-y-6 lg:col-span-1">
          <StorageAnalytics
            usedStorageTb={storageData.usedStorageTb}
            totalStorageTb={storageData.totalStorageTb}
            documentsPercent={storageData.documentsPercent}
            mediaPercent={storageData.mediaPercent}
            documentsTb={storageData.documentsTb}
            mediaTb={storageData.mediaTb}
          />
          <RecentActivity activities={activities} />
          <ChangePasswordCard />
        </div>
      </div>
    </div>
  );
};
