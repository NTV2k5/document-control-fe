import type React from 'react';
import { Link } from '@tanstack/react-router';
import { profileStore, canAccessDocuments, canAccessTemplates, canManageUsers } from 'reactjs-platform/utilities';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Bot,
  Eye,
  FileText,
  Files,
  Hash,
  LayoutDashboard,
  LayoutGrid,
  Share2,
  TrendingUp,
} from 'lucide-react';
import { listDocumentsAPI, getDocumentReportSummaryAPI, type IDocument, type IEntityReportSummary } from 'api';
import type { IHomeSectionProps } from './home.type';
import { useTranslation } from '../../i18n';
import { formatDate } from '../../lib';

// ─── Trending tags (mock – replace with API when available) ───────────────────
const TRENDING_TAGS = [
  '#AIEthics',
  '#QuantumComputing',
  '#ModernArchitecture',
  '#Sustainability',
  '#Neuroscience',
  '#DigitalHumanities',
];

// ─── Trending Now panel (mock) ────────────────────────────────────────────────
const TRENDING_NOW = [
  { rank: 1, title: 'Exam Preparation: AI Tools Policy', sub: 'Trending in Academic Affairs' },
  { rank: 2, title: 'Summer Internship 2024 Portal Open', sub: 'Trending in Career Center' },
  { rank: 3, title: 'New Student Housing Regulations', sub: 'Trending in Student Affairs' },
  { rank: 4, title: 'New Student Housing Regulations', sub: 'Trending in Student Affairs' },
  { rank: 5, title: 'New Student Housing Regulations', sub: 'Trending in Student Affairs' },
];

// ─── Helper: artifact type → icon color ──────────────────────────────────────
const getDocTypeColor = (type?: string): string => {
  if (!type) return 'text-blue-600 bg-blue-50';
  if (type === 'PDF') return 'text-red-600 bg-red-50';
  if (type === 'EXCEL' || type === 'SPREADSHEET') return 'text-green-600 bg-green-50';
  if (type === 'IMAGE') return 'text-yellow-600 bg-yellow-50';
  if (type === 'VIDEO') return 'text-purple-600 bg-purple-50';
  return 'text-blue-600 bg-blue-50';
};

const getDocTypeLabel = (type?: string): string => {
  if (!type) return 'DOC';
  return type.slice(0, 5).toUpperCase();
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
interface IStatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  subLabel?: string;
  accentClassName?: string;
}

const StatCard: React.FC<IStatCardProps> = ({ label, value, icon, subLabel, accentClassName = 'bg-blue-50 text-blue-600' }) => (
  <div className="flex flex-1 items-center gap-4 rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-sm">
    <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${accentClassName}`}>
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-2xl font-bold text-slate-800">{value.toLocaleString()}</p>
      {subLabel && <p className="text-xs text-slate-500">{subLabel}</p>}
    </div>
  </div>
);

// ─── Mini bar chart (SVG, no external lib) ────────────────────────────────────
interface IBarChartProps {
  data: { label: string; count: number }[];
  total: number;
}

const MiniBarChart: React.FC<IBarChartProps> = ({ data, total }) => {
  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const showItems = data.slice(-7);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 items-end gap-1.5">
        {showItems.map((item, idx) => {
          const height = Math.max((item.count / maxVal) * 100, 4);
          const isLast = idx === showItems.length - 1;
          return (
            <div key={item.label} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`w-full rounded-t-md transition-all ${isLast ? 'bg-[#2563eb]' : 'bg-[#bfdbfe]'}`}
                style={{ height: `${height}%` }}
                title={`${item.label}: ${item.count}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5">
        {showItems.map((item) => (
          <span key={item.label} className="flex-1 text-center text-[9px] text-slate-400 truncate">
            {item.label}
          </span>
        ))}
      </div>
      <p className="mt-1 text-right text-xs font-semibold text-[#2563eb]">
        {total.toLocaleString()} <span className="text-slate-400 font-normal">total views</span>
      </p>
    </div>
  );
};

// ─── File Distribution donut (CSS-based) ─────────────────────────────────────
interface IFileDistributionProps {
  documents: number;
  images: number;
  videos: number;
  others: number;
}

const FileDistribution: React.FC<IFileDistributionProps> = ({ documents, images, videos, others }) => {
  const total = documents + images + videos + others;
  if (total === 0) return null;

  const pct = (v: number) => Math.round((v / total) * 100);

  const slices = [
    { label: 'Documents', value: documents, color: '#3b82f6' },
    { label: 'Images', value: images, color: '#f59e0b' },
    { label: 'Videos', value: videos, color: '#a78bfa' },
    { label: 'Others', value: others, color: '#d1d5db' },
  ].filter((s) => s.value > 0);

  // Build conic-gradient stops
  let cumulativePct = 0;
  const gradient = slices
    .map((s) => {
      const start = cumulativePct;
      cumulativePct += pct(s.value);
      return `${s.color} ${start}% ${cumulativePct}%`;
    })
    .join(', ');

  return (
    <div className="flex items-center gap-6">
      {/* Donut */}
      <div
        className="size-24 shrink-0 rounded-full"
        style={{
          background: `conic-gradient(${gradient})`,
          WebkitMask: 'radial-gradient(circle at center, transparent 36px, black 37px)',
          mask: 'radial-gradient(circle at center, transparent 36px, black 37px)',
        }}
      />
      {/* Legend */}
      <div className="flex flex-col gap-2">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="text-sm text-slate-600">{s.label}</span>
            <span className="ml-auto pl-4 text-sm font-semibold text-slate-800">{s.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Document card (Recently Interacted) ─────────────────────────────────────
const DocumentCard: React.FC<{ doc: IDocument }> = ({ doc }) => {
  const typeColor = getDocTypeColor(doc.artifact_type);
  const typeLabel = getDocTypeLabel(doc.artifact_type);

  return (
    <Link
      to="/documents/$id"
      params={{ id: doc.id }}
      className="group flex min-w-[180px] flex-col rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      {/* Type badge */}
      <div className="mb-3 flex items-center justify-between">
        <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${typeColor}`}>
          {typeLabel}
        </span>
        <span className="text-[10px] text-slate-400">{formatDate(doc.updated_at)}</span>
      </div>
      {/* Icon */}
      <div className={`mb-3 flex size-10 items-center justify-center rounded-xl ${typeColor}`}>
        <FileText className="size-5" />
      </div>
      {/* Title */}
      <p className="line-clamp-2 text-sm font-semibold text-slate-800">{doc.title}</p>
      <p className="mt-1 line-clamp-2 text-xs text-slate-400">{doc.description || '—'}</p>
    </Link>
  );
};

// ─── Quick Access item ────────────────────────────────────────────────────────
interface IQuickAccessItemProps {
  icon: React.ReactNode;
  label: string;
  sub: string;
  href: string;
  iconBg: string;
}

const QuickAccessItem: React.FC<IQuickAccessItemProps> = ({ icon, label, sub, href, iconBg }) => (
  <Link
    to={href as never}
    className="flex flex-1 flex-col items-center gap-3 rounded-2xl border border-slate-100 bg-white p-5 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
    <div className={`flex size-12 items-center justify-center rounded-2xl ${iconBg}`}>{icon}</div>
    <div>
      <p className="text-sm font-semibold text-slate-800">{label}</p>
      <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
    </div>
  </Link>
);

// ─── Main section ─────────────────────────────────────────────────────────────
export const HomeSection: React.FC<IHomeSectionProps> = () => {
  const { t } = useTranslation();
  const profile = profileStore((state) => state.profile);
  const canOpenDocuments = canAccessDocuments(profile);
  const canOpenTemplates = canAccessTemplates(profile);
  const canOpenAdmin = canManageUsers(profile);

  const displayName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() ||
    profile?.username ||
    t('home.fallbackUser');

  // ── API data ──────────────────────────────────────────────────────────
  const [reportSummary, setReportSummary] = useState<IEntityReportSummary | null>(null);
  const [latestDocs, setLatestDocs] = useState<IDocument[]>([]);
  const [recentDocs, setRecentDocs] = useState<IDocument[]>([]);

  useEffect(() => {
    if (!canOpenDocuments) return;

    getDocumentReportSummaryAPI().then(setReportSummary).catch(() => {});

    listDocumentsAPI({ page: 1, page_size: 3, sort: '-created_at', is_published: true })
      .then((res) => setLatestDocs(res.data))
      .catch(() => {});

    listDocumentsAPI({ page: 1, page_size: 5, sort: '-updated_at' })
      .then((res) => setRecentDocs(res.data))
      .catch(() => {});
  }, [canOpenDocuments]);

  const totalPublished = reportSummary?.published ?? 0;
  const totalApproved = reportSummary?.approved ?? 0;
  const trendData = reportSummary?.trend ?? [];

  return (
    <section className="min-h-full bg-slate-50 pb-10">
      {/* ── Trending topic hashtags (top bar) ────────────────────────── */}
      <div className="border-b border-slate-200 bg-white px-6 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Trending</span>
          {TRENDING_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-[#0B2559]/30 hover:bg-[#0B2559]/5 hover:text-[#0B2559]">
              <Hash className="size-3" />
              {tag.replace('#', '')}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-screen-xl px-6 py-6">
        {/* ── Top row: Hero + Trending Now ─────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Hero banner */}
          <div className="relative col-span-2 overflow-hidden rounded-3xl bg-[#0B2559] p-7 text-white shadow-lg">
            {/* Background gradient blob */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.5),transparent_60%)]" />
            <div className="absolute right-0 top-0 h-full w-1/2 opacity-20">
              <img
                src="/gdu/logo/logo-icon.png"
                alt=""
                aria-hidden="true"
                className="h-full w-full object-contain object-right"
              />
            </div>

            <div className="relative z-10">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#93c5fd]">GDU Portal</p>
              <h1 className="mt-2 text-3xl font-bold leading-tight text-white">
                Document <span className="text-[#38bdf8]">Control</span>
              </h1>
              <p className="mt-3 max-w-md text-sm leading-6 text-white/75">
                Experience a centralized, transparent, and AI-driven ecosystem for university-wide policy management.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {canOpenDocuments && (
                  <Link
                    to="/documents"
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#0B2559] shadow transition hover:bg-blue-50">
                    <LayoutGrid className="size-4" />
                    Get Started
                  </Link>
                )}
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20">
                  <Bot className="size-4" />
                  AI Assist
                </button>
              </div>
            </div>

            {/* GDU logo bottom-right */}
            <div className="absolute bottom-4 right-6 z-10">
              <img
                src="/gdu/logo/vertical-logo-text.png"
                alt="Gia Dinh University"
                className="h-14 w-auto object-contain opacity-80"
              />
            </div>
          </div>

          {/* Trending Now panel */}
          <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Trending Now</p>
            <div className="flex flex-col gap-3">
              {TRENDING_NOW.map((item) => (
                <div key={item.rank} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#0B2559] text-[10px] font-bold text-white">
                    {item.rank}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 leading-tight">{item.title}</p>
                    <p className="text-xs text-slate-400">{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Stats row ────────────────────────────────────────────────── */}
        <div className="mt-4 flex flex-col gap-4 sm:flex-row">
          <StatCard
            label="Published Files"
            value={totalPublished}
            subLabel="+5% this month"
            icon={<FileText className="size-5" />}
            accentClassName="bg-blue-50 text-blue-600"
          />
          <StatCard
            label="My Files"
            value={totalApproved}
            subLabel="+3 documents this week"
            icon={<Files className="size-5" />}
            accentClassName="bg-teal-50 text-teal-600"
          />
          <StatCard
            label="Sharing Files"
            value={50}
            subLabel="Sharing for 30 results"
            icon={<Share2 className="size-5" />}
            accentClassName="bg-green-50 text-green-600"
          />
        </div>

        {/* ── Analytics + File distribution ────────────────────────────── */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Engagement Analytics */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700">Engagement Analytics</p>
                <p className="text-xs text-slate-400">File views last week</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-800">
                  {reportSummary?.total ? `${reportSummary.total.toLocaleString()}` : '—'}
                </p>
                <p className="flex items-center justify-end gap-1 text-xs text-green-600">
                  <TrendingUp className="size-3" /> +10.2% documents
                </p>
              </div>
            </div>
            <div className="h-32">
              {trendData.length > 0 ? (
                <MiniBarChart data={trendData} total={reportSummary?.total ?? 0} />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                  No trend data available
                </div>
              )}
            </div>
          </div>

          {/* File Distribution */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <p className="text-sm font-semibold text-slate-700">File Distribution</p>
              <p className="text-xs text-slate-400">Split by file type</p>
            </div>
            <FileDistribution
              documents={reportSummary?.by_template_type?.['WORD'] ?? 428}
              images={reportSummary?.by_template_type?.['IMAGE'] ?? 544}
              videos={reportSummary?.by_template_type?.['VIDEO'] ?? 312}
              others={reportSummary?.by_template_type?.['OTHER'] ?? 120}
            />
          </div>
        </div>

        {/* ── Latest Published ─────────────────────────────────────────── */}
        {canOpenDocuments && (
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">Latest Published</h2>
              <Link to="/documents" className="flex items-center gap-1 text-xs font-medium text-[#2563eb] hover:underline">
                View All Documents <ArrowRight className="size-3.5" />
              </Link>
            </div>
            {latestDocs.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {latestDocs.map((doc) => (
                  <Link
                    key={doc.id}
                    to="/documents/$id"
                    params={{ id: doc.id }}
                    className="group rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="mb-3 flex items-center justify-between">
                      <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase ${getDocTypeColor(doc.artifact_type)}`}>
                        {getDocTypeLabel(doc.artifact_type)}
                      </span>
                      <span className="text-[10px] text-slate-400">{formatDate(doc.created_at)}</span>
                    </div>
                    <p className="line-clamp-2 text-sm font-semibold text-slate-800">{doc.title}</p>
                    <p className="mt-1.5 line-clamp-2 text-xs text-slate-400">{doc.description || '—'}</p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                      <Eye className="size-3.5" />
                      <span>{doc.created_by}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No published documents yet.</p>
            )}
          </div>
        )}

        {/* ── Recently Interacted ───────────────────────────────────────── */}
        {canOpenDocuments && recentDocs.length > 0 && (
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">Recently Interacted</h2>
              <Link to="/documents" className="flex items-center gap-1 text-xs font-medium text-[#2563eb] hover:underline">
                View History <ArrowRight className="size-3.5" />
              </Link>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {recentDocs.map((doc) => (
                <DocumentCard key={doc.id} doc={doc} />
              ))}
            </div>
          </div>
        )}

        {/* ── Quick Access ─────────────────────────────────────────────── */}
        <div className="mt-6">
          <h2 className="mb-3 text-base font-semibold text-slate-800">Quick Access</h2>
          <div className="flex flex-col gap-4 sm:flex-row">
            {canOpenDocuments && (
              <QuickAccessItem
                href="/documents"
                label="Published"
                sub="Public and formal records"
                icon={<FileText className="size-6 text-blue-600" />}
                iconBg="bg-blue-50"
              />
            )}
            <QuickAccessItem
              href="/documents"
              label="My Documents"
              sub="Personal draft documents"
              icon={<Files className="size-6 text-teal-600" />}
              iconBg="bg-teal-50"
            />
            {canOpenDocuments && (
              <QuickAccessItem
                href="/documents"
                label="Upload New"
                sub="Submit documents for approval"
                icon={<LayoutDashboard className="size-6 text-indigo-600" />}
                iconBg="bg-indigo-50"
              />
            )}
            {/* Help card */}
            <div className="flex flex-1 flex-col justify-between rounded-2xl bg-gradient-to-br from-[#7c3aed] to-[#4f46e5] p-5 text-white shadow-md">
              <p className="text-sm font-bold">Need Help?</p>
              <p className="mt-1 text-xs text-white/75">Get support to answer your questions and resolve issues.</p>
              <button
                type="button"
                className="mt-4 w-fit rounded-lg bg-white/20 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/30">
                Open Ticket
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
