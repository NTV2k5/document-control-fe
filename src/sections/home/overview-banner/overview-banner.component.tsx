import { Bot } from 'lucide-react';
import { Button, Card, CardContent } from 'reactjs-platform/ui';
import { useNavigate } from '@tanstack/react-router';

type OverviewBannerProps = {
  trendingData: { rank: string | number; title: string; dept: string }[];
};

export function OverviewBanner({ trendingData }: OverviewBannerProps) {
  const navigate = useNavigate();

  return (
    <div>
      {/* Page title row */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Overview</h2>
        <div className="flex -space-x-2">
          {[1, 2].map((i) => (
            <img
              key={i}
              src={`https://i.pravatar.cc/150?u=${i}`}
              alt={`User ${i}`}
              className="h-8 w-8 rounded-full border-2 border-white object-cover shadow-sm"
            />
          ))}
          <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-[10px] font-bold text-white shadow-sm">
            +24
          </div>
        </div>
      </div>

      {/* Banner + Trending grid */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Main banner */}
        <div className="relative flex min-h-[240px] flex-col justify-center overflow-hidden rounded-2xl bg-slate-900 xl:col-span-2">
          {/* Background image */}
          <div
            className="absolute inset-0 bg-cover bg-center opacity-40"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1541339907198-e08756dedf3f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80')",
            }}
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/70 to-transparent" />

          {/* Content */}
          <div className="relative z-10 flex w-full flex-col-reverse items-center justify-between gap-6 p-8 md:flex-row">
            {/* Text + buttons glass card */}
            <div className="w-full rounded-2xl border border-white/15 bg-white/10 p-6 backdrop-blur-md md:max-w-sm">
              <h1 className="mb-3 text-xl leading-tight font-extrabold text-white md:text-2xl">
                GDU Portal <br />
                <span className="text-cyan-400 whitespace-nowrap">Document Control</span>
              </h1>
              <p className="mb-4 text-sm leading-relaxed font-medium text-slate-200">
                Experience a centralized, transparent, and AI-driven ecosystem for university-wide
                policy management.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => navigate({ to: '/documents' })}
                  className="h-10 rounded-full bg-blue-600 px-6 text-sm font-bold text-white shadow-md hover:bg-blue-700"
                >
                  Get Started
                </Button>
                <Button
                  variant="outline"
                  className="h-10 rounded-full border-white/20 bg-white/10 px-5 text-sm font-bold text-white backdrop-blur-sm hover:bg-white/20 hover:border-white/40"
                >
                  <Bot className="mr-2 h-4 w-4" /> AI Assist
                </Button>
              </div>
            </div>

            {/* University Logo */}
            <div className="pointer-events-none flex shrink-0 items-center justify-center">
              <img
                src="/gdu/logo/vertical-logo-text.png"
                alt="Gia Dinh University Logo"
                className="h-[180px] w-auto object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.2)] md:h-[220px]"
              />
            </div>
          </div>
        </div>

        {/* Trending Now card */}
        <Card className="relative overflow-hidden rounded-2xl border-none bg-blue-600 text-white shadow-lg">
          <div className="pointer-events-none absolute -right-12 -top-12 rounded-full bg-blue-500/40 p-24 blur-2xl" />
          <CardContent className="relative z-10 p-6">
            <h3 className="mb-4 text-xs font-bold tracking-widest text-blue-100 uppercase">
              TRENDING NOW
            </h3>
            <div className="space-y-3">
              {trendingData.map((item, i) => (
                <button
                  key={i}
                  type="button"
                  className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-blue-500/30 bg-blue-700/40 p-3 text-left transition-colors hover:bg-blue-700/70"
                >
                  <span className="w-5 shrink-0 text-sm font-light text-blue-300">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm leading-tight font-bold text-white truncate">{item.title}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-blue-200 truncate">{item.dept}</p>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
