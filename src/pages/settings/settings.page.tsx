import { useTranslation } from '../../i18n';
import { useNavigate } from '@tanstack/react-router';
import { Settings, ArrowLeft } from 'lucide-react';
import { Button } from 'reactjs-platform/ui';

export const SettingsPage = () => {
  const { locale } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-6 flex flex-col items-center justify-center min-h-[70vh]">
      <div className="relative w-full max-w-md p-8 rounded-3xl border border-slate-100 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-center space-y-6 overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute -right-20 -top-20 size-48 rounded-full bg-blue-500/5 blur-3xl" />
        <div className="absolute -left-20 -bottom-20 size-48 rounded-full bg-indigo-500/5 blur-3xl" />
        
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 shadow-inner">
          <Settings className="size-8 animate-[spin_8s_linear_infinite]" />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">
            {locale === 'vi' ? 'Cấu hình Hệ thống' : 'System Settings'}
          </h3>
          <p className="text-sm font-semibold text-blue-600 bg-blue-50/50 inline-block px-3 py-1 rounded-full border border-blue-100/30">
            {locale === 'vi' ? 'Tạm thời bị khóa' : 'Temporarily Disabled'}
          </p>
        </div>
        
        <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-xs mx-auto">
          {locale === 'vi'
            ? 'Giao diện cài đặt cấu hình đang được bảo trì hoặc tạm thời ẩn đi theo chính sách hệ thống. Vui lòng quay lại sau.'
            : 'The configuration settings interface is undergoing maintenance or has been temporarily disabled. Please check back later.'}
        </p>
        
        <div className="pt-2">
          <Button
            onClick={() => navigate({ to: '/home' as any })}
            className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/10 transition-all flex items-center justify-center gap-2 group border-0 outline-none"
          >
            <ArrowLeft className="size-4 group-hover:-translate-x-1 transition-transform" />
            {locale === 'vi' ? 'Quay lại Trang chủ' : 'Back to Home'}
          </Button>
        </div>
      </div>
    </div>
  );
};
