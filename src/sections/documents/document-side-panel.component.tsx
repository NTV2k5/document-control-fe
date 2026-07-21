import { X, FileText, Download, Edit3, UserPlus, Folder } from 'lucide-react';
import { type IDocument, exportOfficeArtifactAPI, getFileVersionsAPI, type IFileVersion, updateDocumentAPI } from 'api';
import { formatDate } from '../../lib';
import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'react-toastify';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
} from 'reactjs-platform/ui';

interface IDocumentSidePanelProps {
  document: IDocument | null;
  onClose: () => void;
  inline?: boolean;
  onFolderClick?: (folder: string) => void;
  onTagClick?: (tag: string) => void;
  onDocumentUpdated?: (doc: IDocument) => void;
}

export const DocumentSidePanel = ({
  document,
  onClose,
  inline = false,
  onFolderClick,
  onTagClick,
  onDocumentUpdated,
}: IDocumentSidePanelProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'detail' | 'activity' | 'version'>('detail');
  const [downloading, setDownloading] = useState(false);
  const [versions, setVersions] = useState<IFileVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // Modal States
  const [isAddRecipientOpen, setIsAddRecipientOpen] = useState(false);
  const [isAddTagOpen, setIsAddTagOpen] = useState(false);
  const [newRecipientEmail, setNewRecipientEmail] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [isSubmittingRecipient, setIsSubmittingRecipient] = useState(false);
  const [isSubmittingTag, setIsSubmittingTag] = useState(false);

  useEffect(() => {
    if (activeTab === 'version' && document?.id) {
      setLoadingVersions(true);
      getFileVersionsAPI(document.id)
        .then(setVersions)
        .catch((err) => console.error('Failed to load file versions:', err))
        .finally(() => setLoadingVersions(false));
    }
  }, [activeTab, document?.id]);

  const handleAddRecipientClick = () => {
    setNewRecipientEmail('');
    setIsAddRecipientOpen(true);
  };

  const handleAddTagClick = () => {
    setNewTagName('');
    setIsAddTagOpen(true);
  };

  const handleRecipientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!document || isSubmittingRecipient) return;
    const email = newRecipientEmail.trim();
    if (!email) return;

    setIsSubmittingRecipient(true);
    try {
      const currentRecipients = document.recipients || [];
      if (currentRecipients.includes(email)) {
        toast.error("Recipient already added.");
        setIsSubmittingRecipient(false);
        return;
      }
      const updatedRecipients = [...currentRecipients, email];

      const updatedDoc = await updateDocumentAPI(document.id, {
        recipients: updatedRecipients
      });

      onDocumentUpdated?.(updatedDoc);
      setIsAddRecipientOpen(false);
      toast.success("Recipient added successfully.");
    } catch (err) {
      console.error("Failed to add recipient:", err);
      toast.error("Failed to add recipient.");
    } finally {
      setIsSubmittingRecipient(false);
    }
  };

  const handleTagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!document || isSubmittingTag) return;
    const tag = newTagName.trim().replace(/^#/, '');
    if (!tag) return;

    setIsSubmittingTag(true);
    try {
      const currentTags = document.tags || [];
      if (currentTags.includes(tag)) {
        toast.error("Tag already exists.");
        setIsSubmittingTag(false);
        return;
      }
      const updatedTags = [...currentTags, tag];

      const updatedDoc = await updateDocumentAPI(document.id, {
        tags: updatedTags
      });

      onDocumentUpdated?.(updatedDoc);
      setIsAddTagOpen(false);
      toast.success("Tag added successfully.");
    } catch (err) {
      console.error("Failed to add tag:", err);
      toast.error("Failed to add tag.");
    } finally {
      setIsSubmittingTag(false);
    }
  };


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
    if (typeLower === 'pdf' || typeLower === 'image_form') {
      return <FileText className="size-6 text-red-500" />;
    }
    if (
      typeLower === 'excel' ||
      typeLower === 'spreadsheet' ||
      typeLower === 'rich_text' ||
      typeLower === 'word'
    ) {
      return <FileText className="size-6 text-emerald-500" />;
    }
    return <FileText className="size-6 text-blue-600" />;
  };

  const getDocIconBg = (type?: string) => {
    const typeLower = type?.toLowerCase() || '';
    if (typeLower === 'pdf' || typeLower === 'image_form') {
      return 'bg-red-50 border border-red-100/50';
    }
    if (
      typeLower === 'excel' ||
      typeLower === 'spreadsheet' ||
      typeLower === 'rich_text' ||
      typeLower === 'word'
    ) {
      return 'bg-emerald-50 border border-emerald-100/50';
    }
    return 'bg-blue-50 border border-blue-100/50';
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'APPROVED' || s === 'PUBLISHED') {
      return {
        bg: 'bg-emerald-500',
        text: 'text-emerald-600',
        label: s === 'PUBLISHED' ? 'Published' : 'Approved'
      };
    }
    if (s === 'REJECTED') {
      return {
        bg: 'bg-red-500',
        text: 'text-red-600',
        label: 'Rejected'
      };
    }
    return {
      bg: 'bg-amber-500',
      text: 'text-amber-600',
      label: s || 'Draft'
    };
  };

  const handleDownload = async () => {
    if (!document) return;
    try {
      setDownloading(true);
      if (document.file_url) {
        const fullUrl = document.file_url.startsWith('http') ? document.file_url : `${import.meta.env.VITE_API_ENDPOINT || ''}${document.file_url}`;
        const a = window.document.createElement('a');
        a.href = fullUrl;
        a.download = document.title || 'download';
        a.target = '_blank';
        a.click();
        return;
      }
      
      const isSpreadsheet = document.artifact_type === 'spreadsheet';
      const isPresentation = document.artifact_type === 'presentation';
      const format = isSpreadsheet ? 'xlsx' : isPresentation ? 'pptx' : 'pdf';
      
      const blob = await exportOfficeArtifactAPI('document', document.id, format);
      
      const suggestedName = `${document.title || 'document'}.${format}`;
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
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
      <div className={`flex items-start justify-between min-w-0 w-full ${inline ? 'px-1 py-4' : 'px-8 py-6 pt-10'}`}>
        <div className="flex items-start gap-4 min-w-0 flex-1">
          <div className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${getDocIconBg(document.artifact_type)}`}>
            {getDocIcon(document.artifact_type)}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-[#1B2559] truncate leading-tight pr-4" title={document.title}>
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
                  <div className="flex -space-x-1.5 flex-wrap">
                    {(document.recipients || []).length === 0 ? (
                      <span className="text-xs text-[#A3AED0] italic">No recipients added</span>
                    ) : (
                      (document.recipients || []).map((email, idx) => {
                        const initial = email.charAt(0).toUpperCase();
                        return (
                          <div
                            key={email}
                            title={email}
                            className="size-7 rounded-full ring-2 ring-white bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700"
                            style={{ zIndex: 10 - idx }}
                          >
                            {initial}
                          </div>
                        );
                      })
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleAddRecipientClick}
                    className="flex size-7 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400 hover:text-slate-600 hover:border-slate-400 cursor-pointer">
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
                  {(() => {
                    const badge = getStatusBadge(document.status || '');
                    return (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className={`size-2 rounded-full ${badge.bg}`}></div>
                        <span className={`text-xs font-bold ${badge.text} uppercase`}>{badge.label}</span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Folder */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#A3AED0] mb-2.5">Folder</p>
                <button
                  type="button"
                  onClick={() => {
                    if (document.folder && onFolderClick) {
                      onFolderClick(document.folder);
                    }
                  }}
                  disabled={!document.folder || !onFolderClick}
                  className={`inline-flex items-center gap-2 rounded-lg bg-[#F4F7FE] px-3 py-1.5 text-xs font-bold text-[#1B2559] transition ${onFolderClick && document.folder ? 'hover:bg-slate-200/80 cursor-pointer' : 'cursor-default'}`}>
                  <Folder className="size-3.5 text-[#A3AED0]" />
                  {document.folder || 'None'}
                </button>
              </div>

              {/* Tags */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#A3AED0] mb-2.5">Tags</p>
                <div className="flex flex-wrap gap-2 items-center">
                  {(document.tags || []).length === 0 ? (
                    <span className="text-xs text-[#A3AED0] italic">No tags</span>
                  ) : (
                    (document.tags || []).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => onTagClick?.(t)}
                        className="text-xs font-bold text-blue-500 bg-blue-50 px-3 py-1 rounded-full border border-blue-100/50 hover:bg-blue-100 transition cursor-pointer">
                        #{t}
                      </button>
                    ))
                  )}
                  <button
                    type="button"
                    onClick={handleAddTagClick}
                    className="flex size-7 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400 hover:text-slate-600 hover:border-slate-400 cursor-pointer">
                    <UserPlus className="size-3.5" />
                  </button>
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
          <div className="flex flex-col gap-4 mt-4">
            {loadingVersions ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading versions...</div>
            ) : versions.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No versions recorded for this document.</div>
            ) : (
              <div className="flex flex-col gap-3">
                {versions.map((ver) => (
                  <div key={ver.name} className="flex flex-col gap-1.5 p-3 rounded-2xl bg-slate-50/50 border border-slate-100 break-all whitespace-normal">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center rounded-lg bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600 border border-blue-100/50">
                        {ver.version_number}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {formatDate(ver.creation)}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-700 mt-1 break-all whitespace-normal">
                      Updated by {ver.full_name || ver.owner}
                    </div>
                    {ver.data && (() => {
                      try {
                        const parsed = JSON.parse(ver.data);
                        if (parsed.changed && parsed.changed.length > 0) {
                          return (
                            <div className="text-[10px] text-slate-500 bg-white p-2 rounded-xl mt-1 border border-slate-100/60 flex flex-col gap-0.5 break-all whitespace-normal">
                              {parsed.changed.map((change: any, idx: number) => (
                                <div key={idx} className="break-all whitespace-normal">
                                  Changed <strong className="text-slate-600 break-all">{change[0]}</strong> from <span className="line-through text-slate-400 break-all">{String(change[1])}</span> to <span className="font-semibold text-slate-600 break-all">{String(change[2])}</span>
                                </div>
                              ))}
                            </div>
                          );
                        }
                      } catch {
                        // ignore
                      }
                      return null;
                    })()}
                  </div>
                ))}
              </div>
            )}
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

  return (
    <>
      {inline ? (
        <div
          className="hidden xl:flex w-full xl:w-[380px] shrink-0 flex-col border border-slate-100 bg-white p-6 rounded-2xl shadow-sm h-fit"
          onClick={(e) => e.stopPropagation()}
        >
          {panelContent}
        </div>
      ) : (
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
      )}

      {/* Add Recipient Modal */}
      <Dialog open={isAddRecipientOpen} onOpenChange={setIsAddRecipientOpen}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6">
          <form onSubmit={handleRecipientSubmit}>
            <DialogHeader>
              <DialogTitle className="text-[17px] font-bold text-slate-800">
                Add Recipient
              </DialogTitle>
            </DialogHeader>
            <div className="py-6 flex flex-col gap-2">
              <Label htmlFor="recipient-email" className="text-xs font-bold text-slate-500">
                Recipient Email
              </Label>
              <Input
                id="recipient-email"
                type="email"
                value={newRecipientEmail}
                onChange={(e) => setNewRecipientEmail(e.target.value)}
                placeholder="Enter email address..."
                className="h-11 rounded-xl border-slate-200 text-sm focus-visible:ring-blue-600"
                autoFocus
                required
              />
            </div>
            <DialogFooter className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500"
                onClick={() => setIsAddRecipientOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingRecipient}
                className="h-10 rounded-xl bg-blue-600 px-5 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmittingRecipient ? 'Adding...' : 'Add'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Tag Modal */}
      <Dialog open={isAddTagOpen} onOpenChange={setIsAddTagOpen}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6">
          <form onSubmit={handleTagSubmit}>
            <DialogHeader>
              <DialogTitle className="text-[17px] font-bold text-slate-800">
                Add Tag
              </DialogTitle>
            </DialogHeader>
            <div className="py-6 flex flex-col gap-2">
              <Label htmlFor="tag-name" className="text-xs font-bold text-slate-500">
                Tag Name
              </Label>
              <Input
                id="tag-name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Enter tag name (e.g. Invoices)..."
                className="h-11 rounded-xl border-slate-200 text-sm focus-visible:ring-blue-600"
                autoFocus
                required
              />
            </div>
            <DialogFooter className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500"
                onClick={() => setIsAddTagOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingTag}
                className="h-10 rounded-xl bg-blue-600 px-5 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmittingTag ? 'Adding...' : 'Add'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

