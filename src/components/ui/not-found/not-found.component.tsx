import { Link } from '@tanstack/react-router';
import { useTranslation } from '../../../i18n';

export const NotFound = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-[#f0f0e8] text-[#1a1a1a] flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      <div className="max-w-4xl w-full border-2 border-[#1a1a1a] bg-white relative z-10 p-8 md:p-16 flex flex-col items-start shadow-[12px_12px_0_0_#1a1a1a]">
        <div className="font-mono text-sm md:text-base text-[#888888] mb-4 uppercase tracking-widest border-b-2 border-[#1a1a1a] pb-2 w-full">
          {t('notFound.status')}
        </div>

        <h1 className="text-7xl md:text-[10rem] font-black leading-none tracking-tighter mb-6">
          {t('notFound.title')}
        </h1>

        <p className="text-xl md:text-2xl max-w-2xl mb-12 leading-relaxed">{t('notFound.description')}</p>

        <Link
          to="/"
          className="inline-flex items-center justify-center bg-[#1a1a1a] text-[#f0f0e8] font-bold text-lg px-10 py-5 uppercase tracking-wide hover:bg-[#2d5a2d] transition-colors">
          {t('notFound.action')}
        </Link>
      </div>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[35vw] font-black text-[#1a1a1a] opacity-[0.03] pointer-events-none select-none tracking-tighter z-0 overflow-hidden w-full text-center">
        404
      </div>
    </div>
  );
};
