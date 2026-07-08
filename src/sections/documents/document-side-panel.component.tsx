import { X, FileText, Download, Edit3, UserPlus, Folder } from 'lucide-react';
import { type IDocument } from 'api';
import { formatDate } from '../../lib';

interface IDocumentSidePanelProps {
  document: IDocument | null;
  onClose: () => void;
}

export const DocumentSidePanel = ({ document, onClose }: IDocumentSidePanelProps) => {
  if (!document) return null;

  return (
    <>
      <div 
        className="fixed inset-0 z-40 bg-slate-900/10 backdrop-blur-[1px] transition-opacity" 
        onClick={onClose} 
      />

      <div className="fixed bottom-0 right-0 top-0 z-50 flex w-[480px] flex-col border-l border-slate-200 bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.05)] transition-transform duration-300">
        
        {/* Header Title */}
        <div className="flex items-start justify-between px-8 py-6 pt-10">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <FileText className="size-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#1B2559]">{document.title || 'MH-Admin 25-0044'}</h2>
              <p className="text-xs text-[#A3AED0] mt-1">Document ID: #{document.id || '522186C_20251212'}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100">
            <X className="size-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-8 px-8 border-b border-slate-100">
          <button className="border-b-2 border-blue-600 pb-3 text-sm font-bold text-blue-600">Detail</button>
          <button className="border-b-2 border-transparent pb-3 text-sm font-bold text-[#A3AED0] hover:text-slate-600">Activity</button>
          <button className="border-b-2 border-transparent pb-3 text-sm font-bold text-[#A3AED0] hover:text-slate-600">Version</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          
          {/* Preview Box */}
          <div className="mb-8 flex flex-col items-center justify-center rounded-2xl bg-[#F4F7FE] border border-[#E9EDF7] p-8 text-center">
            <span className="text-xs font-bold text-red-500 uppercase tracking-widest bg-white px-3 py-1 rounded-full shadow-sm mb-4">Demo Document Only</span>
            <FileText className="size-10 text-[#A3AED0] mb-4 opacity-50" />
            <p className="text-xs text-[#A3AED0] max-w-[200px] leading-relaxed mb-6">
              Preview is currently restricted. Please download to view full content.
            </p>
            <button className="rounded-full border border-slate-300 bg-white px-6 py-2 text-sm font-bold text-[#1B2559] shadow-sm hover:bg-slate-50 transition">
              View Fullscreen
            </button>
          </div>

          {/* Details list */}
          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#A3AED0] mb-2">Recipients</p>
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  <img src="https://i.pravatar.cc/150?u=a" alt="A" className="size-8 rounded-full ring-2 ring-white" />
                  <img src="https://i.pravatar.cc/150?u=b" alt="B" className="size-8 rounded-full ring-2 ring-white" />
                </div>
                <button className="flex size-8 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400 hover:text-slate-600">
                  <UserPlus className="size-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#A3AED0] mb-1">Created On</p>
                <p className="text-sm font-bold text-[#1B2559]">{formatDate(document.created_at) || '12-12-2025 12:15 AM'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#A3AED0] mb-1">Status</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="size-2 rounded-full bg-emerald-500"></div>
                  <span className="text-xs font-bold text-emerald-600 uppercase">Active</span>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#A3AED0] mb-2">Folder</p>
              <div className="inline-flex items-center gap-2 rounded-lg bg-[#F4F7FE] px-3 py-1.5 text-sm font-semibold text-[#1B2559]">
                <Folder className="size-4 text-[#A3AED0]" />
                Nhân sự (Human Resources)
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#A3AED0] mb-2">Tags</p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs font-bold text-blue-500">#Company Docs</span>
                <span className="text-xs font-bold text-blue-500">#Internal</span>
                <span className="text-xs font-bold text-blue-500">#2025</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-4 border-t border-slate-100 p-6">
          <button className="flex flex-1 items-center justify-center gap-2 rounded-full border-2 border-slate-200 bg-white py-3 text-sm font-bold text-[#1B2559] transition hover:bg-slate-50">
            <Download className="size-4" /> Download
          </button>
          <button className="flex flex-1 items-center justify-center gap-2 rounded-full bg-blue-600 py-3 text-sm font-bold text-white shadow-md transition hover:bg-blue-700">
            <Edit3 className="size-4" /> Edit Details
          </button>
        </div>
        
      </div>
    </>
  );
};
