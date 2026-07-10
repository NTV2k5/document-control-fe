import { Info, FileText, Film } from 'lucide-react';
import type { IStorageAnalyticsProps } from '../profile.type';
import { Tooltip, TooltipContent, TooltipTrigger } from 'reactjs-platform/ui';

export const StorageAnalytics = ({
  usedStorageTb = 4.2,
  totalStorageTb = 10,
  documentsPercent = 65,
  mediaPercent = 35,
  documentsTb = 2.8,
  mediaTb = 1.4,
}: Partial<IStorageAnalyticsProps>) => {
  const usedPercent = Math.round((usedStorageTb / totalStorageTb) * 100);

  // SVG circle calculations
  const radius = 55;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (usedPercent / 100) * circumference;

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-800">Storage Analytics</h3>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="text-slate-400 hover:text-slate-600">
              <Info className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="bg-slate-900 text-white text-xs rounded-lg p-2 max-w-[200px]">
            Displays the current document and media file consumption against your allotted space of {totalStorageTb} TB.
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Circle Chart */}
      <div className="my-6 flex justify-center items-center relative">
        <svg className="w-40 h-40 transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            className="stroke-slate-100"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress circle */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            className="stroke-blue-600 transition-all duration-500 ease-out"
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        {/* Inner Text */}
        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-slate-800">{usedPercent}%</span>
          <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">USED</span>
        </div>
      </div>

      {/* Itemized Lists */}
      <div className="space-y-4 mt-2">
        {/* Documents */}
        <div className="flex items-center justify-between rounded-2xl bg-slate-50/70 p-3.5 hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100/30">
              <FileText className="size-4.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-800 leading-tight">Documents</span>
              <span className="text-[10px] text-slate-400 font-medium">{documentsTb} TB</span>
            </div>
          </div>
          <span className="text-xs font-bold text-slate-800">{documentsPercent}%</span>
        </div>

        {/* Media Assets */}
        <div className="flex items-center justify-between rounded-2xl bg-slate-50/70 p-3.5 hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-100/30">
              <Film className="size-4.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-800 leading-tight">Media Assets</span>
              <span className="text-[10px] text-slate-400 font-medium">{mediaTb} TB</span>
            </div>
          </div>
          <span className="text-xs font-bold text-slate-800">{mediaPercent}%</span>
        </div>
      </div>
    </div>
  );
};
