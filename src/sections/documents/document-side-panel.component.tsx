import { X, FileText, Download, Edit3, UserPlus, Folder } from 'lucide-react';
import { type IDocument, exportOfficeArtifactAPI } from 'api';
import { formatDate } from '../../lib';
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';

interface IDocumentSidePanelProps {
  document: IDocument | null;
  onClose: () => void;
  inline?: boolean;
}

export const DocumentSidePanel = ({ document, onClose, inline = false }: IDocumentSidePanelProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'detail' | 'activity' | 'version'>('detail');
  const [downloading, setDownloading] = useState(false);

  if (!document) {
    if (inline) {
      return (
        <div className="hidden xl:flex w-full xl:w-[380px] shrink-0 flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white p-8 text-center text-slate-400 min-h-[400px]">
          <FileText className="mb-4 size-12 opacity-20" />
          <p className="text-sm font-semibold">Select a document</p>
          <p className="text-xs text-slate-400 mt-1">Click on a document card or list row to see its details here.</p>
        </div>
      );
    }
    return null;
  }

  const getDocIcon = (type?: string) => {
    const typeLower = type?.toLowerCase() || '';
    if (typeLower === 'pdf') {
      return <FileText className="size-6 text-red-500" />;
    }
    if (typeLower === 'excel' || typeLower === 'spreadsheet') {
      return <FileText className="size-6 text-emerald-600" />;
    }
    return <FileText className="size-6 text-blue-600" />;
  };

  const getDocIconBg = (type?: string) => {
    const typeLower = type?.toLowerCase() || '';
    if (typeLower === 'pdf') return 'bg-red-50 border border-red-100/50';
    if (typeLower === 'excel' || typeLower === 'spreadsheet') return 'bg-emerald-50 border border-emerald-100/50';
    return 'bg-blue-50 border border-blue-100/50';
  };

  const handleDownload = async () => {
    if (!document) return;
    try {
      setDownloading(true);
      const isSpreadsheet = document.artifact_type === 'spreadsheet';
      const isPresentation = document.artifact_type === 'presentation';
      const format = isSpreadsheet ? 'xlsx' : isPresentation ? 'pptx' : 'pdf';
      
      const blob = await exportOfficeArtifactAPI('document', document.id, format);
      
      const suggestedName = `${document.title || 'document'}.${format}`;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = suggestedName;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading document:', err);
    } finally {
      setDownloading(false);
    }
  };

  const panelContent = (
    <div className="flex flex-1 flex-col h-full">
      {/* Header Title */}
      <div className={`flex items-start justify-between ${inline ? 'px-1 py-4' : 'px-8 py-6 pt-10'}`}>
        <div className="flex items-start gap-4">
          <div className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${getDocIconBg(document.artifact_type)}`}>
            {getDocIcon(document.artifact_type)}
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[#1B2559] truncate leading-tight" title={document.title}>
              {document.title}
            </h2>
            <p className="text-xs text-[#A3AED0] mt-1">Document ID: #{document.id.slice(0, 12)}</p>
          </div>
        </div>
        {!inline && (
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100">
            <X className="size-5" />
          </button>
        )}
      </div>

      {/* Pill-style Tabs Capsule */}
      <div className={`bg-[#F4F7FE] p-1 rounded-xl flex gap-1 mb-6 ${inline ? '' : 'mx-8'}`}>
        <button
          type="button"
          onClick={() => setActiveTab('detail')}
          className={`flex-1 text-center py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'detail' ? 'bg-white text-blue-600 shadow-sm' : 'text-[#A3AED0] hover:text-slate-600'
          }`}>
          Detail
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('activity')}
          className={`flex-1 text-center py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'activity' ? 'bg-white text-blue-600 shadow-sm' : 'text-[#A3AED0] hover:text-slate-600'
          }`}>
          Activity
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('version')}
          className={`flex-1 text-center py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'version' ? 'bg-white text-blue-600 shadow-sm' : 'text-[#A3AED0] hover:text-slate-600'
          }`}>
          Version
        </button>
      </div>

      {/* Scrollable Body Content */}
      <div className={`flex-1 overflow-y-auto space-y-6 ${inline ? 'px-1' : 'px-8 py-2'}`}>
        {activeTab === 'detail' && (
          <>
            {/* Preview Restriction Box */}
            <div className="flex flex-col items-center justify-center rounded-2xl bg-[#F4F7FE] border border-[#E9EDF7] p-8 text-center">
              <span className="text-[10px] font-black text-red-500 uppercase tracking-widest bg-red-50 border border-red-100/50 px-3 py-1 rounded-full mb-4">
                Demo Document Only
              </span>
              <FileText className="size-12 text-[#A3AED0] mb-4 opacity-40" />
              <p className="text-xs text-[#A3AED0] max-w-[200px] leading-relaxed mb-6">
                Preview is currently restricted. Please download to view full content.
              </p>
              <button
                type="button"
                onClick={() => navigate({ to: '/documents/$id', params: { id: document.id } })}
                className="rounded-full border border-slate-200 bg-white px-6 py-2 text-xs font-bold text-[#1B2559] shadow-sm hover:bg-slate-50 transition">
                View Fullscreen
              </button>
            </div>

            {/* Metas details */}
            <div className="space-y-6">
              {/* Recipients */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#A3AED0] mb-2.5">Recipients</p>
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-1.5">
                    <img src="https://i.pravatar.cc/100?img=33" alt="A" className="size-7 rounded-full ring-2 ring-white bg-slate-200" />
                    <img src="https://i.pravatar.cc/100?img=12" alt="B" className="size-7 rounded-full ring-2 ring-white bg-slate-200" />
                  </div>
                  <button
                    type="button"
                    className="flex size-7 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400 hover:text-slate-600 hover:border-slate-400">
                    <UserPlus className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Created Date & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#A3AED0] mb-1.5">Created On</p>
                  <p className="text-xs font-bold text-[#1B2559]">{formatDate(document.created_at)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#A3AED0] mb-1.5">Status</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="size-2 rounded-full bg-emerald-500"></div>
                    <span className="text-xs font-bold text-emerald-600 uppercase">Active</span>
                  </div>
                </div>
              </div>

              {/* Folder */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#A3AED0] mb-2.5">Folder</p>
                <div className="inline-flex items-center gap-2 rounded-lg bg-[#F4F7FE] px-3 py-1.5 text-xs font-bold text-[#1B2559]">
                  <Folder className="size-3.5 text-[#A3AED0]" />
                  Nhân sự (Human Resources)
                </div>
              </div>

              {/* Tags */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#A3AED0] mb-2.5">Tags</p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs font-bold text-blue-500 bg-blue-50 px-3 py-1 rounded-full border border-blue-100/50">#Company Docs</span>
                  <span className="text-xs font-bold text-blue-500 bg-blue-50 px-3 py-1 rounded-full border border-blue-100/50">#Internal</span>
                  <span className="text-xs font-bold text-blue-500 bg-blue-50 px-3 py-1 rounded-full border border-blue-100/50">#2025</span>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'activity' && (
          <div className="py-8 text-center text-xs text-slate-400">
            No recent activity recorded for this document.
          </div>
        )}

        {activeTab === 'version' && (
          <div className="py-8 text-center text-xs text-slate-400">
            Version 1.0 (Current)
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className={`flex items-center gap-3 border-t border-slate-100 mt-6 ${inline ? 'px-1 py-4' : 'p-6'}`}>
        <button
          type="button"
          disabled={downloading}
          onClick={handleDownload}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 px-4 font-bold text-xs text-[#1B2559] hover:bg-slate-50 transition shadow-sm disabled:opacity-50">
          <Download className="size-3.5" /> {downloading ? 'Downloading...' : 'Download'}
        </button>
        <button
          type="button"
          onClick={() => navigate({ to: '/documents/$id', params: { id: document.id } })}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 py-3 px-4 font-bold text-xs text-white shadow-md shadow-blue-600/10 transition">
          <Edit3 className="size-3.5" /> Edit Details
        </button>
      </div>
    </div>
  );

  if (inline) {
    return (
      <div
        className="hidden xl:flex w-full xl:w-[380px] shrink-0 flex-col border border-slate-100 bg-white p-6 rounded-2xl shadow-sm h-fit"
        onClick={(e) => e.stopPropagation()}
      >
        {panelContent}
      </div>
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-900/15 backdrop-blur-[1px] transition-opacity"
        onClick={onClose}
      />
      <div
        className="fixed bottom-0 right-0 top-0 z-50 flex w-[450px] flex-col border-l border-slate-200 bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.05)] transition-transform duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {panelContent}
      </div>
    </>
  );
};

