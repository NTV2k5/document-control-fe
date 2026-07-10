import { useState, useEffect } from 'react';
import type { IPersonalInfoFormProps } from '../profile.type';

export const PersonalInfoForm = ({ profile, onSave, isSaving }: IPersonalInfoFormProps) => {
  const [firstName, setFirstName] = useState(profile.first_name || 'Sarah');
  const [lastName, setLastName] = useState(profile.last_name || 'Jenkins');
  const [department, setDepartment] = useState('Information Management');
  const [bio, setBio] = useState(
    profile.expertise?.[0] ||
      'Seasoned Dean with over 15 years of experience in higher education data governance and information systems management. Leading the digital transformation initiative at University Central.'
  );

  // Sync state if profile changes
  useEffect(() => {
    setFirstName(profile.first_name || 'Sarah');
    setLastName(profile.last_name || 'Jenkins');
    if (profile.expertise?.[0]) {
      setBio(profile.expertise[0]);
    }
  }, [profile]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      first_name: firstName,
      last_name: lastName,
      department,
      bio,
    });
  };

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
      {/* Tab bar header */}
      <div className="border-b border-slate-100">
        <nav className="flex space-x-8" aria-label="Tabs">
          <button
            type="button"
            className="border-b-2 border-blue-600 px-1 pb-4 text-sm font-bold text-blue-600"
          >
            Personal Information
          </button>
        </nav>
      </div>

      {/* Form content */}
      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* First Name */}
          <div className="space-y-2">
            <label htmlFor="firstName" className="block text-[10px] font-bold tracking-wider text-blue-900 uppercase">
              First Name
            </label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First Name"
              className="h-11 w-full rounded-xl border border-slate-100 bg-[#F4F7FE] px-4 text-sm text-slate-800 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 transition-all font-medium"
            />
          </div>

          {/* Last Name */}
          <div className="space-y-2">
            <label htmlFor="lastName" className="block text-[10px] font-bold tracking-wider text-blue-900 uppercase">
              Last Name
            </label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last Name"
              className="h-11 w-full rounded-xl border border-slate-100 bg-[#F4F7FE] px-4 text-sm text-slate-800 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 transition-all font-medium"
            />
          </div>

          {/* Employee ID */}
          <div className="space-y-2">
            <label htmlFor="employeeId" className="block text-[10px] font-bold tracking-wider text-blue-900 uppercase">
              Employee ID
            </label>
            <input
              id="employeeId"
              type="text"
              value={profile.id ? `EMP-${profile.id.substring(0, 8).toUpperCase()}` : 'EMP-2025-0982'}
              disabled
              className="h-11 w-full rounded-xl border border-slate-100 bg-[#E9EDF7] px-4 text-sm text-slate-400 cursor-not-allowed font-medium select-all"
            />
          </div>

          {/* Department Select */}
          <div className="space-y-2">
            <label htmlFor="department" className="block text-[10px] font-bold tracking-wider text-blue-900 uppercase">
              Department
            </label>
            <div className="relative">
              <select
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="h-11 w-full appearance-none rounded-xl border border-slate-100 bg-[#F4F7FE] px-4 pr-10 text-sm text-slate-800 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 transition-all font-medium"
              >
                <option value="Information Management">Information Management</option>
                <option value="Information Technology">Information Technology</option>
                <option value="Academic Affairs">Academic Affairs</option>
                <option value="Finance & Planning">Finance & Planning</option>
              </select>
              <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Professional Bio */}
        <div className="space-y-2">
          <label htmlFor="bio" className="block text-[10px] font-bold tracking-wider text-blue-900 uppercase">
            Professional Bio
          </label>
          <textarea
            id="bio"
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full rounded-xl border border-slate-100 bg-[#F4F7FE] p-4 text-sm text-slate-800 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 transition-all font-medium leading-relaxed resize-none"
          />
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center justify-center rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-600/10 hover:bg-blue-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-all cursor-pointer"
          >
            {isSaving ? 'Saving Changes...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};
