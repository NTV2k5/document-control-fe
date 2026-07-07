import { X, FileText, Download, Share2, MoreVertical, Eye, File, Image as ImageIcon, Video, Calendar, User } from 'lucide-react';
import { type IDocument } from 'api';
import { formatDate } from '../../lib';
import { ApprovalStatusBadge } from '../../components';

interface IDocumentSidePanelProps {
  document: IDocument | null;
  onClose: () => void;
}

const getDocTypeIcon = (type?: string) => {
  if (type === 'IMAGE') return <ImageIcon className="size-16 text-yellow-500 opacity-20" />;
  if (type === 'VIDEO') return <Video className="size-16 text-purple-500 opacity-20" />;
  if (type === 'PDF' || type === 'WORD') return <FileText className="size-16 text-blue-500 opacity-20" />;
  return <File className="size-16 text-slate-500 opacity-20" />;
};

export const DocumentSidePanel = ({ document, onClose }: IDocumentSidePanelProps) => {
  if (!document) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />

      {/* Panel */}
      <div className="fixed bottom-0 right-0 top-16 z-50 flex w-[400px] flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-800">Document Details</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
            <X className="size-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* File Preview Mock */}
          <div className="relative mb-6 flex h-48 w-full items-center justify-center rounded-2xl bg-slate-50 shadow-inner">
            {getDocTypeIcon(document.artifact_type)}
            <div className="absolute bottom-3 right-3 rounded-lg bg-white/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 shadow-sm backdrop-blur">
              {document.artifact_type || 'DOC'}
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-bold text-slate-900">{document.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              {document.description || 'No description provided.'}
            </p>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div>
              <p className="text-xs font-medium text-slate-400 flex items-center gap-1"><User className="size-3"/> Created By</p>
              <p className="mt-1 text-sm font-semibold text-slate-700 truncate">{document.created_by}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 flex items-center gap-1"><Calendar className="size-3"/> Updated At</p>
              <p className="mt-1 text-sm font-semibold text-slate-700">{formatDate(document.updated_at)}</p>
            </div>
            <div className="col-span-2 pt-2 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-400 mb-2">Status</p>
              <ApprovalStatusBadge 
                status={document.status} 
                rejection_reason={document.rejection_reason ?? undefined} 
              />
            </div>
          </div>
          
          <div className="space-y-3">
             <h4 className="text-sm font-semibold text-slate-800">Quick Actions</h4>
             <button type="button" className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
               <span className="flex items-center gap-2"><Eye className="size-4 text-blue-600"/> View Document</span>
             </button>
             <button type="button" className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
               <span className="flex items-center gap-2"><Share2 className="size-4 text-green-600"/> Share</span>
             </button>
             <button type="button" className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
               <span className="flex items-center gap-2"><Download className="size-4 text-slate-600"/> Download</span>
             </button>
          </div>
        </div>
      </div>
    </>
  );
};
