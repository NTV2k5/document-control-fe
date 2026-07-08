import { Eye, MoreVertical, BadgeCheck } from 'lucide-react';
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
  let colorClass = 'text-blue-600';
  
  if (typeLower === 'image_form' || typeLower === 'pdf') {
    colorClass = 'text-red-500';
  } else if (typeLower === 'spreadsheet' || typeLower === 'excel') {
    colorClass = 'text-emerald-500';
  } else if (typeLower === 'rich_text' || typeLower === 'word') {
    colorClass = 'text-emerald-500'; // Make Excel-like or document-like sheets icon green as in mockup image 2
  }

  // Set the icon color to emerald green for sheets as shown in Figma image 2
  const iconColor = typeLower === 'spreadsheet' || typeLower === 'excel' ? 'text-emerald-500' : colorClass;

  return (
    <div className="flex size-24 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white">
      <svg className={`size-12 ${iconColor}`} viewBox="0 0 24 24" fill="currentColor">
        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm0-4H8V8h8v2zm-3-5V3.5L18.5 9H13z" />
      </svg>
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
                <h3 className="line-clamp-2 text-sm font-bold text-[#1b2559] leading-snug mb-2 pr-2" title={doc.title}>
                  {doc.title}
                </h3>
                
                {/* Status & Recipients */}
                <div className="flex flex-wrap items-center gap-3 justify-between mb-2">
                  <span className="flex items-center gap-1 rounded-full bg-[#eef2ff] px-2.5 py-0.5 text-[10px] font-bold text-[#2563eb] border border-blue-100">
                    <BadgeCheck className="size-4 text-[#2563eb] fill-white" />
                    {doc.status === 'APPROVED' ? 'APPROVED' : doc.status}
                  </span>

                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#a3aed0] uppercase">
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

                {/* Creator Metadata (Created by and Created on inline, bold) */}
                <div className="flex flex-wrap gap-x-4 text-[11px] text-[#a3aed0] font-bold mt-3">
                  <span>
                    Created by: <span className="font-extrabold text-[#2b3674]">{doc.created_by || 'Sarah Chen'}</span>
                  </span>
                  <span>
                    Created on:{' '}
                    <span className="font-extrabold text-[#2b3674]">{formatDate(doc.created_at)}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Row: Divider + Tag & Views */}
            <div className="flex w-full items-center justify-between mt-4 pt-3 border-t border-slate-100">
              <span className="flex items-center gap-1 text-[11px] font-bold text-[#2563eb] uppercase tracking-wide">
                # #{doc.template?.template_type || 'ACADEMIC'}
              </span>
              <div className="flex items-center gap-1 text-[11px] text-[#a3aed0] font-bold">
                <Eye className="size-4" /> 12 views
              </div>
            </div>

          </button>
        );
      })}
    </div>
  );
};
