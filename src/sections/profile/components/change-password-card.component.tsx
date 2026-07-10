import { Key, ChevronRight } from 'lucide-react';
import { Link } from '@tanstack/react-router';

export const ChangePasswordCard = () => {
  return (
    <Link
      to="/change-password"
      className="flex items-center justify-between rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all hover:border-blue-100 hover:shadow-md hover:translate-y-[-1px] group cursor-pointer"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-[#F8F9FC] text-slate-500 border border-slate-50 group-hover:bg-[#EEF2FF] group-hover:text-[#1B59F8] group-hover:border-blue-100/30 transition-colors">
          <Key className="size-4.5" />
        </div>
        <span className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
          Change Password
        </span>
      </div>
      <ChevronRight className="size-4.5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
    </Link>
  );
};
