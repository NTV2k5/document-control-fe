import {
  History,
  MoreHorizontal,
  FileText,
  Database,
  File,
  Image as ImageIcon,
  Video,
} from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';

type RecentlyInteractedProps = {
  docs: {
    id: string | number;
    type: string;
    title: string;
    description: string;
    edited: string;
  }[];
};

const getDocTypeStyle = (type: string) => {
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    WORD: { bg: 'bg-blue-50', text: 'text-blue-600', label: 'WORD' },
    EXCEL: { bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'EXCEL' },
    PDF: { bg: 'bg-red-50', text: 'text-red-500', label: 'PDF' },
    IMAGE: { bg: 'bg-green-50', text: 'text-green-600', label: 'IMAGE' },
    VIDEO: { bg: 'bg-purple-50', text: 'text-purple-600', label: 'VIDEO' },
    TXT: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'TXT' },
  };
  return styles[type] ?? { bg: 'bg-slate-50', text: 'text-slate-500', label: type };
};

const getDocIcon = (type: string, className: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    WORD: <FileText className={className} />,
    EXCEL: <Database className={className} />,
    PDF: <File className={className} />,
    IMAGE: <ImageIcon className={className} />,
    VIDEO: <Video className={className} />,
    TXT: <FileText className={className} />,
  };
  return iconMap[type] ?? <File className={className} />;
};

export function RecentlyInteracted({ docs }: RecentlyInteractedProps) {
  const navigate = useNavigate();

  return (
    <div>
      {/* Header row */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <History className="h-5 w-5 text-blue-600" strokeWidth={2.5} />
          Recently Interacted
        </h3>
        <button
          type="button"
          onClick={() => navigate({ to: '/documents' })}
          className="text-sm font-bold text-blue-600 hover:underline"
        >
          View History
        </button>
      </div>

      {/* Horizontal scrollable cards */}
      <div className="flex gap-4 overflow-x-auto pb-3" style={{ scrollbarWidth: 'none' }}>
        {docs.map((doc) => {
          const style = getDocTypeStyle(doc.type);
          return (
            <div
              key={doc.id}
              onClick={() => navigate({ to: '/documents' })}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && navigate({ to: '/documents' })}
              className="group relative w-[250px] min-w-[190px] shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
            >
              {/* Colored top area with badge + icon inside */}
              <div className={`relative ${style.bg} px-4 pt-3 pb-5`}>
                <div className="flex items-start justify-between">
                  {/* Type badge */}
                  <span
                    className="rounded-md bg-white px-2 py-0.5 text-[9px] font-black tracking-widest shadow-sm text-slate-800"
                  >
                    {style.label}
                  </span>
                  {/* Actions */}
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-white/60 text-slate-400 transition-colors hover:bg-white hover:text-slate-600"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </div>
                {/* Doc icon — inside colored area, below badge */}
                <div className="mt-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-md">
                  {getDocIcon(doc.type, `h-5 w-5 ${style.text}`)}
                </div>
              </div>

              {/* Card body */}
              <div className="px-4 pt-4 pb-3">
                <h4 className="mb-1 text-[13px] leading-snug font-bold text-slate-900 line-clamp-2">
                  {doc.title}
                </h4>
                <p className="mb-3 text-[11px] leading-relaxed text-slate-500 line-clamp-2">
                  {doc.description}
                </p>
                <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
                  <p className="text-[10px] font-semibold text-slate-400">Edited {doc.edited}</p>
                  {/* User avatars */}
                  <div className="flex -space-x-1.5">
                    {[1, 2, 3].map((i) => (
                      <img
                        key={i}
                        src={`https://i.pravatar.cc/150?u=${doc.id}${i}`}
                        alt={`User ${i}`}
                        className="h-5 w-5 rounded-full border-[1.5px] border-white object-cover shadow-sm"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
