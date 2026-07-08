import { ShieldAlert, ChevronRight } from 'lucide-react';
import { Badge } from 'reactjs-platform/ui';

export function ImportantAlert() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
          <span className="text-red-500">!</span> Important - Unread
        </h3>
        <Badge
          variant="destructive"
          className="bg-red-100 px-3 py-1 text-xs font-bold text-red-600 shadow-none hover:bg-red-100"
        >
          3 Urgent Actions
        </Badge>
      </div>

      <div className="flex cursor-pointer items-center justify-between rounded-xl border border-red-100 bg-red-50/80 p-5 transition-colors hover:bg-red-100/50">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500 text-white shadow-sm">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-bold text-red-900">Updated Cybersecurity Protocols v2.4</h4>
            <p className="mt-0.5 text-sm font-medium text-red-700/80">
              Action Required: Digital signature required by end of week.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm font-bold text-red-500">
          <span>2h ago</span>
          <ChevronRight className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
