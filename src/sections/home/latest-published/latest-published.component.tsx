import { Scale, ShieldCheck, TerminalSquare } from 'lucide-react';
import { Badge, Card, CardContent } from 'reactjs-platform/ui';

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
};

export function LatestPublished({ docs }: LatestPublishedProps) {
  const getBadgeClasses = (type: string) => {
    if (type === 'REGULATION') {
      return 'bg-blue-100 text-blue-600 hover:bg-blue-100 shadow-[0_2px_8px_rgba(37,99,235,0.25)]';
    }
    if (type === 'POLICY') {
      return 'bg-cyan-100 text-cyan-600 hover:bg-cyan-100 shadow-[0_2px_8px_rgba(6,182,212,0.25)]';
    }
    return 'bg-green-100 text-green-600 hover:bg-green-100 shadow-[0_2px_8px_rgba(34,197,94,0.25)]';
  };

  const getIcon = (type: string) => {
    if (type === 'REGULATION') {
      return <Scale className="h-5 w-5 text-slate-500" />;
    }
    if (type === 'POLICY') {
      return <ShieldCheck className="h-5 w-5 text-slate-500" />;
    }
    return <TerminalSquare className="h-5 w-5 text-slate-500" />;
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between px-1">
        <h3 className="text-lg font-bold text-slate-900">Latest Published</h3>
        <button className="text-sm font-bold text-blue-600 hover:underline">
          View All Documents
        </button>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {docs.map((doc) => (
          <Card
            key={doc.id}
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
              <h4 className="mb-2 text-base font-bold text-slate-900">{doc.title}</h4>
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
