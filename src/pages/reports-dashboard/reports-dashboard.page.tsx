import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Files,
  Layers3,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { Input } from 'reactjs-platform/ui';
import {
  getDocumentReportSummaryAPI,
  getTemplateReportSummaryAPI,
  type IEntityReportSummary,
  type TReportGroupBy,
} from 'api';
import { useTranslation } from '../../i18n';
import type React from 'react';

const today = new Date();
const thirtyDaysAgo = new Date(today);
thirtyDaysAgo.setDate(today.getDate() - 30);

const toDateInputValue = (date: Date) => date.toISOString().slice(0, 10);
const toTrendLabel = (date: Date, groupBy: TReportGroupBy) => {
  const value = toDateInputValue(date);
  if (groupBy === 'year') return value.slice(0, 4);
  if (groupBy === 'month') return value.slice(0, 7);
  return value;
};

const buildTrendLabels = (from: string, to: string, groupBy: TReportGroupBy) => {
  if (!from || !to) return [];

  const labels: string[] = [];
  const cursor = new Date(`${from}T00:00:00.000`);
  const end = new Date(`${to}T00:00:00.000`);

  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime()) || cursor > end) return [];

  if (groupBy === 'year') cursor.setMonth(0, 1);
  if (groupBy === 'month') cursor.setDate(1);

  while (cursor <= end) {
    labels.push(toTrendLabel(cursor, groupBy));
    if (groupBy === 'year') cursor.setFullYear(cursor.getFullYear() + 1);
    else if (groupBy === 'month') cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 1);
  }

  return labels;
};

const formatTrendTickLabel = (label: string, groupBy: TReportGroupBy) => {
  if (groupBy === 'year') return label;
  if (groupBy === 'month') return label.slice(5);
  return label.slice(5);
};

const formatNumber = (value: number, locale: string) => new Intl.NumberFormat(locale).format(value);
const getPercent = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 100) : 0);
const chartColors = {
  navy: '#042C55',
  orange: '#F59A00',
  documents: '#087AA8',
  templates: '#0808B8',
  grid: '#E5E7EB',
};

export const ReportsDashboardPage = () => {
  const { t } = useTranslation();
  const [from, setFrom] = useState(toDateInputValue(thirtyDaysAgo));
  const [to, setTo] = useState(toDateInputValue(today));
  const [groupBy, setGroupBy] = useState<TReportGroupBy>('day');
  const [documentSummary, setDocumentSummary] = useState<IEntityReportSummary | null>(null);
  const [templateSummary, setTemplateSummary] = useState<IEntityReportSummary | null>(null);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);

  const reportParams = useMemo(
    () => ({
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
      group_by: groupBy,
    }),
    [from, groupBy, to],
  );

  useEffect(() => {
    let cancelled = false;

    setDocumentLoading(true);
    void getDocumentReportSummaryAPI(reportParams)
      .then((documents) => {
        if (!cancelled) setDocumentSummary(documents);
      })
      .finally(() => {
        if (!cancelled) setDocumentLoading(false);
      });

    setTemplateLoading(true);
    void getTemplateReportSummaryAPI(reportParams)
      .then((templates) => {
        if (!cancelled) setTemplateSummary(templates);
      })
      .finally(() => {
        if (!cancelled) setTemplateLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reportParams]);

  return (
    <div className="min-h-full bg-[#F3F7FB] p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-sm">
            <span className="flex items-center gap-1 text-[#042C55]">
              <BarChart3 className="size-3.5" />
              <span className="font-medium">{t('reportsDashboard.breadcrumbRoot')}</span>
            </span>
            <span className="text-gray-400">›</span>
            <span className="text-gray-500">{t('reportsDashboard.breadcrumbCurrent')}</span>
          </div>
          <div className="text-3xl font-bold text-[#042C55]">{t('reportsDashboard.title')}</div>
          <p className="mt-1 text-sm text-slate-500">{t('reportsDashboard.description')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <div className="flex size-9 items-center justify-center rounded-md bg-orange-50 text-orange-500">
            <CalendarDays className="size-3.5" />
          </div>
          <Input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="h-10 w-40 rounded-lg"
          />
          <span className="text-slate-400">-</span>
          <Input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="h-10 w-40 rounded-lg"
          />
          {/* <Select value={groupBy} onValueChange={(value) => setGroupBy(value as TReportGroupBy)}>
            <SelectTrigger className="h-10 w-32 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">{t('reportsDashboard.groupBy.day')}</SelectItem>
              <SelectItem value="month">{t('reportsDashboard.groupBy.month')}</SelectItem>
              <SelectItem value="year">{t('reportsDashboard.groupBy.year')}</SelectItem>
            </SelectContent>
          </Select> */}
          {/* <Button
            variant="outline"
            className="h-10 rounded-lg"
            onClick={() => {
              setFrom(toDateInputValue(thirtyDaysAgo));
              setTo(toDateInputValue(today));
            }}>
            30 ngày
          </Button> */}
        </div>
      </div>

      <div className="relative">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-2xl font-bold text-slate-950">Report Performance</div>
            {/* <Button variant="outline" className="h-10 rounded-lg bg-white">
              <Download className="size-4" />
              Export
            </Button> */}
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm text-slate-700">
            <LegendItem color={chartColors.orange} label={t('reportsDashboard.legends.total')} />
            <LegendItem color={chartColors.documents} label={t('reportsDashboard.legends.documents')} />
            <LegendItem color={chartColors.templates} label={t('reportsDashboard.legends.templates')} />
            <LegendItem color={chartColors.navy} label={t('reportsDashboard.legends.approved')} />
          </div>
        </div>

        <div className="mb-5 grid gap-4 xl:grid-cols-[minmax(280px,0.7fr)_minmax(0,1.7fr)]">
          <ReportPanel
            title={t('reportsDashboard.panels.documents')}
            icon={<Files className="size-5" />}
            color={chartColors.documents}
            summary={documentSummary}
            loading={documentLoading}
          />
          <TrendChart
            title={t('reportsDashboard.panels.trendTitle')}
            documents={documentSummary}
            templates={templateSummary}
            from={from}
            to={to}
            groupBy={groupBy}
            loading={documentLoading || templateLoading}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.7fr)_minmax(0,1fr)_minmax(360px,0.9fr)]">
          <ReportPanel
            title={t('reportsDashboard.panels.templates')}
            icon={<FileText className="size-5" />}
            color={chartColors.templates}
            summary={templateSummary}
            loading={templateLoading}
          />
          <ApprovalPanel
            documents={documentSummary}
            templates={templateSummary}
            loading={documentLoading || templateLoading}
          />
          <TypeBreakdown
            title={t('reportsDashboard.panels.typeBreakdownTitle')}
            documents={documentSummary}
            loading={documentLoading}
          />
        </div>
      </div>
    </div>
  );
};

const ChartLoadingOverlay = () => {
  const { t } = useTranslation();

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-white/75 backdrop-blur-[1px]">
      <div className="flex flex-col items-center gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <span className="size-10 animate-spin rounded-full border-[3px] border-slate-300 border-t-[#042C55]" />
        <span className="text-sm font-medium text-slate-500">{t('reportsDashboard.loading')}</span>
      </div>
    </div>
  );
};

const LegendItem = ({ color, label }: { color: string; label: string }) => (
  <span className="flex items-center gap-2">
    <span className="h-5 w-10 rounded" style={{ backgroundColor: color }} />
    {label}
  </span>
);

const ReportPanel = ({
  title,
  icon,
  color,
  summary,
  loading,
}: {
  title: string;
  icon: React.ReactNode;
  color: string;
  summary: IEntityReportSummary | null;
  loading: boolean;
}) => {
  const { t, intlLocale } = useTranslation();
  const bars = [
    { label: t('reportsDashboard.status.draft'), value: summary?.draft ?? 0 },
    { label: t('reportsDashboard.status.pending'), value: summary?.pending ?? 0 },
    { label: t('reportsDashboard.status.approved'), value: summary?.approved ?? 0 },
    { label: t('reportsDashboard.status.rejected'), value: summary?.rejected ?? 0 },
    { label: t('reportsDashboard.status.published'), value: summary?.published ?? 0 },
  ];
  const total = summary?.total ?? 0;
  const max = Math.max(1, ...bars.map((bar) => bar.value));

  return (
    <section className="relative rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      {loading && <ChartLoadingOverlay />}
      <div className="mb-4 text-center">
        <div className="flex items-center justify-center gap-2 text-lg font-semibold text-slate-950">
          <span className="text-[#042C55]">{icon}</span>
          {title}
        </div>
        <div className="mt-1 text-xs text-slate-400">
          {t('reportsDashboard.total')}{' '}
          <span className="font-bold text-orange-500">{formatNumber(total, intlLocale)}</span>
        </div>
      </div>
      <div className="flex h-64 items-end justify-between gap-4 border-b border-slate-200 px-3 pb-8">
        {bars.map((bar) => (
          <div key={bar.label} className="relative flex h-full min-w-12 flex-1 flex-col justify-end">
            <div className="mb-2 text-center text-xs font-bold text-slate-700">
              {formatNumber(bar.value, intlLocale)}
            </div>
            <div
              className="mx-auto w-12 rounded-t-md transition-all"
              style={{
                height: `${bar.value === 0 ? 0 : Math.max(12, (bar.value / max) * 170)}px`,
                backgroundColor: color,
              }}
              title={`${bar.label}: ${formatNumber(bar.value, intlLocale)}`}
            />
            <div className="absolute -bottom-7 left-1/2 w-16 -translate-x-1/2 truncate text-center text-xs text-slate-500">
              {bar.label}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3 text-xs text-slate-500">
        <StatusPill
          icon={<Clock3 className="size-3.5" />}
          label={t('reportsDashboard.status.pending')}
          value={getPercent(summary?.pending ?? 0, total)}
        />
        <StatusPill
          icon={<CheckCircle2 className="size-3.5" />}
          label={t('reportsDashboard.status.approved')}
          value={getPercent(summary?.approved ?? 0, total)}
        />
        <StatusPill
          icon={<XCircle className="size-3.5" />}
          label={t('reportsDashboard.status.rejected')}
          value={getPercent(summary?.rejected ?? 0, total)}
        />
      </div>
    </section>
  );
};

const StatusPill = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) => (
  <div className="flex items-center justify-center gap-1.5 rounded-md bg-slate-100 px-2 py-2 font-medium text-slate-600">
    {icon}
    <span>{label}</span>
    <span className="font-bold text-[#042C55]">{value}%</span>
  </div>
);

const ApprovalPanel = ({
  documents,
  templates,
  loading,
}: {
  documents: IEntityReportSummary | null;
  templates: IEntityReportSummary | null;
  loading: boolean;
}) => {
  const { t, intlLocale } = useTranslation();
  const rows = [
    {
      label: t('reportsDashboard.status.pending'),
      documents: documents?.pending ?? 0,
      templates: templates?.pending ?? 0,
    },
    {
      label: t('reportsDashboard.status.approved'),
      documents: documents?.approved ?? 0,
      templates: templates?.approved ?? 0,
    },
    {
      label: t('reportsDashboard.status.rejected'),
      documents: documents?.rejected ?? 0,
      templates: templates?.rejected ?? 0,
    },
  ];
  const documentTotal = documents?.total ?? 0;
  const templateTotal = templates?.total ?? 0;
  const max = Math.max(1, ...rows.flatMap((row) => [row.documents, row.templates]));

  return (
    <section className="relative rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      {loading && <ChartLoadingOverlay />}
      <div className="mb-5 text-center">
        <div className="text-lg font-semibold text-slate-950">{t('reportsDashboard.panels.approvalTitle')}</div>
        <div className="mt-1 text-xs text-slate-400">
          {t('reportsDashboard.approvalSummary', {
            documents: formatNumber(documentTotal, intlLocale),
            templates: formatNumber(templateTotal, intlLocale),
          })}
        </div>
      </div>
      <div className="flex h-64 items-end justify-between gap-6 border-b border-slate-200 px-4 pb-8">
        {rows.map((row) => (
          <div key={row.label} className="relative flex h-full flex-1 flex-col justify-end">
            <div className="mb-2 flex items-end justify-center gap-2">
              <div className="flex flex-col items-center">
                <div className="mb-2 text-xs font-bold text-slate-700">{formatNumber(row.documents, intlLocale)}</div>
                <div
                  className="w-9 rounded-t-md"
                  style={{
                    height: `${row.documents === 0 ? 0 : Math.max(14, (row.documents / max) * 170)}px`,
                    backgroundColor: chartColors.documents,
                  }}
                  title={t('reportsDashboard.documentStatusTitle', {
                    status: row.label,
                    count: formatNumber(row.documents, intlLocale),
                  })}
                />
              </div>
              <div className="flex flex-col items-center">
                <div className="mb-2 text-xs font-bold text-slate-700">{formatNumber(row.templates, intlLocale)}</div>
                <div
                  className="w-9 rounded-t-md"
                  style={{
                    height: `${row.templates === 0 ? 0 : Math.max(14, (row.templates / max) * 170)}px`,
                    backgroundColor: chartColors.templates,
                  }}
                  title={t('reportsDashboard.templateStatusTitle', {
                    status: row.label,
                    count: formatNumber(row.templates, intlLocale),
                  })}
                />
              </div>
            </div>
            <div className="absolute -bottom-7 left-1/2 w-20 -translate-x-1/2 truncate text-center text-xs text-slate-500">
              {row.label}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3 text-xs text-slate-500">
        {rows.map((row) => (
          <div key={row.label} className="rounded-md bg-slate-100 px-2 py-2 text-center font-medium">
            {t('reportsDashboard.approvalPercent', {
              documents: getPercent(row.documents, documentTotal),
              templates: getPercent(row.templates, templateTotal),
            })}
          </div>
        ))}
      </div>
    </section>
  );
};

const TrendChart = ({
  title,
  documents,
  templates,
  from,
  to,
  groupBy,
  loading,
}: {
  title: string;
  documents: IEntityReportSummary | null;
  templates: IEntityReportSummary | null;
  from: string;
  to: string;
  groupBy: TReportGroupBy;
  loading: boolean;
}) => {
  const { t, intlLocale } = useTranslation();
  const trendLabels = buildTrendLabels(from, to, groupBy);
  const dataLabels = Array.from(
    new Set([...(documents?.trend ?? []), ...(templates?.trend ?? [])].map((item) => item.label)),
  ).sort();
  const labels = trendLabels.length > 0 ? trendLabels : dataLabels;
  const documentTrend = new Map((documents?.trend ?? []).map((item) => [item.label, item.count]));
  const templateTrend = new Map((templates?.trend ?? []).map((item) => [item.label, item.count]));
  const series = labels.map((label) => ({
    label,
    documents: documentTrend.get(label) ?? 0,
    templates: templateTrend.get(label) ?? 0,
  }));
  const chartWidth = 1200;
  const chartHeight = 390;
  const padding = { top: 42, right: 42, bottom: 62, left: 58 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const max = Math.max(1, ...series.flatMap((item) => [item.documents, item.templates]));
  const yTicks = [max, Math.round(max * 0.75), Math.round(max * 0.5), Math.round(max * 0.25), 0];
  const getX = (index: number) =>
    padding.left + (labels.length <= 1 ? plotWidth / 2 : (index / (labels.length - 1)) * plotWidth);
  const getY = (value: number) => padding.top + plotHeight - (value / max) * plotHeight;
  const documentPoints = series.map((item, index) => ({
    x: getX(index),
    y: getY(item.documents),
    value: item.documents,
  }));
  const templatePoints = series.map((item, index) => ({
    x: getX(index),
    y: getY(item.templates),
    value: item.templates,
  }));
  const toPath = (points: typeof documentPoints) =>
    points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const tickStep = Math.max(1, Math.ceil(labels.length / 9));
  const shouldShowTick = (index: number) => index === 0 || index === labels.length - 1 || index % tickStep === 0;

  return (
    <section className="relative rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      {loading && <ChartLoadingOverlay />}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xl font-semibold text-[#042C55]">
            <TrendingUp className="size-5" />
            {title}
          </div>
          <div className="mt-1 text-xs text-slate-400">{t('reportsDashboard.panels.trendDescription')}</div>
        </div>
        <div className="mt-1 text-xs text-slate-400">So sánh lượng documents và templates phát sinh theo kỳ</div>
        <div className="mt-3 flex justify-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ backgroundColor: chartColors.documents }} />
            {t('reportsDashboard.legends.documents')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ backgroundColor: chartColors.templates }} />
            {t('reportsDashboard.legends.templates')}
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-slate-100 bg-white">
        {labels.length === 0 && (
          <div className="flex h-80 items-center justify-center text-sm text-slate-400">
            {t('reportsDashboard.noData')}
          </div>
        )}
        {labels.length > 0 && (
          <svg
            width="100%"
            height={chartHeight}
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            role="img"
            aria-label={title}>
            {yTicks.map((tick) => {
              const y = getY(tick);
              return (
                <g key={`y-tick-${tick}`}>
                  <line x1={padding.left} x2={chartWidth - padding.right} y1={y} y2={y} stroke={chartColors.grid} />
                  <text x={padding.left - 12} y={y + 4} textAnchor="end" fontSize="12" fill="#64748B">
                    {formatNumber(tick, intlLocale)}
                  </text>
                </g>
              );
            })}
            {series.map((item, index) => {
              const x = getX(index);
              const showTick = shouldShowTick(index);
              return (
                <g key={item.label}>
                  {showTick && (
                    <>
                      <line x1={x} x2={x} y1={padding.top} y2={padding.top + plotHeight} stroke="#F1F5F9" />
                      <text x={x} y={chartHeight - 24} textAnchor="middle" fontSize="12" fill="#64748B">
                        {formatTrendTickLabel(item.label, groupBy)}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
            <path
              d={toPath(documentPoints)}
              fill="none"
              stroke={chartColors.documents}
              strokeDasharray="6 6"
              strokeWidth="3"
            />
            <path d={toPath(templatePoints)} fill="none" stroke={chartColors.templates} strokeWidth="3" />
            {documentPoints.map((point, index) => (
              <g key={`documents-${series[index].label}`}>
                <circle cx={point.x} cy={point.y} r="5" fill={chartColors.documents} />
                {point.value > 0 && (
                  <text
                    x={point.x}
                    y={point.y - 12}
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="700"
                    fill={chartColors.documents}>
                    {formatNumber(point.value, intlLocale)}
                  </text>
                )}
              </g>
            ))}
            {templatePoints.map((point, index) => (
              <g key={`templates-${series[index].label}`}>
                <circle cx={point.x} cy={point.y} r="5" fill={chartColors.templates} />
                {point.value > 0 && (
                  <text
                    x={point.x}
                    y={point.y + 22}
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="700"
                    fill={chartColors.templates}>
                    {formatNumber(point.value, intlLocale)}
                  </text>
                )}
              </g>
            ))}
          </svg>
        )}
      </div>
    </section>
  );
};

const TypeBreakdown = ({
  title,
  documents,
  loading,
}: {
  title: string;
  documents: IEntityReportSummary | null;
  loading: boolean;
}) => {
  const { t, intlLocale } = useTranslation();
  const rows = Object.keys(documents?.by_template_type ?? {})
    .map((key) => ({
      key,
      documents: documents?.by_template_type[key] ?? 0,
    }))
    .sort((a, b) => b.documents - a.documents)
    .slice(0, 10);
  const max = Math.max(1, ...rows.map((row) => row.documents));
  const total = rows.reduce((sum, row) => sum + row.documents, 0);

  return (
    <section className="relative rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      {loading && <ChartLoadingOverlay />}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xl font-semibold text-[#042C55]">
            <Layers3 className="size-5" />
            {title}
          </div>
          <div className="mt-1 text-xs text-slate-400">{t('reportsDashboard.panels.typeBreakdownDescription')}</div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-orange-500">{formatNumber(total, intlLocale)}</div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {t('reportsDashboard.total')}
          </div>
        </div>
      </div>
      <div className="space-y-5">
        {rows.length === 0 && (
          <div className="py-16 text-center text-sm text-slate-400">{t('reportsDashboard.noData')}</div>
        )}
        {rows.map((row) => (
          <div key={row.key}>
            <div className="mb-2 flex justify-between gap-3 text-sm">
              <span className="truncate font-semibold text-[#042C55]">{row.key}</span>
              <span className="shrink-0 font-bold text-slate-700">{formatNumber(row.documents, intlLocale)}</span>
            </div>
            <div className="h-6 overflow-hidden rounded-md bg-slate-100">
              <div className="flex h-full" style={{ width: `${(row.documents / max) * 100}%` }}>
                <div
                  className="w-full"
                  style={{
                    backgroundColor: chartColors.documents,
                  }}
                />
              </div>
            </div>
            <div className="mt-2 flex gap-3 text-[11px] text-slate-400">
              <span>{t('reportsDashboard.documentsCount', { count: formatNumber(row.documents, intlLocale) })}</span>
              <span>{t('reportsDashboard.usagePercent', { percent: getPercent(row.documents, total) })}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
