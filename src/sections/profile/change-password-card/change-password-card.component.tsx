import { Key, ChevronRight } from 'lucide-react';
import { Link } from '@tanstack/react-router';

export const ChangePasswordCard = () => {
  return (
    <Link
      to="/change-password"
      className="flex items-center justify-between rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:border-blue-100 hover:shadow-md hover:translate-y-[-1px] group cursor-pointer"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-slate-50 text-slate-600 border border-slate-100 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-100/30 transition-colors">
          <Key className="size-4.5" />
        </div>
        <span className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
          Change Password
        </span>
      </div>
      <ChevronRight className="size-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
    </Link>
  );
};
