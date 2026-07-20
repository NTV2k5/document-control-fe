import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { profileStore, updateProfileAction } from 'reactjs-platform/utilities';
import { ProfileHeader } from './profile-header';
import { PersonalInfoForm } from './personal-info-form';
import { StorageAnalytics } from './storage-analytics';
import { RecentActivity } from './recent-activity';
import { ChangePasswordCard } from './change-password-card';
import type { IPersonalInfoFormState } from './profile.type';
import { getProfileDashboardAPI, updateProfileAPI, type IProfileDashboardData } from 'api';

export const ProfileSection = () => {
  const profile = profileStore((state) => state.profile);
  const [isSaving, setIsSaving] = useState(false);
  const [dashboardData, setDashboardData] = useState<IProfileDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getProfileDashboardAPI();
      setDashboardData(data);
    } catch (error) {
      console.error('Failed to load profile dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleSaveProfile = async (formData: IPersonalInfoFormState) => {
    if (!profile) {
      toast.error('No active user session found.');
      return;
    }

    setIsSaving(true);
    try {
      await updateProfileAPI({
        bio: formData.bio,
        first_name: formData.first_name,
        last_name: formData.last_name,
      });

      const updatedDashboard = await getProfileDashboardAPI();
      setDashboardData(updatedDashboard);

      const updatedProfile = {
        ...profile,
        first_name: formData.first_name,
        last_name: formData.last_name,
        expertise: [formData.bio],
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
  const storageData = dashboardData
    ? {
        usedStorageTb: dashboardData.storage.used_bytes / (1024 * 1024 * 1024 * 1024),
        totalStorageTb: dashboardData.storage.limit_bytes / (1024 * 1024 * 1024 * 1024),
        documentsPercent: dashboardData.storage.categories.documents.percentage,
        mediaPercent: dashboardData.storage.categories.media.percentage,
        documentsTb: dashboardData.storage.categories.documents.bytes / (1024 * 1024 * 1024 * 1024),
        mediaTb: dashboardData.storage.categories.media.bytes / (1024 * 1024 * 1024 * 1024),
      }
    : {
        usedStorageTb: 4.2,
        totalStorageTb: 10,
        documentsPercent: 65,
        mediaPercent: 35,
        documentsTb: 2.8,
        mediaTb: 1.4,
      };

  // Dynamic recent activities
  const activities = dashboardData
    ? dashboardData.recent_activity.map((item, idx) => ({
        id: String(idx),
        type: item.type.toLowerCase() === 'security' ? ('security' as const) : ('document' as const),
        title: item.title,
        timestamp: `${item.time} • ${item.type}`,
        iconName: item.icon === 'security' ? ('shield' as const) : ('document' as const),
      }))
    : [
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
      ];

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

  const activeProfile = profile
    ? {
        ...profile,
        first_name: dashboardData?.user_info.first_name ?? profile.first_name,
        last_name: dashboardData?.user_info.last_name ?? profile.last_name ?? '',
        phone_number: dashboardData?.user_info.phone ?? profile.phone_number,
        job: dashboardData?.user_info.role ?? profile.job,
        expertise: dashboardData?.user_info.bio ? [dashboardData.user_info.bio] : profile.expertise,
        profile_url: dashboardData?.user_info.user_image ?? profile.profile_url,
      }
    : (dashboardData
        ? {
            id: dashboardData.user_info.employee_id,
            username: dashboardData.user_info.email.split('@')[0],
            email: dashboardData.user_info.email,
            first_name: dashboardData.user_info.first_name,
            last_name: dashboardData.user_info.last_name ?? '',
            phone_number: dashboardData.user_info.phone ?? '',
            user_type: 1,
            job: dashboardData.user_info.role ?? '',
            expertise: [dashboardData.user_info.bio ?? ''],
            profile_url: dashboardData.user_info.user_image ?? '',
            permission_codes: [],
            scope_assignments: [],
          }
        : defaultProfile);

  return (
    <div className="space-y-6 pb-12">
      {/* Breadcrumbs and Title */}
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold text-slate-900">My Profile</h2>
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
