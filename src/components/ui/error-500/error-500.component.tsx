import { ServerCrash, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { IError500Props } from './error-500.type';
import { Button } from 'reactjs-platform/ui';

export const Error500 = ({ error, reset }: IError500Props) => {
  const [showDetails, setShowDetails] = useState(false);

  const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
  const errorStack = error instanceof Error ? error.stack : null;

  const handleReload = () => {
    if (reset) {
      reset();
    } else {
      window.location.reload();
    }
  };

  const handleGoHome = () => {
    window.location.href = '/home';
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F4F7FE] p-6 font-sans">
      <div className="flex w-full max-w-lg flex-col items-center rounded-3xl border border-slate-200/60 bg-white p-8 shadow-xl">
        {/* Error icon with glow */}
        <div className="flex size-16 items-center justify-center rounded-2xl bg-red-50 text-red-500 shadow-[0_8px_24px_rgba(239,68,68,0.2)]">
          <ServerCrash className="size-8" />
        </div>

        {/* Header */}
        <h1 className="mt-6 text-center text-2xl font-extrabold text-slate-800">
          Hệ thống gặp sự cố
        </h1>
        <p className="mt-2 text-center text-[13.5px] font-medium leading-relaxed text-slate-400">
          Đã xảy ra lỗi kết nối với máy chủ hoặc timeout tải tài nguyên. Xin vui lòng thử lại
          hoặc quay lại trang chủ.
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            onClick={handleReload}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-xs font-bold text-white shadow-[0_4px_12px_rgba(37,99,235,0.25)] hover:bg-blue-700"
          >
            <RefreshCw className="size-4" />
            Thử lại
          </Button>
          <Button
            onClick={handleGoHome}
            variant="outline"
            className="flex h-11 items-center justify-center gap-2 rounded-xl border-slate-200 bg-white px-6 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            <Home className="size-4" />
            Về Trang chủ
          </Button>
        </div>

        {/* Developer Trace (only in dev mode) */}
        {import.meta.env.DEV && (errorMessage || errorStack) ? (
          <div className="mt-8 w-full border-t border-slate-100 pt-6">
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="flex w-full items-center justify-between text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
            >
              <span>Chi tiết lỗi (Developer Trace)</span>
              {showDetails ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>

            {showDetails && (
              <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-red-100 bg-red-50/30 p-4">
                <span className="font-mono text-xs font-bold text-red-600">
                  {errorMessage}
                </span>
                {errorStack ? (
                  <pre className="max-h-48 overflow-y-auto font-mono text-[10px] leading-relaxed text-red-500">
                    <code>{errorStack}</code>
                  </pre>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
