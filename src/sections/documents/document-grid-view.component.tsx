import { Eye, MoreVertical } from 'lucide-react';
import { type IDocument } from 'api';
import { formatDate } from '../../lib';

interface IDocumentGridViewProps {
  documents: IDocument[];
  selectedDocument: IDocument | null;
  onSelectDocument: (doc: IDocument) => void;
  hasSelection?: boolean;
}

const getFileIconContainer = (type?: string) => {
  const typeLower = type?.toLowerCase() || '';
  
  if (typeLower === 'pdf') {
    return (
      <div className="flex size-20 shrink-0 flex-col items-center justify-center rounded-2xl border border-red-100 bg-red-50 text-red-500">
        <svg className="size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <span className="mt-1 rounded bg-red-500 px-1 py-0.2 text-[8px] font-black text-white uppercase tracking-wider">PDF</span>
      </div>
    );
  }
  
  if (typeLower === 'excel' || typeLower === 'spreadsheet') {
    return (
      <div className="flex size-20 shrink-0 flex-col items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-600">
        <svg className="size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span className="mt-1 rounded bg-emerald-600 px-1 py-0.2 text-[8px] font-black text-white uppercase tracking-wider">XLS</span>
      </div>
    );
  }
  
  if (typeLower === 'word' || typeLower === 'rich_text') {
    return (
      <div className="flex size-20 shrink-0 flex-col items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-600">
        <svg className="size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span className="mt-1 rounded bg-blue-600 px-1 py-0.2 text-[8px] font-black text-white uppercase tracking-wider">DOC</span>
      </div>
    );
  }
  
  return (
    <div className="flex size-20 shrink-0 flex-col items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 text-slate-500">
      <svg className="size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <span className="mt-1 rounded bg-slate-500 px-1 py-0.2 text-[8px] font-black text-white uppercase tracking-wider">TXT</span>
    </div>
  );
};

export const DocumentGridView = ({ documents, selectedDocument, onSelectDocument, hasSelection = false }: IDocumentGridViewProps) => {
  if (!documents || documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-20 text-slate-500">
        <svg className="mb-4 size-10 opacity-20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p>No documents found.</p>
      </div>
    );
  }

  return (
    <div className={`grid gap-6 ${
      hasSelection
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2'
        : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
    }`}>
      {documents.map((doc, idx) => {
        const isActive = selectedDocument?.id === doc.id;
        return (
          <button
            key={doc.id}
            type="button"
            onClick={() => onSelectDocument(doc)}
            className={`group relative flex w-full flex-col justify-between rounded-2xl border bg-white p-5 text-left transition-all duration-200 outline-none focus:outline-none ${
              isActive
                ? 'border-blue-600 ring-2 ring-blue-600/10 shadow-[0_8px_16px_rgba(37,99,235,0.08)]'
                : 'border-slate-100 hover:border-blue-300 hover:shadow-sm'
            }`}>
            
            {/* More options button (Mock) */}
            <div className="absolute right-3 top-3 text-slate-400 hover:text-slate-600">
              <MoreVertical className="size-4" />
            </div>

            <div className="flex w-full items-start gap-4">
              {/* Left Column: Format Icon Block */}
              {getFileIconContainer(doc.artifact_type)}
              
              {/* Right Column: Text and Metas */}
              <div className="flex-1 min-w-0 pr-4">
                {/* Title */}
                <h3 className="line-clamp-2 text-sm font-bold text-[#1B2559] leading-snug mb-2 pr-2" title={doc.title}>
                  {doc.title}
                </h3>
                
                {/* Status & Recipients */}
                <div className="flex flex-wrap items-center gap-3 justify-between mb-2">
                  <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-600 border border-blue-100/50">
                    <svg className="size-2.5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {doc.status === 'APPROVED' ? 'APPROVED' : doc.status}
                  </span>

                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase">
                    <span>RECIPIENTS:</span>
                    <div className="flex -space-x-1.5 ml-0.5">
                      <img src={`https://i.pravatar.cc/100?u=u${idx}a`} alt="avatar" className="size-5 rounded-full ring-2 ring-white bg-slate-200" />
                      <img src={`https://i.pravatar.cc/100?u=u${idx}b`} alt="avatar" className="size-5 rounded-full ring-2 ring-white bg-slate-200" />
                      <div className="flex size-5 items-center justify-center rounded-full border border-dashed border-slate-300 bg-white text-[9px] font-extrabold text-slate-400">
                        +
                      </div>
                    </div>
                  </div>
                </div>

                {/* Creator Metadata */}
                <div className="text-[11px] text-slate-400 space-y-0.5">
                  <div>
                    Created by: <span className="font-bold text-blue-600">{doc.created_by || 'Sarah Chen'}</span>
                  </div>
                  <div>
                    Created on: {formatDate(doc.created_at)}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Row: Divider + Tag & Views */}
            <div className="flex w-full items-center justify-between mt-4 pt-3 border-t border-slate-50">
              <span className="text-[10px] font-extrabold text-blue-500 uppercase tracking-wide">
                #{doc.template?.template_type || 'ACADEMIC'}
              </span>
              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                <Eye className="size-3.5" /> 12 views
              </div>
            </div>

          </button>
        );
      })}
    </div>
  );
};
