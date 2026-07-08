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
    WORD: { bg: 'bg-gradient-to-br from-blue-50 to-blue-100/60', text: 'text-blue-600', label: 'WORD' },
    EXCEL: { bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100/60', text: 'text-emerald-600', label: 'EXCEL' },
    PDF: { bg: 'bg-gradient-to-br from-red-50 to-red-100/60', text: 'text-red-500', label: 'PDF' },
    IMAGE: { bg: 'bg-gradient-to-br from-green-50 to-green-100/60', text: 'text-green-600', label: 'IMAGE' },
    VIDEO: { bg: 'bg-gradient-to-br from-purple-50 to-purple-100/60', text: 'text-purple-600', label: 'VIDEO' },
  };
  return styles[type] ?? { bg: 'bg-gradient-to-br from-slate-50 to-slate-100/60', text: 'text-slate-500', label: type };
};

const getDocIcon = (type: string, className: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    WORD: <FileText className={className} />,
    EXCEL: <Database className={className} />,
    PDF: <File className={className} />,
    IMAGE: <ImageIcon className={className} />,
    VIDEO: <Video className={className} />,
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
              className="group relative w-[220px] shrink-0 cursor-pointer overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
            >
              {/* Colored top area */}
              <div className={`relative h-[110px] ${style.bg} p-4`}>
                <div className="flex items-start justify-between">
                  {/* Type badge */}
                  <span
                    className={`rounded-lg bg-white px-2.5 py-1 text-[9px] font-black tracking-widest shadow-sm ${style.text}`}
                  >
                    {style.label}
                  </span>
                  {/* Actions */}
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white/60 text-slate-500 transition-colors hover:bg-white"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
                {/* Doc icon floating */}
                <div className="absolute -bottom-6 left-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-[0_8px_16px_rgba(0,0,0,0.06)] ring-1 ring-slate-100/10">
                  {getDocIcon(doc.type, `h-7 w-7 ${style.text}`)}
                </div>
              </div>

              {/* Card body */}
              <div className="px-5 pt-10 pb-5">
                <h4 className="mb-2 text-[15px] leading-snug font-bold text-slate-900 line-clamp-2">
                  {doc.title}
                </h4>
                <p className="mb-4 text-xs leading-relaxed text-slate-400 line-clamp-2">
                  {doc.description}
                </p>
                <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                  <p className="text-[11px] font-semibold text-slate-400">Edited {doc.edited}</p>
                  {/* Toggle switch - matching Image 2 */}
                  <div className="flex h-[20px] w-[34px] items-center rounded-full bg-slate-200 p-[2px]">
                    <div className="h-[16px] w-[16px] translate-x-[14px] rounded-full bg-white shadow-sm" />
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
