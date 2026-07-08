import { Eye, FileText, FileVideo, Image as ImageIcon, MoreVertical } from 'lucide-react';
import { type IDocument } from 'api';
import { formatDate } from '../../lib';

interface IDocumentGridViewProps {
  documents: IDocument[];
  onSelectDocument: (doc: IDocument) => void;
}

const getDocTypeIcon = (type?: string) => {
  if (type === 'IMAGE') return <ImageIcon className="size-10 text-emerald-500" />;
  if (type === 'VIDEO') return <FileVideo className="size-10 text-purple-500" />;
  if (type === 'PDF') return <div className="rounded bg-red-500 px-2 py-1 text-xs font-bold text-white">PDF</div>;
  if (type === 'EXCEL' || type === 'SPREADSHEET') return <div className="rounded bg-emerald-500 px-2 py-1 text-xs font-bold text-white">XLS</div>;
  if (type === 'WORD') return <div className="rounded bg-blue-500 px-2 py-1 text-xs font-bold text-white">DOC</div>;
  return <FileText className="size-10 text-blue-500" />;
};

export const DocumentGridView = ({ documents, onSelectDocument }: IDocumentGridViewProps) => {
  if (!documents || documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-20 text-slate-500">
        <FileText className="mb-4 size-10 opacity-20" />
        <p>No documents found.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {documents.map((doc, idx) => (
        <button
          key={doc.id}
          type="button"
          onClick={() => onSelectDocument(doc)}
          className="group relative flex flex-col justify-between rounded-2xl border-2 border-slate-100 bg-white p-5 text-left shadow-sm transition-all hover:border-blue-500 hover:shadow-md focus:border-blue-500 focus:outline-none">
          
          {/* More options button (Mock) */}
          <div className="absolute right-3 top-3 text-slate-400 hover:text-slate-600">
            <MoreVertical className="size-4" />
          </div>

          <div className="flex w-full flex-col">
            {/* Big Icon Centered */}
            <div className="mb-6 mt-4 flex justify-center">
              {getDocTypeIcon(doc.artifact_type)}
            </div>
            
            {/* Title */}
            <h3 className="line-clamp-2 text-sm font-bold text-[#1B2559] mb-3">
              {doc.title}
            </h3>
            
            {/* Status & Recipients */}
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-600">
                <div className="size-1.5 rounded-full bg-blue-600" /> APPROVED
              </span>
              <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                RECIPIENTS:
                <div className="flex -space-x-1 ml-1">
                  <img src={`https://i.pravatar.cc/150?u=${idx}1`} alt="avatar" className="size-5 rounded-full ring-2 ring-white bg-slate-200" />
                  <img src={`https://i.pravatar.cc/150?u=${idx}2`} alt="avatar" className="size-5 rounded-full ring-2 ring-white bg-slate-200" />
                </div>
              </div>
            </div>

            {/* Meta */}
            <div className="flex items-center justify-between text-[10px] text-slate-500 mb-3">
              <span className="font-medium">Created by: <span className="font-bold text-blue-600">{doc.created_by || 'Sarah Chen'}</span></span>
              <span>Created on: {formatDate(doc.created_at)}</span>
            </div>

            {/* Tags & Views */}
            <div className="flex w-full items-center justify-between mt-auto pt-2 border-t border-slate-50">
              <span className="text-[10px] font-bold text-blue-500">#ACADEMIC</span>
              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                <Eye className="size-3" /> 12 views
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};
