import { FileText, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from 'reactjs-platform/ui';

type StatItem = { label: string; value: string | number; trend: string; trendColor?: string };

type StatsOverviewProps = {
  data: {
    publishedFiles: StatItem;
    myFiles: StatItem;
    sharingFiles: StatItem;
  };
};

export function StatsOverview({ data }: StatsOverviewProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate-100">
        <CardContent className="flex items-center justify-between p-5 md:p-8">
          <div>
            <p className="mb-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
              {data.publishedFiles.label}
            </p>
            <h4 className="text-3xl font-extrabold text-slate-900 md:text-4xl">
              {data.publishedFiles.value}
            </h4>
            <p className={`mt-2 text-xs font-bold ${data.publishedFiles.trendColor}`}>
              {data.publishedFiles.trend}
            </p>
          </div>
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-[0_8px_16px_rgba(59,130,246,0.2)]">
            <FileText className="h-7 w-7" />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate-100">
        <CardContent className="flex items-center justify-between p-5 md:p-8">
          <div>
            <p className="mb-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
              {data.myFiles.label}
            </p>
            <h4 className="text-3xl font-extrabold text-slate-900 md:text-4xl">
              {data.myFiles.value}
            </h4>
            <p className={`mt-2 text-xs font-bold ${data.myFiles.trendColor}`}>
              {data.myFiles.trend}
            </p>
          </div>
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-500 shadow-[0_8px_16px_rgba(6,182,212,0.2)]">
            <ShieldCheck className="h-8 w-8" strokeWidth={2.5} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate-100">
        <CardContent className="flex items-center justify-between p-5 md:p-8">
          <div>
            <p className="mb-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
              {data.sharingFiles.label}
            </p>
            <h4 className="text-3xl font-extrabold text-slate-900 md:text-4xl">
              {data.sharingFiles.value}
            </h4>
            <div className="mt-2 flex items-center gap-1 text-xs font-bold text-slate-500">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{data.sharingFiles.trend}</span>
            </div>
          </div>
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50 text-green-500 shadow-[0_8px_16px_rgba(34,197,94,0.2)]">
            <CheckCircle2 className="h-8 w-8" strokeWidth={2.5} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
