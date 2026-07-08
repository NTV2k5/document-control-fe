import { Globe, FileText, UploadCloud } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { Card, CardContent } from 'reactjs-platform/ui';

type QuickAccessItem = {
  icon: React.ReactNode;
  label: string;
  description: string;
  href: string;
  iconBg: string;
  iconColor: string;
};

const QUICK_ACCESS_ITEMS: QuickAccessItem[] = [
  {
    icon: <Globe className="h-6 w-6" strokeWidth={2.5} />,
    label: 'Published',
    description: 'Public institutional records',
    href: '/documents',
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
  },
  {
    icon: <FileText className="h-6 w-6" strokeWidth={2.5} />,
    label: 'My Documents',
    description: 'Personal draft documents',
    href: '/documents',
    iconBg: 'bg-fuchsia-50',
    iconColor: 'text-fuchsia-600',
  },
  {
    icon: <UploadCloud className="h-6 w-6" strokeWidth={2.5} />,
    label: 'Upload New',
    description: 'Submit for control approval',
    href: '/documents/new',
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
  },
];

export function QuickAccess() {
  const navigate = useNavigate();

  return (
    <div>
      <h3 className="mb-4 text-lg font-bold text-slate-900">Quick Access</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK_ACCESS_ITEMS.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => navigate({ to: item.href as never })}
            className="group rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-md hover:border-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <div
              className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${item.iconBg} ${item.iconColor} transition-transform group-hover:scale-105`}
            >
              {item.icon}
            </div>
            <h4 className="text-sm font-bold text-slate-900">{item.label}</h4>
            <p className="mt-1 text-xs font-medium text-slate-500">{item.description}</p>
          </button>
        ))}

        {/* Help Card */}
        <div className="rounded-2xl bg-violet-600 p-5 text-white shadow-md transition-all hover:-translate-y-1 hover:shadow-lg">
          <h4 className="mb-1.5 text-base font-bold">Need Help?</h4>
          <p className="mb-4 text-xs leading-relaxed font-medium text-violet-200">
            Our support team is available 24/7 for technical assistance.
          </p>
          <button
            type="button"
            onClick={() => navigate({ to: '/dashboard/tickets' as never })}
            className="self-start rounded-full bg-white px-5 py-2 text-sm font-bold text-violet-700 shadow-sm transition-colors hover:bg-violet-50"
          >
            Open Ticket
          </button>
        </div>
      </div>
    </div>
  );
}
