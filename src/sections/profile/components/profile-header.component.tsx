import type { IProfileHeaderProps } from '../profile.type';
import { Mail, Phone, Building2, MapPin, Camera } from 'lucide-react';

export const ProfileHeader = ({ profile, onAvatarClick }: IProfileHeaderProps) => {
  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Dr. Sarah Jenkins';
  const jobTitle = profile.job || 'Dean of Information Systems';
  const email = profile.email || 'tam.nguyen@giadinh.edu.vn';
  const phoneNumber = profile.phone_number || '+84 982 727 272';
  const department = 'Information Management Dept.';
  const location = 'Main Campus, Building A';

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
      {/* Background soft glow decoration */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 h-40 w-40 rounded-full bg-blue-500/5 blur-3xl" />
      <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-40 w-40 rounded-full bg-violet-500/5 blur-3xl" />

      <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-start md:gap-8">
        {/* Avatar container */}
        <div className="relative shrink-0">
          <div className="h-28 w-28 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 shadow-md md:h-32 md:w-32">
            <img
              src={profile.profile_url || 'https://i.pravatar.cc/150?u=a042581f4e29026024d'}
              alt="Avatar"
              className="h-full w-full object-cover"
            />
          </div>
          <button
            onClick={onAvatarClick}
            type="button"
            className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white shadow-md transition-all hover:bg-blue-700 hover:scale-105"
            title="Edit Profile Picture"
          >
            <Camera className="size-4" />
          </button>
        </div>

        {/* Info detail block */}
        <div className="flex-1 text-center sm:text-left">
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <h2 className="text-xl font-bold text-slate-900 md:text-2xl">{fullName}</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">{jobTitle}</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </div>
          </div>

          {/* Quick info list */}
          <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-3.5 text-sm text-slate-600 sm:grid-cols-2">
            <div className="flex items-center justify-center gap-2.5 sm:justify-start">
              <Mail className="size-4 text-blue-500 shrink-0" />
              <span className="truncate hover:text-slate-900 transition-colors">{email}</span>
            </div>
            <div className="flex items-center justify-center gap-2.5 sm:justify-start">
              <Building2 className="size-4 text-blue-500 shrink-0" />
              <span className="truncate">{department}</span>
            </div>
            <div className="flex items-center justify-center gap-2.5 sm:justify-start">
              <Phone className="size-4 text-blue-500 shrink-0" />
              <span>{phoneNumber}</span>
            </div>
            <div className="flex items-center justify-center gap-2.5 sm:justify-start">
              <MapPin className="size-4 text-blue-500 shrink-0" />
              <span className="truncate">{location}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
