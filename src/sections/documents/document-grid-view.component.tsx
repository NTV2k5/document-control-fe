import { Link } from '@tanstack/react-router';
import { Eye, FileText, Image as ImageIcon, Video, File } from 'lucide-react';
import { type IDocument } from 'api';
import { formatDate } from '../../lib';
import type { TDocumentRowAction } from './documents.type';

interface IDocumentGridViewProps {
  documents: IDocument[];
  onSelectDocument: (doc: IDocument) => void;
}

const getDocTypeIcon = (type?: string) => {
  if (type === 'IMAGE') return <ImageIcon className="size-8 text-yellow-600" />;
  if (type === 'VIDEO') return <Video className="size-8 text-purple-600" />;
  if (type === 'PDF' || type === 'WORD') return <FileText className="size-8 text-blue-600" />;
  return <File className="size-8 text-slate-600" />;
};

const getDocTypeColor = (type?: string) => {
  if (type === 'IMAGE') return 'bg-yellow-50 text-yellow-700 ring-yellow-600/20';
  if (type === 'VIDEO') return 'bg-purple-50 text-purple-700 ring-purple-600/20';
  if (type === 'PDF' || type === 'WORD') return 'bg-blue-50 text-blue-700 ring-blue-600/20';
  return 'bg-slate-50 text-slate-700 ring-slate-600/20';
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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {documents.map((doc) => (
        <button
          key={doc.id}
          type="button"
          onClick={() => onSelectDocument(doc)}
          className="group flex flex-col items-start justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-[#0B2559]/30 hover:shadow-md">
          <div className="w-full">
            <div className="mb-4 flex items-start justify-between">
              {getDocTypeIcon(doc.artifact_type)}
              <span
                className={`inline-flex items-center rounded-md px-2 py-1 text-[10px] font-medium ring-1 ring-inset ${getDocTypeColor(doc.artifact_type)}`}>
                {doc.artifact_type || 'DOC'}
              </span>
            </div>
            <h3 className="line-clamp-2 text-sm font-semibold text-slate-900 group-hover:text-[#0B2559]">
              {doc.title}
            </h3>
            <p className="mt-1 line-clamp-2 text-xs text-slate-500">{doc.description || 'No description provided.'}</p>
          </div>
          <div className="mt-4 flex w-full items-center justify-between border-t border-slate-100 pt-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <div className="flex size-5 items-center justify-center rounded-full bg-slate-100">
                {doc.created_by?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="truncate max-w-[80px]">{doc.created_by}</span>
            </div>
            <span className="text-[10px] text-slate-400">{formatDate(doc.updated_at)}</span>
          </div>
        </button>
      ))}
    </div>
  );
};
