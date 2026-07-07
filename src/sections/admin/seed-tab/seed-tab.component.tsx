'use client';

import { Button } from 'reactjs-platform/ui';
import { useAdminSeed } from 'reactjs-platform/utilities';
import { RefreshCcw, Play, Database, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';

export const SeedTab = () => {
  const { defaultConfig, lastReport, isLoading, actionLoading, error, actionError, refresh, runSeed } = useAdminSeed();
  const [editorValue, setEditorValue] = useState('');
  const [localError, setLocalError] = useState('');

  const prettyDefaultConfig = useMemo(
    () => (defaultConfig ? JSON.stringify(defaultConfig, null, 2) : ''),
    [defaultConfig],
  );

  const handleLoadDefault = () => {
    setEditorValue(prettyDefaultConfig);
    setLocalError('');
  };

  const handleRunSeed = async () => {
    setLocalError('');
    let payload = undefined;

    if (editorValue.trim()) {
      try {
        payload = JSON.parse(editorValue);
      } catch {
        setLocalError('Payload seed phải là JSON hợp lệ');
        return;
      }
    }

    await runSeed(payload);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
            <div>
              <h2 className="text-xl font-semibold text-[#002147]">Payload seed động</h2>
              <p className="mt-1 text-sm text-slate-500">
                Seed đơn vị tổ chức, quyền, vai trò và người dùng demo từ JSON thay vì dữ liệu cố định.
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={refresh} disabled={isLoading}>
                <RefreshCcw className="size-4" />
                Tải lại mặc định
              </Button>
              <Button type="button" variant="navy" size="sm" onClick={handleLoadDefault} disabled={isLoading}>
                <Database className="size-4" />
                Nạp mặc định
              </Button>
            </div>
          </div>

          <div className="space-y-4 px-6 py-5">
            {(error || actionError || localError) && (
              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                {localError || actionError || error}
              </div>
            )}

            <textarea
              value={editorValue}
              onChange={(event) => setEditorValue(event.target.value)}
              rows={22}
              className="w-full rounded-3xl border border-slate-200 bg-slate-950 px-5 py-4 font-mono text-xs leading-6 text-slate-100 shadow-inner focus:outline-none focus:ring-2 focus:ring-[#002147]/20"
              placeholder={
                prettyDefaultConfig ||
                '{\n  "organization_units": [],\n  "permissions": [],\n  "roles": [],\n  "users": []\n}'
              }
            />

            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              <span>Dán payload cây tổ chức của bạn hoặc nạp cấu hình khởi tạo có sẵn.</span>
              <Button type="button" variant="navy" size="sm" onClick={handleRunSeed} disabled={actionLoading}>
                <Play className="size-4" />
                {actionLoading ? 'Đang seed…' : 'Chạy seed'}
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-5">
            <h3 className="text-lg font-semibold text-[#002147]">Báo cáo seed</h3>
            <p className="mt-1 text-sm text-slate-500">
              API có thể chạy lặp lại. Chạy lại sẽ upsert danh mục phân quyền và phân quyền người dùng.
            </p>
          </div>

          <div className="space-y-5 px-6 py-5">
            <div className="grid gap-3 md:grid-cols-2">
              <MetricCard
                title="Đơn vị"
                value={lastReport?.organization_units?.length ?? defaultConfig?.organization_units?.length ?? 0}
              />
              <MetricCard
                title="Quyền"
                value={lastReport?.permissions?.length ?? defaultConfig?.permissions?.length ?? 0}
              />
              <MetricCard title="Vai trò" value={lastReport?.roles?.length ?? defaultConfig?.roles?.length ?? 0} />
              <MetricCard
                title="Người dùng"
                value={lastReport?.accounts?.length ?? defaultConfig?.users?.length ?? 0}
              />
            </div>

            {lastReport ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {lastReport.message}
                </div>

                <ReportBlock title="Tài khoản">
                  {(lastReport.accounts ?? []).map((account) => (
                    <div key={account.username} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="font-medium text-slate-900">{account.username}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {account.email ?? 'Chưa có email'} · {account.role_keys.join(', ')} · {account.scope_type}
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                            account.error ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                          {account.error ? 'Lỗi' : account.created ? 'Đã tạo' : 'Đã cập nhật'}
                        </span>
                      </div>
                      {account.organization_unit_code && (
                        <div className="mt-2 text-xs text-slate-500">
                          Đơn vị phạm vi: {account.organization_unit_code}
                        </div>
                      )}
                      {account.error && <div className="mt-2 text-xs text-red-600">{account.error}</div>}
                    </div>
                  ))}
                </ReportBlock>

                <ReportBlock title="Danh mục">
                  <div className="grid gap-3 md:grid-cols-2">
                    <MiniList
                      title="Vai trò realm"
                      items={(lastReport.realm_roles ?? []).map(
                        (item) => `${item.name} · ${item.created ? 'đã tạo' : 'đã có'}`,
                      )}
                    />
                    <MiniList
                      title="Nhóm"
                      items={(lastReport.groups ?? []).map(
                        (item) => `${item.name} · ${item.created ? 'đã tạo' : 'đã có'}`,
                      )}
                    />
                    <MiniList
                      title="Vai trò"
                      items={(lastReport.roles ?? []).map((item) => `${item.key} · ${item.permission_count} quyền`)}
                    />
                    <MiniList
                      title="Đơn vị"
                      items={(lastReport.organization_units ?? []).map((item) => `${item.code} · ${item.unit_type}`)}
                    />
                  </div>
                </ReportBlock>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
                Chạy seed một lần để xem báo cáo upsert tại đây.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

function MetricCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{title}</div>
      <div className="mt-3 text-2xl font-semibold text-[#002147]">{value}</div>
    </div>
  );
}

function ReportBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
        <ShieldCheck className="size-4" />
        {title}
      </div>
      {children}
    </div>
  );
}

function MiniList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{title}</div>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item} className="text-sm text-slate-600">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
