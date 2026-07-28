import { Download } from 'lucide-react';
import type { IFallbackCardProps } from './fallback-card.type';

export const FallbackCard = ({ onDownload }: IFallbackCardProps) => {
  return (
    <div className="flex flex-1 items-center justify-center p-4 z-40 select-none">
      <div className="w-full max-w-md rounded-2xl bg-[#282a2c] p-8 text-center shadow-2xl border border-white/10 flex flex-col items-center justify-center gap-6 animate-in fade-in zoom-in-95 duration-200">
        <h3 className="text-lg md:text-xl font-medium text-white tracking-wide antialiased">
          Không có bản xem trước nào
        </h3>
        <button
          type="button"
          onClick={onDownload}
          className="flex items-center gap-2.5 rounded-full bg-[#a8c7fa] px-6 py-2.5 text-sm font-semibold text-[#040c18] hover:bg-[#93b7f5] transition-all shadow-md active:scale-95 cursor-pointer"
        >
          <Download className="size-4 stroke-[2.5]" />
          <span>Tải xuống</span>
        </button>
      </div>
    </div>
  );
};
