import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { IPreviewNavButtonsProps } from './preview-nav-buttons.type';

export const PreviewNavButtons = ({
  hasPrev,
  hasNext,
  onPrev,
  onNext,
}: IPreviewNavButtonsProps) => {
  return (
    <>
      {hasPrev && (
        <button
          type="button"
          onClick={onPrev}
          className="fixed left-4 top-1/2 -translate-y-1/2 z-50 size-12 rounded-full bg-[#2d2f31]/90 hover:bg-[#3d3f42] text-white flex items-center justify-center border border-white/10 shadow-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer select-none"
          title="Tệp trước đó (Mũi tên trái)"
        >
          <ChevronLeft className="size-6 stroke-[2.5]" />
        </button>
      )}

      {hasNext && (
        <button
          type="button"
          onClick={onNext}
          className="fixed right-4 top-1/2 -translate-y-1/2 z-50 size-12 rounded-full bg-[#2d2f31]/90 hover:bg-[#3d3f42] text-white flex items-center justify-center border border-white/10 shadow-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer select-none"
          title="Tệp tiếp theo (Mũi tên phải)"
        >
          <ChevronRight className="size-6 stroke-[2.5]" />
        </button>
      )}
    </>
  );
};
