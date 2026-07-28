import { FileText, FileSpreadsheet, FileImage, FileVideo, Presentation, File, Scale, ShieldUser } from 'lucide-react';
import { Badge, Card, CardContent } from 'reactjs-platform/ui';
import { useTranslation } from '../../../i18n';

type LatestPublishedProps = {
  docs: {
    id: string | number;
    type: string;
    title: string;
    description: string;
    creator: string;
    date: string;
    downloads?: number;
    views?: number;
  }[];
  onItemClick?: (id: string) => void;
};

export function LatestPublished({ docs, onItemClick }: LatestPublishedProps) {
  const { locale } = useTranslation();

  const getBadgeClasses = (type: string) => {
    const t = type.toUpperCase();
    if (t === 'PDF') return 'bg-red-100 text-red-600 hover:bg-red-100 shadow-[0_2px_8px_rgba(239,68,68,0.2)]';
    if (t === 'VIDEO') return 'bg-purple-100 text-purple-600 hover:bg-purple-100 shadow-[0_2px_8px_rgba(147,51,234,0.2)]';
    if (t === 'IMAGE') return 'bg-amber-100 text-amber-600 hover:bg-amber-100 shadow-[0_2px_8px_rgba(245,158,11,0.2)]';
    if (t === 'SPREADSHEET' || t === 'EXCEL') return 'bg-emerald-100 text-emerald-600 hover:bg-emerald-100 shadow-[0_2px_8px_rgba(16,185,129,0.2)]';
    if (t === 'PRESENTATION' || t === 'POWERPOINT') return 'bg-orange-100 text-orange-600 hover:bg-orange-100 shadow-[0_2px_8px_rgba(249,115,22,0.2)]';
    if (t === 'TEXT') return 'bg-green-100 text-green-600 hover:bg-green-100 shadow-[0_2px_8px_rgba(34,197,94,0.25)]';
    if (t === 'REGULATION') return 'bg-blue-100 text-blue-600 hover:bg-blue-100 shadow-[0_2px_8px_rgba(37,99,235,0.25)]';
    if (t === 'POLICY') return 'bg-cyan-100 text-cyan-600 hover:bg-cyan-100 shadow-[0_2px_8px_rgba(6,182,212,0.25)]';
    return 'bg-slate-100 text-slate-600 hover:bg-slate-100 shadow-[0_2px_8px_rgba(100,116,139,0.15)]';
  };

  const getIcon = (type: string) => {
    const t = type.toUpperCase();
    if (t === 'PDF' || t === 'DOCUMENT' || t === 'WORD') return <FileText className="h-5 w-5 text-red-500" />;
    if (t === 'VIDEO') return <FileVideo className="h-5 w-5 text-purple-500" />;
    if (t === 'IMAGE') return <FileImage className="h-5 w-5 text-amber-500" />;
    if (t === 'SPREADSHEET' || t === 'EXCEL') return <FileSpreadsheet className="h-5 w-5 text-emerald-500" />;
    if (t === 'PRESENTATION' || t === 'POWERPOINT') return <Presentation className="h-5 w-5 text-orange-500" />;
    if (t === 'TEXT') return <FileText className="h-5 w-5 text-green-500" />;
    if (t === 'REGULATION') return <Scale className="h-5 w-5 text-blue-500" />;
    if (t === 'POLICY') return <ShieldUser className="h-5 w-5 text-cyan-500" />;
    return <File className="h-5 w-5 text-slate-500" />;
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between px-1">
        <h3 className="text-xl font-bold text-slate-900">
          {locale === 'vi' ? 'Xuất bản mới nhất' : 'Latest Published'}
        </h3>
        <button className="text-sm font-bold text-blue-600 hover:underline">
          {locale === 'vi' ? 'Xem tất cả tài liệu' : 'View All Documents'}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {docs.map((doc) => (
          <Card
            key={doc.id}
            onClick={() => onItemClick?.(String(doc.id))}
            className="cursor-pointer rounded-2xl border-none shadow-sm ring-1 ring-slate-100 transition-all hover:shadow-md hover:ring-slate-200"
          >
            <CardContent className="p-6">
              <div className="mb-4 flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                  {getIcon(doc.type)}
                </div>
                <Badge
                  variant="secondary"
                  className={`px-3 py-1 text-[10px] font-bold tracking-wider uppercase border-transparent ${getBadgeClasses(doc.type)}`}
                >
                  {doc.type}
                </Badge>
              </div>
              <h4 className="mb-2 text-base font-bold text-slate-900 truncate" title={doc.title}>
                {doc.title}
              </h4>
              <p className="mb-6 line-clamp-2 text-sm leading-relaxed font-medium text-slate-500/80">
                {doc.description}
              </p>
              <div className="flex items-center justify-between border-t border-slate-100 pt-5 text-xs font-bold text-slate-500">
                <div className="flex items-center gap-2">
                  <img
                    src={`https://i.pravatar.cc/150?u=${doc.creator}`}
                    alt={doc.creator}
                    width={24}
                    height={24}
                    className="h-6 w-6 rounded-full object-cover"
                  />
                  <span>{doc.creator}</span>
                </div>
                <span>{doc.date}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
