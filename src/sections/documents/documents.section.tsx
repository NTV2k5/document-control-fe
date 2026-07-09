import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  Download,
  LayoutGrid,
  List,
  Loader2,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import { DocumentGridView } from './document-grid-view.component';
import { DocumentSidePanel } from './document-side-panel.component';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Toast, type ToastProps } from '../../components';
import { useTranslation, type TTranslationParams } from '../../i18n';
import {
  applyVariablesToHtml,
  createDownloadFileName,
  formatDate,
  getCurrentTemplateDocxEditorSnapshotBuffer,
  navigateDocxExportPreviewWindow,
  openDocxExportPreviewWindow,
  writeDocxExportPreviewPayload,
  type TemplateDocxEditorSnapshot,
  type TemplateVariablesPayload,
} from '../../lib';
import { extractPageSize } from '../../models';
import type {
  IDocumentsSectionProps,
  TDocumentColumn,
  TDocumentRow,
  TDocumentsNavigate,
} from './documents.type';
import { DocumentInputAgentWidget } from './document-input-agent-widget';
import {
  Button,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from 'reactjs-platform/ui';
import {
  canAccessTemplates,
  isAdmin as isAdminProfile,
  isRootProfile,
  profileStore,
} from 'reactjs-platform/utilities';
import {
  approveDocumentAPI,
  deleteDocumentAPI,
  getDocumentByIdAPI,
  getTemplateByIdAPI,
  listDocumentsAPI,
  publishDocumentAPI,
  returnDocumentToDraftAPI,
  unpublishDocumentAPI,
  type DocumentStatus,
  type IDocument,
  type ITemplate,
} from 'api';
import type React from 'react';

type DocumentRow = TDocumentRow;
type TDocumentRowAction = 'approve' | 'return-draft' | 'publish' | 'unpublish' | 'delete';

const DEFAULT_PAGE_SIZE = 10;

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));
const getDocumentActionKey = (action: TDocumentRowAction, id: string) => `${action}:${id}`;

// 24 mock documents matching Figma design specs
const MOCK_DOCUMENTS: DocumentRow[] = Array.from({ length: 24 }, (_, index) => {
  const isAcademic = index < 12;
  const isFinancial = index >= 12 && index < 20;
  
  let title = `MH-Admin_Enrollment_Form_Final_${2025 - index}`;
  let artifact_type: IDocument['artifact_type'] = 'image_form';
  let template_type = 'ACADEMIC';
  let created_by = 'Sarah Chen';
  let status: DocumentStatus = 'APPROVED';
  
  if (isAcademic) {
    if (index % 2 === 0) {
      title = `MH-Admin_Enrollment_Form_Final_${2025 - index}`;
      artifact_type = 'image_form';
    } else {
      title = `Project_Internal_Assessment_Spreadsheet_V${index + 1}`;
      artifact_type = 'spreadsheet';
    }
    template_type = 'ACADEMIC';
    created_by = 'Sarah Chen';
    status = 'APPROVED';
  } else if (isFinancial) {
    title = `Quarterly_Financial_Statement_Q${(index % 4) + 1}_2025`;
    artifact_type = 'spreadsheet';
    template_type = 'FINANCIAL';
    created_by = 'David Wilson';
    status = 'APPROVED';
  } else {
    // 4 Pending/Word documents
    title = `Research_Proposal_Final_Draft_V${index - 19}`;
    artifact_type = 'rich_text';
    template_type = 'ACADEMIC'; // Classify under Academic for tab compatibility or keep general
    created_by = 'David Wilson';
    status = 'SUBMITTED';
  }

  return {
    id: `mock-doc-${index + 1}`,
    template_id: `mock-template-${index + 1}`,
    title,
    artifact_type,
    status,
    is_published: true,
    created_by,
    created_at: new Date(2025, 11, 12 - index, 10, 14, 0).toISOString(),
    updated_at: new Date(2025, 11, 12 - index, 10, 14, 0).toISOString(),
    visibility: 'PUBLIC',
    template: {
      id: `mock-template-${index + 1}`,
      name: `Template ${index + 1}`,
      version: 1,
      status: 'APPROVED',
      template_type,
      artifact_type,
      visibility: 'PUBLIC',
      organization_unit_id: 'mock-unit',
      source_file_name: `template_${index + 1}.${artifact_type === 'spreadsheet' ? 'xlsx' : artifact_type === 'image_form' ? 'pdf' : 'docx'}`,
      template_metadata: null,
    },
    permissions: {
      can_edit: false,
      can_delete: true,
      can_submit: false,
      can_approve: false,
      can_reject: false,
      can_publish: false,
      can_unpublish: false,
      can_reset_to_draft: false,
    },
  };
});

const parseVariablesPayload = (value: unknown): TemplateVariablesPayload | null => {
  if (!value) return null;

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as TemplateVariablesPayload;
    } catch {
      return null;
    }
  }

  return typeof value === 'object' ? (value as TemplateVariablesPayload) : null;
};

const buildVariableValueMap = (payload?: TemplateVariablesPayload | null) => {
  const values: Record<string, string> = {};

  if (!Array.isArray(payload?.variables)) return values;

  payload.variables.forEach((item) => {
    values[item.key] = item.value;
  });

  return values;
};

const getSnapshotBuffer = (snapshot: TemplateDocxEditorSnapshot | null | undefined, htmlContent: string) => {
  if (!snapshot?.base64) return null;

  return getCurrentTemplateDocxEditorSnapshotBuffer(snapshot, snapshot.html_content_key ?? htmlContent);
};

const buildTemplateExportPreviewInput = (template: ITemplate) => {
  const payload = parseVariablesPayload(template.variables);
  const rawContent = payload?.raw_content || template.content || '<p></p>';
  const htmlContent = applyVariablesToHtml(rawContent, buildVariableValueMap(payload));
  const snapshot = payload?.docx_editor_snapshot ?? null;

  return {
    source: 'template' as const,
    title: template.name,
    fileName: createDownloadFileName(template.source_file_name || template.name || 'template', 'docx'),
    htmlContent,
    initialDocumentBuffer: getSnapshotBuffer(snapshot, rawContent),
  };
};

const buildDocumentExportPreviewInput = (document: IDocument) => {
  const payload = parseVariablesPayload(document.data);
  const rawContent = payload?.raw_content || document.content || '<p></p>';
  const htmlContent = applyVariablesToHtml(rawContent, buildVariableValueMap(payload));
  const snapshot = payload?.docx_editor_snapshot ?? null;

  return {
    source: 'document' as const,
    title: document.title,
    fileName: createDownloadFileName(document.title || 'document', 'docx'),
    htmlContent,
    initialDocumentBuffer: getSnapshotBuffer(snapshot, rawContent),
  };
};

const getColumns = (
  navigate: TDocumentsNavigate,
  t: (key: string, params?: TTranslationParams) => string,
  isAdmin: boolean,
  canOpenTemplateDetail: boolean,
  pendingActionKey: string | null,
  onOpenTemplateFile: (row: TDocumentRow, canOpenTemplateDetail: boolean) => Promise<void>,
  onApprove: (row: TDocumentRow) => Promise<void>,
  onReturnToDraft: (row: TDocumentRow) => Promise<void>,
  onPublish: (row: TDocumentRow) => Promise<void>,
  onUnpublish: (row: TDocumentRow) => Promise<void>,
  onDelete: (row: TDocumentRow) => Promise<void>,
  onSelectDocument: (row: TDocumentRow) => void,
): TDocumentColumn[] => {
  return [
    {
      id: 'type',
      header: 'TYPE',
      cell: ({ row }) => {
        const typeLower = row.original.artifact_type?.toLowerCase() || '';
        let bgClass = 'bg-blue-50 text-blue-600 border border-blue-100/50';
        let text = 'DOC';
        if (typeLower === 'pdf') {
          bgClass = 'bg-red-50 text-red-500 border border-red-100/50';
          text = 'PDF';
        } else if (typeLower === 'excel' || typeLower === 'spreadsheet') {
          bgClass = 'bg-emerald-50 text-emerald-600 border border-emerald-100/50';
          text = 'XLS';
        }
        return (
          <span className={`inline-flex items-center justify-center rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wider ${bgClass}`}>
            {text}
          </span>
        );
      },
      meta: { className: 'w-16 min-w-[64px] text-center' },
    },
    {
      accessorKey: 'title',
      header: 'DOCUMENT NAME',
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col">
          <button
            type="button"
            onClick={() => onSelectDocument(row.original)}
            className="break-words text-left text-sm font-bold leading-5 text-[#1B2559] hover:underline focus:outline-none">
            {row.original.title}
          </button>
          <span className="mt-1 text-[10px] font-bold text-slate-400 uppercase">
            #{row.original.template?.template_type || 'ACADEMIC'}
          </span>
        </div>
      ),
      meta: { className: 'min-w-[240px] whitespace-normal' },
    },
    {
      id: 'creator',
      header: 'CREATOR',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <img
            src={`https://i.pravatar.cc/100?u=u${row.index}b`}
            alt="avatar"
            className="size-7 rounded-full bg-slate-200"
          />
          <span className="text-sm font-bold text-[#1B2559]">
            {row.original.created_by || 'Sarah Chen'}
          </span>
        </div>
      ),
      meta: { className: 'w-[180px] min-w-[150px]' },
    },
    {
      id: 'date',
      header: 'DATE',
      cell: ({ row }) => (
        <span className="text-sm font-semibold text-[#1B2559]">
          {formatDate(row.original.created_at)}
        </span>
      ),
      meta: { className: 'w-[120px] min-w-[100px]' },
    },
    {
      id: 'views',
      header: 'VIEWS',
      cell: () => (
        <span className="text-sm font-semibold text-slate-400">
          12
        </span>
      ),
      meta: { className: 'w-[80px] min-w-[60px] text-center' },
    },
    {
      id: 'status',
      header: 'STATUS',
      cell: ({ row }) => {
        const status = row.original.status;
        if (status === 'APPROVED') {
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-600 border border-blue-100/50">
              <svg className="size-3 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              APPROVED
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-600 border border-amber-100/50">
            {status}
          </span>
        );
      },
      meta: { className: 'w-[120px] min-w-[100px]' },
    },
    {
      id: 'actions',
      header: 'ACTIONS',
      meta: { frozen: 'right', frozenWidth: 84 },
      cell: ({ row }) => {
        const permissions = row.original.permissions;
        const canDelete = permissions?.can_delete ?? row.original.status === 'DRAFT';
        const canApprove = permissions?.can_approve ?? false;
        const canPublish = permissions?.can_publish ?? false;
        const canUnpublish = permissions?.can_unpublish ?? false;
        const canReturnToDraft = permissions?.can_reset_to_draft ?? false;
        const canEdit =
          permissions?.can_edit ?? (row.original.status === 'DRAFT' || row.original.status === 'REJECTED');
        const primaryActionLabel = canEdit ? t('documentsPage.actions.edit') : t('documentsPage.actions.view');
        const rowPending = Boolean(pendingActionKey?.endsWith(`:${row.original.id}`));
        const actionsDisabled = Boolean(pendingActionKey);
        const isActionPending = (action: TDocumentRowAction) =>
          pendingActionKey === getDocumentActionKey(action, row.original.id);

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-9 rounded-xl px-2.5" disabled={actionsDisabled}>
                {rowPending ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                disabled={actionsDisabled}
                onClick={() => navigate({ to: `/documents/${row.original.id}` })}>
                {primaryActionLabel}
              </DropdownMenuItem>
              {canApprove && (
                <DropdownMenuItem disabled={actionsDisabled} onClick={() => void onApprove(row.original)}>
                  {isActionPending('approve') && <Loader2 className="size-4 animate-spin" />}
                  {t('documentsPage.actions.approve')}
                </DropdownMenuItem>
              )}
              {canReturnToDraft && (
                <DropdownMenuItem disabled={actionsDisabled} onClick={() => void onReturnToDraft(row.original)}>
                  {isActionPending('return-draft') && <Loader2 className="size-4 animate-spin" />}
                  {t('documentsPage.actions.returnDraft')}
                </DropdownMenuItem>
              )}
              {canPublish && (
                <DropdownMenuItem disabled={actionsDisabled} onClick={() => void onPublish(row.original)}>
                  {isActionPending('publish') && <Loader2 className="size-4 animate-spin" />}
                  {t('documentsPage.actions.publish')}
                </DropdownMenuItem>
              )}
              {canUnpublish && (
                <DropdownMenuItem disabled={actionsDisabled} onClick={() => void onUnpublish(row.original)}>
                  {isActionPending('unpublish') && <Loader2 className="size-4 animate-spin" />}
                  {t('documentsPage.actions.unpublish')}
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem
                  disabled={actionsDisabled}
                  className="text-red-600 focus:text-red-600"
                  onClick={() => void onDelete(row.original)}>
                  {isActionPending('delete') ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  {t('documentsPage.actions.delete')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
};

export const DocumentsSection: React.FC<IDocumentsSectionProps> = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as { search?: string };
  const searchParamQuery = searchParams?.search || '';

  const profile = profileStore((s) => s.profile);
  const isAdmin = isAdminProfile(profile) || isRootProfile(profile);
  const canOpenTemplateDetail = canAccessTemplates(profile);

  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [selectedDocument, setSelectedDocument] = useState<IDocument | null>(null);

  const [searchQuery, setSearchQuery] = useState(searchParamQuery);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<ToastProps | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: DEFAULT_PAGE_SIZE,
    total: 0,
    total_pages: 0,
  });
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
  const pendingActionKeyRef = useRef<string | null>(null);

  const startRowAction = useCallback((actionKey: string) => {
    if (pendingActionKeyRef.current) {
      return false;
    }

    pendingActionKeyRef.current = actionKey;
    setPendingActionKey(actionKey);
    return true;
  }, []);

  const finishRowAction = useCallback(() => {
    pendingActionKeyRef.current = null;
    setPendingActionKey(null);
  }, []);

  const pageSize = extractPageSize(pagination);

  const documentListParams = useMemo(
    () => ({
      search: searchQuery || undefined,
      template_type: typeFilter === 'ALL' ? undefined : typeFilter,
      page: pagination.page,
      page_size: pageSize,
      sort: 'desc:updated_at',
    }),
    [searchQuery, typeFilter, pagination.page, pageSize],
  );

  const fetchDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await listDocumentsAPI(documentListParams);

      setDocuments(res.data);
      
      setPagination((prev) => {
        if (
          prev.total === res.pagination.total &&
          prev.total_pages === res.pagination.total_pages &&
          prev.page === res.pagination.page &&
          prev.page_size === res.pagination.page_size
        ) {
          return prev;
        }

        return {
          ...prev,
          total: res.pagination.total,
          total_pages: res.pagination.total_pages,
          page: res.pagination.page,
          page_size: res.pagination.page_size,
        };
      });
    } catch (error: unknown) {
      setToast({
        message: t('documentsPage.messages.loadFailed', { error: getErrorMessage(error) }),
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [documentListParams, t]);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  // Sync Header search changes with the page search state
  useEffect(() => {
    setSearchQuery(searchParamQuery);
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [searchParamQuery]);

  // memory-based filtering and slicing when backend is empty
  const displayDocs = useMemo(() => {
    let list = documents;
    
    // Fallback to MOCK_DOCUMENTS if backend list is empty and not loading
    if (list.length === 0 && !isLoading) {
      list = MOCK_DOCUMENTS;
    }

    if (searchQuery) {
      list = list.filter((doc) => doc.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    if (typeFilter !== 'ALL') {
      list = list.filter((doc) => doc.template?.template_type === typeFilter);
    }

    return list;
  }, [documents, searchQuery, typeFilter, isLoading]);

  // Adjust pagination info based on displayed list
  const totalEntries = displayDocs.length;
  const totalPages = Math.ceil(totalEntries / pageSize);

  const paginatedDocs = useMemo(() => {
    if (documents.length > 0) {
      return displayDocs; // server paginated already
    }
    // client-side pagination for mock list
    const start = (pagination.page - 1) * pageSize;
    const end = start + pageSize;
    return displayDocs.slice(start, end);
  }, [displayDocs, documents.length, pagination.page, pageSize]);


  const handleDelete = useCallback(
    async (row: DocumentRow) => {
      const confirmed = window.confirm(t('documentsPage.messages.confirmDelete', { name: row.title }));
      if (!confirmed) return;
      if (!startRowAction(getDocumentActionKey('delete', row.id))) return;

      try {
        await deleteDocumentAPI(row.id);
        setToast({
          message: t('documentsPage.messages.deleted'),
          type: 'success',
        });
        if (selectedDocument?.id === row.id) {
          setSelectedDocument(null);
        }
        await fetchDocuments();
      } catch (error: unknown) {
        setToast({
          message: t('documentsPage.messages.deleteFailed', { error: getErrorMessage(error) }),
          type: 'error',
        });
      } finally {
        finishRowAction();
      }
    },
    [fetchDocuments, finishRowAction, startRowAction, t, selectedDocument],
  );

  const handleApprove = useCallback(
    async (row: DocumentRow) => {
      const confirmed = window.confirm(t('documentsPage.messages.confirmApprove', { name: row.title }));
      if (!confirmed) return;
      if (!startRowAction(getDocumentActionKey('approve', row.id))) return;

      try {
        await approveDocumentAPI(row.id);
        setToast({
          message: t('documentsPage.messages.approved'),
          type: 'success',
        });
        await fetchDocuments();
      } catch (error: unknown) {
        setToast({
          message: t('documentsPage.messages.approveFailed', { error: getErrorMessage(error) }),
          type: 'error',
        });
      } finally {
        finishRowAction();
      }
    },
    [fetchDocuments, finishRowAction, startRowAction, t],
  );

  const handleReturnToDraft = useCallback(
    async (row: DocumentRow) => {
      const confirmed = window.confirm(t('documentsPage.messages.confirmReturnDraft', { name: row.title }));
      if (!confirmed) return;
      if (!startRowAction(getDocumentActionKey('return-draft', row.id))) return;

      try {
        await returnDocumentToDraftAPI(row.id);
        setToast({
          message: t('documentsPage.messages.returnedDraft'),
          type: 'success',
        });
        await fetchDocuments();
      } catch (error: unknown) {
        setToast({
          message: t('documentsPage.messages.returnDraftFailed', { error: getErrorMessage(error) }),
          type: 'error',
        });
      } finally {
        finishRowAction();
      }
    },
    [fetchDocuments, finishRowAction, startRowAction, t],
  );

  const handlePublish = useCallback(
    async (row: DocumentRow) => {
      const confirmed = window.confirm(t('documentsPage.messages.confirmPublish', { name: row.title }));
      if (!confirmed) return;
      if (!startRowAction(getDocumentActionKey('publish', row.id))) return;

      try {
        await publishDocumentAPI(row.id);
        setToast({
          message: t('documentsPage.messages.published'),
          type: 'success',
        });
        await fetchDocuments();
      } catch (error: unknown) {
        setToast({
          message: t('documentsPage.messages.publishFailed', { error: getErrorMessage(error) }),
          type: 'error',
        });
      } finally {
        finishRowAction();
      }
    },
    [fetchDocuments, finishRowAction, startRowAction, t],
  );

  const handleUnpublish = useCallback(
    async (row: DocumentRow) => {
      const confirmed = window.confirm(t('documentsPage.messages.confirmUnpublish', { name: row.title }));
      if (!confirmed) return;
      if (!startRowAction(getDocumentActionKey('unpublish', row.id))) return;

      try {
        await unpublishDocumentAPI(row.id);
        setToast({
          message: t('documentsPage.messages.unpublished'),
          type: 'success',
        });
        await fetchDocuments();
      } catch (error: unknown) {
        setToast({
          message: t('documentsPage.messages.unpublishFailed', { error: getErrorMessage(error) }),
          type: 'error',
        });
      } finally {
        finishRowAction();
      }
    },
    [fetchDocuments, finishRowAction, startRowAction, t],
  );

  const handleOpenTemplateFile = useCallback(
    async (row: DocumentRow, canOpenDetail: boolean) => {
      const template = row.template;
      if (!template) return;

      if (canOpenDetail) {
        navigate({ to: `/templates/${template.id}` });
        return;
      }

      let previewWindow: Window | null = null;

      try {
        previewWindow = openDocxExportPreviewWindow();

        const templateDetail = await getTemplateByIdAPI(template.id).catch(() => null);
        const previewInput = templateDetail
          ? buildTemplateExportPreviewInput(templateDetail)
          : buildDocumentExportPreviewInput(await getDocumentByIdAPI(row.id));
        const payload = await writeDocxExportPreviewPayload(previewInput);
        navigateDocxExportPreviewWindow(previewWindow, payload.id);
      } catch (error: unknown) {
        previewWindow?.close();
        setToast({
          message: t('documentsPage.messages.openTemplateFailed', { error: getErrorMessage(error) }),
          type: 'error',
        });
      }
    },
    [t, navigate],
  );

  const columns = useMemo(
    () =>
      getColumns(
        navigate,
        t,
        isAdmin,
        canOpenTemplateDetail,
        pendingActionKey,
        handleOpenTemplateFile,
        handleApprove,
        handleReturnToDraft,
        handlePublish,
        handleUnpublish,
        handleDelete,
        setSelectedDocument,
      ),
    [
      handleApprove,
      canOpenTemplateDetail,
      handleDelete,
      handleOpenTemplateFile,
      handlePublish,
      handleReturnToDraft,
      handleUnpublish,
      isAdmin,
      navigate,
      pendingActionKey,
      t,
    ],
  );

  const handleTabClick = (type: string) => {
    setTypeFilter(type);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  return (
    <div className="space-y-6" onClick={() => setSelectedDocument(null)}>
      {/* ── Title & Export ── */}
      <div className="flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
        <h1 className="text-3xl font-bold text-slate-900">Published Documents</h1>
        <Button
          size="sm"
          className="h-10 rounded-xl bg-[#2563eb] px-6 font-bold hover:bg-blue-700 shadow-md shadow-blue-600/10">
          <Download className="mr-2 size-4" />
          Export Excel
        </Button>
      </div>

      {/* ── Tabs & View Toggle ── */}
      <div className="flex items-center justify-between border-b border-slate-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-8">
          <button
            onClick={() => handleTabClick('ALL')}
            className={`pb-3 text-sm font-bold transition-all border-b-2 ${
              typeFilter === 'ALL'
                ? 'border-blue-600 text-[#2563eb]'
                : 'border-transparent text-[#A3AED0] hover:text-slate-600'
            }`}>
            ALL ({documents.length > 0 ? pagination.total : 24})
          </button>
          <button
            onClick={() => handleTabClick('ACADEMIC')}
            className={`pb-3 text-sm font-bold transition-all border-b-2 ${
              typeFilter === 'ACADEMIC'
                ? 'border-blue-600 text-[#2563eb]'
                : 'border-transparent text-[#A3AED0] hover:text-slate-600'
            }`}>
            ACADEMIC DOCS (12)
          </button>
          <button
            onClick={() => handleTabClick('FINANCIAL')}
            className={`pb-3 text-sm font-bold transition-all border-b-2 ${
              typeFilter === 'FINANCIAL'
                ? 'border-blue-600 text-[#2563eb]'
                : 'border-transparent text-[#A3AED0] hover:text-slate-600'
            }`}>
            FINANCIAL (8)
          </button>
        </div>

        <div className="flex items-center gap-2 pb-2">
          <div className="flex items-center rounded-xl bg-white p-1 border border-slate-100">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex size-8 items-center justify-center rounded-lg transition-colors ${
                viewMode === 'grid' ? 'bg-blue-50 text-[#2563eb]' : 'text-slate-400 hover:text-slate-600'
              }`}>
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex size-8 items-center justify-center rounded-lg transition-colors ${
                viewMode === 'list' ? 'bg-blue-50 text-[#2563eb]' : 'text-slate-400 hover:text-slate-600'
              }`}>
              <List className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Two Column Responsive Layout ── */}
      <div className="flex flex-col gap-6 lg:flex-row items-start">
        {/* Left main contents (table / grid and pagination controls) */}
        <div className="flex-1 min-w-0 w-full space-y-6">
          <div className="rounded-[28px] border border-slate-100 bg-white p-6 shadow-sm">
            {viewMode === 'list' ? (
              <div onClick={(e) => e.stopPropagation()}>
                <DataTable
                  fixedHeader
                  enableFreezeColumns
                  columns={columns}
                  data={paginatedDocs}
                  loading={isLoading}
                  pagination={pagination}
                  hidePagination={true}
                  onPaginationChange={(updater) => setPagination((prev) => updater(prev))}
                />
              </div>
            ) : (
              <div onClick={(e) => e.stopPropagation()}>
                <DocumentGridView
                  documents={paginatedDocs}
                  selectedDocument={selectedDocument}
                  onSelectDocument={setSelectedDocument}
                  hasSelection={!!selectedDocument}
                />
              </div>
            )}

            {/* Custom Figma-style Pagination Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-50 pt-5 mt-6" onClick={(e) => e.stopPropagation()}>
              <div className="text-xs font-semibold text-slate-400">
                Displaying {totalEntries > 0 ? (pagination.page - 1) * pageSize + 1 : 0} -{' '}
                {Math.min(pagination.page * pageSize, totalEntries)} of {totalEntries} entries
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                <span>Results per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const newSize = Number(e.target.value);
                    setPagination((prev) => ({
                      ...prev,
                      page_size: newSize,
                      page: 1,
                    }));
                  }}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 focus:border-blue-400 focus:outline-none">
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                  className="flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  &lt;
                </button>
                
                {Array.from({ length: totalPages || 1 }, (_, i) => i + 1).map((p) => {
                  const isCurrent = p === pagination.page;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPagination((prev) => ({ ...prev, page: p }))}
                      className={`flex size-8 items-center justify-center rounded-lg text-xs font-bold transition-all ${
                        isCurrent
                          ? 'bg-[#2563eb] text-white shadow-md shadow-blue-600/10'
                           : 'border border-transparent text-slate-600 hover:bg-slate-50'
                      }`}>
                      {p}
                    </button>
                  );
                })}

                <button
                  type="button"
                  disabled={pagination.page >= (totalPages || 1)}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                  className="flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                  &gt;
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Embedded Side Panel (Desktop inline variant) */}
        {selectedDocument && (
          <div className="hidden xl:block" onClick={(e) => e.stopPropagation()}>
            <DocumentSidePanel
              document={selectedDocument}
              onClose={() => setSelectedDocument(null)}
              inline={true}
            />
          </div>
        )}
      </div>

      {/* Drawer variant for mobile/tablet */}
      <div className="block xl:hidden" onClick={(e) => e.stopPropagation()}>
        {selectedDocument && (
          <DocumentSidePanel
            document={selectedDocument}
            onClose={() => setSelectedDocument(null)}
            inline={false}
          />
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <DocumentInputAgentWidget />
    </div>
  );
};
