import { Link, useNavigate } from '@tanstack/react-router';
import { ChevronRight, Eye, FilePlus2, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApprovalStatusBadge, Toast, type ToastProps } from '../../../components';
import {
  DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE,
  applyVariablesToHtmlWithHighlight,
  formatDate,
  generateDocumentHtml,
  generateTableHtmlFromTableTemplate,
  getDocumentTemplateById,
  normalizeVariableHtml,
  rebuildRawContentFromRenderedHtml,
  type DocumentTemplate,
  type TemplateVariablesPayload,
} from '../../../lib';
import type {
  IMetadataItemProps,
  INewDocumentSectionProps,
  TApprovedTemplate,
  TApprovedTemplateDetail,
} from './new-document.type';
import {
  Button,
  Input,
  SearchableSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from 'reactjs-platform/ui';
import { hasPermission, profileStore } from 'reactjs-platform/utilities';
import {
  applyLabelExpr,
  createDocumentAPI,
  getDocumentFilterConfigByType,
  getFilterFieldsForType,
  getMetadataByKeyAPI,
  getTemplateByIdAPI,
  getTemplateTableOptionsAPI,
  listTemplatesAPI,
  type FilterConfigByType,
  type FilterConfigMetaValues,
  type ITemplateMetadata,
  type MetadataOption,
} from 'api';
import type React from 'react';

const normalizeTemplateVariables = (value: unknown) => {
  if (value == null) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
};

const parseVariablesPayload = (value: unknown): TemplateVariablesPayload | null => {
  if (!value) return null;

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as TemplateVariablesPayload;
    } catch {
      return null;
    }
  }

  if (typeof value === 'object') {
    return value as TemplateVariablesPayload;
  }

  return null;
};

type FilterOptionWithRecord = {
  value: string;
  label: string;
  record?: Record<string, unknown>;
};

const getRecordCode = (record?: Record<string, unknown>) => {
  const code = record?.code;
  return typeof code === 'string' ? code.trim() : '';
};

const appendRecordCodeToFilterLabels = <T extends FilterOptionWithRecord>(options: T[]) => {
  return options.map((option) => {
    const code = getRecordCode(option.record);
    if (!code || option.label.toLowerCase().includes(code.toLowerCase())) return option;

    return {
      ...option,
      label: `${option.label} (${code})`,
    };
  });
};

const buildDocumentPreviewHtml = (template: TApprovedTemplateDetail | null) => {
  if (!template) return '';

  const storedContent = template.content || '';
  const parsedData = parseVariablesPayload(template.variables);

  if (!parsedData) {
    return storedContent.trim() || template.preview?.trim() || '';
  }

  try {
    const variablesArray = Array.isArray(parsedData.variables) ? parsedData.variables : [];
    const variablesObj = {} as Record<string, string>;

    variablesArray.forEach((item) => {
      variablesObj[item.key] = item.value;
    });

    Object.keys(variablesObj).forEach((varKey) => {
      if (!varKey.startsWith(`${DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE}.`)) {
        return;
      }

      const documentTemplateId = varKey.slice(`${DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE}.`.length);
      const documentTemplate = getDocumentTemplateById(documentTemplateId);
      if (documentTemplate?.render_mode === 'raw_html') {
        variablesObj[varKey] = generateDocumentHtml(documentTemplate, {});
      }
    });

    const savedStructures = parsedData.template_structures || {};
    const savedDocumentStructures = parsedData.document_template_structures || {};
    const savedDocumentValues = parsedData.document_template_values || {};

    const resolveDocumentTemplate = (
      varKey: string,
      entry?: { template?: DocumentTemplate } | null,
    ): DocumentTemplate | undefined => {
      const savedTemplate = entry?.template;
      const inferredId =
        (savedTemplate && typeof savedTemplate.id === 'string' ? savedTemplate.id : undefined) ||
        (varKey.startsWith(`${DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE}.`)
          ? varKey.slice(`${DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE}.`.length)
          : '');
      const definitionTemplate = inferredId ? getDocumentTemplateById(inferredId) : undefined;

      if (definitionTemplate?.refresh_from_definition_on_load) {
        return definitionTemplate;
      }

      if (savedTemplate && definitionTemplate) {
        return {
          ...savedTemplate,
          lock_structure: definitionTemplate.lock_structure,
          allow_section_management: definitionTemplate.allow_section_management,
          refresh_from_definition_on_load: definitionTemplate.refresh_from_definition_on_load,
        };
      }

      return savedTemplate || definitionTemplate;
    };

    Object.entries(savedStructures).forEach(([varKey, entry]) => {
      if (!variablesObj[varKey] && entry?.template) {
        variablesObj[varKey] = generateTableHtmlFromTableTemplate(entry.template, variablesObj);
      }
    });

    Object.entries(savedDocumentStructures).forEach(([varKey, entry]) => {
      const resolvedTemplate = resolveDocumentTemplate(varKey, entry);
      if (!variablesObj[varKey] && resolvedTemplate) {
        variablesObj[varKey] = generateDocumentHtml(resolvedTemplate, savedDocumentValues[varKey] || {});
      }
    });

    const contentHasPlaceholders = /\{\{[^}]+\}\}/.test(storedContent);
    let resolvedRawContent = contentHasPlaceholders
      ? normalizeVariableHtml(storedContent)
      : normalizeVariableHtml(parsedData.raw_content || storedContent);

    Object.keys(savedDocumentStructures).forEach((varKey) => {
      if (!variablesObj[varKey]) return;
      if (resolvedRawContent.includes(`{{${varKey}}}`)) return;

      resolvedRawContent = rebuildRawContentFromRenderedHtml(resolvedRawContent, `{{${varKey}}}`, {
        [varKey]: variablesObj[varKey],
      });
    });

    const renderedHtml = applyVariablesToHtmlWithHighlight(resolvedRawContent, variablesObj);
    return renderedHtml.trim() || template.preview?.trim() || storedContent;
  } catch {
    return template.preview?.trim() || storedContent;
  }
};

const MetadataItem: React.FC<IMetadataItemProps> = ({ label, value }) => {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-800">{value}</dd>
    </div>
  );
};

const TemplatePreviewPanel: React.FC<{ html: string; templateName: string }> = ({ html, templateName }) => {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
            <Eye className="size-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-[#002147]">Xem trước tài liệu từ mẫu</h2>
            <p className="truncate text-sm text-slate-500">{templateName}</p>
          </div>
        </div>
      </div>

      {html ? (
        <div
          className="preview-content"
          style={{ minHeight: 320, maxHeight: 560 }}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Preview renders approved template HTML stored by the editor.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
          Mẫu này chưa có nội dung để xem trước.
        </div>
      )}
    </div>
  );
};

export const NewDocumentSection: React.FC<INewDocumentSectionProps> = () => {
  const navigate = useNavigate();
  const profile = profileStore((state) => state.profile);
  const canCreateDocument = hasPermission(profile, 'document.create');

  const [templates, setTemplates] = useState<TApprovedTemplate[]>([]);
  const [templateTypeOptions, setTemplateTypeOptions] = useState<MetadataOption[]>([]);
  const [documentFilterConfig, setDocumentFilterConfig] = useState<FilterConfigByType>({});
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [documentMetadata, setDocumentMetadata] = useState<ITemplateMetadata>({});
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedTemplateDetail, setSelectedTemplateDetail] = useState<TApprovedTemplateDetail | null>(null);
  const [isLoadingTemplateDetail, setIsLoadingTemplateDetail] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [toast, setToast] = useState<ToastProps | null>(null);
  const initializedTemplateIdRef = useRef<string | null>(null);
  const documentTypeKeyRef = useRef<string>('');

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  );
  const selectedTemplateDepartment = useMemo(() => {
    if (!selectedTemplate) return '-';
    if (selectedTemplate.departmentNames?.length) {
      return selectedTemplate.departmentNames.join(', ');
    }
    return selectedTemplate.departmentName || '-';
  }, [selectedTemplate]);
  const templateTypeLabelMap = useMemo(
    () => new Map(templateTypeOptions.map((option) => [option.value, option.label])),
    [templateTypeOptions],
  );
  const selectedTemplateType =
    (selectedTemplate?.template_type ? templateTypeLabelMap.get(selectedTemplate.template_type) : undefined) ??
    selectedTemplate?.template_type ??
    '-';
  const selectedDocumentTypeKey = selectedTemplate?.template_type ?? typeFilter;
  const documentMetadataFields = useMemo(
    () => getFilterFieldsForType(documentFilterConfig, selectedDocumentTypeKey),
    [documentFilterConfig, selectedDocumentTypeKey],
  );
  const selectedTemplateAuthor = selectedTemplate?.createdByDisplay || selectedTemplate?.created_by || '-';
  const draftTitle = title.trim() || 'Tài liệu chưa đặt tên';
  const draftDescription = description.trim() || 'Chưa có mô tả.';
  const selectedTemplatePreviewHtml = useMemo(
    () => buildDocumentPreviewHtml(selectedTemplateDetail),
    [selectedTemplateDetail],
  );

  useEffect(() => {
    if (documentTypeKeyRef.current === selectedDocumentTypeKey) return;

    documentTypeKeyRef.current = selectedDocumentTypeKey;
    setDocumentMetadata({});
  }, [selectedDocumentTypeKey]);

  useEffect(() => {
    if (!canCreateDocument) return;
    let cancelled = false;

    const loadTemplates = async () => {
      try {
        setIsLoadingTemplates(true);
        const res = await listTemplatesAPI({
          status: 'APPROVED',
          page: 1,
          page_size: 100,
          sort: 'asc:name',
          template_type: typeFilter || undefined,
        });

        if (!cancelled) {
          setTemplates(res.data);
          setSelectedTemplateId((current) =>
            current && !res.data.some((template) => template.id === current) ? '' : current,
          );
        }
      } catch (error: any) {
        if (!cancelled) {
          setToast({
            message: `✕ Không thể tải danh sách mẫu: ${error.message}`,
            type: 'error',
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoadingTemplates(false);
        }
      }
    };

    void loadTemplates();

    return () => {
      cancelled = true;
    };
  }, [canCreateDocument, typeFilter]);

  useEffect(() => {
    if (!canCreateDocument || !selectedTemplateId) {
      setSelectedTemplateDetail(null);
      setIsLoadingTemplateDetail(false);
      return;
    }

    let cancelled = false;
    setSelectedTemplateDetail(null);
    setIsLoadingTemplateDetail(true);

    void getTemplateByIdAPI(selectedTemplateId)
      .then((template) => {
        if (!cancelled) {
          setSelectedTemplateDetail(template);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setToast({
            message: `✕ Không thể tải nội dung mẫu: ${error instanceof Error ? error.message : String(error)}`,
            type: 'error',
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingTemplateDetail(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canCreateDocument, selectedTemplateId]);

  useEffect(() => {
    if (!canCreateDocument) return;
    let cancelled = false;

    void getMetadataByKeyAPI<MetadataOption[]>('TEMPLATE_TYPE')
      .then((metadata) => {
        if (!cancelled) {
          setTemplateTypeOptions(metadata.meta_values ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTemplateTypeOptions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canCreateDocument]);

  useEffect(() => {
    if (!canCreateDocument) return;
    let cancelled = false;

    void getMetadataByKeyAPI<FilterConfigMetaValues>('FILTER_CONFIG')
      .then((record) => {
        if (!cancelled) {
          setDocumentFilterConfig(getDocumentFilterConfigByType(record.meta_values));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDocumentFilterConfig({});
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canCreateDocument]);

  useEffect(() => {
    const nextTemplateId = selectedTemplate?.id ?? null;
    if (initializedTemplateIdRef.current === nextTemplateId) return;

    initializedTemplateIdRef.current = nextTemplateId;
    setTitle(selectedTemplate?.name ?? '');
    setDescription(selectedTemplate?.description ?? '');
  }, [selectedTemplate]);

  const handleCreate = useCallback(async () => {
    if (!canCreateDocument) {
      setToast({
        message: '✕ Bạn không có quyền tạo tài liệu',
        type: 'error',
      });
      return;
    }

    if (!selectedTemplateId) {
      setToast({
        message: '✕ Vui lòng chọn mẫu tài liệu trước',
        type: 'error',
      });
      return;
    }

    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      setToast({
        message: '✕ Vui lòng nhập tiêu đề tài liệu',
        type: 'error',
      });
      return;
    }

    try {
      setIsCreating(true);
      const template =
        selectedTemplateDetail?.id === selectedTemplateId
          ? selectedTemplateDetail
          : await getTemplateByIdAPI(selectedTemplateId);
      const created = await createDocumentAPI({
        template_id: template.id,
        artifact_type: template.artifact_type,
        title: normalizedTitle,
        description: description.trim(),
        content: template.content,
        data: normalizeTemplateVariables(template.variables ?? null),
        artifact_state: template.artifact_config ?? null,
        document_metadata: Object.keys(documentMetadata).length > 0 ? documentMetadata : null,
      });

      navigate({ to: `/documents/${created.id}` });
    } catch (error: any) {
      setToast({
        message: `✕ Không thể tạo tài liệu: ${error.message}`,
        type: 'error',
      });
    } finally {
      setIsCreating(false);
    }
  }, [canCreateDocument, description, documentMetadata, navigate, selectedTemplateDetail, selectedTemplateId, title]);

  if (!canCreateDocument) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <nav className="mb-2 flex items-center gap-1 text-sm text-slate-500">
            <Link to="/documents" className="transition-colors hover:text-[#002147]">
              Tài liệu
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="font-medium text-slate-800">Tạo tài liệu</span>
          </nav>
          <div className="text-3xl font-bold text-[#002147]">Không có quyền tạo tài liệu</div>
          <p className="mt-1 text-sm text-gray-500">Tài khoản của bạn chỉ có quyền xem tài liệu.</p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          Vui lòng liên hệ người quản trị nếu bạn cần quyền tạo hoặc chỉnh sửa tài liệu.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <nav className="mb-2 flex items-center gap-1 text-sm text-slate-500">
          <Link to="/documents" className="transition-colors hover:text-[#002147]">
            Tài liệu
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="text-slate-800 font-medium">Tạo tài liệu</span>
        </nav>
        <div className="text-3xl font-bold text-[#002147]">Tạo tài liệu</div>
        <p className="mt-1 text-sm text-gray-500">
          Bắt đầu từ mẫu đã duyệt, kiểm tra siêu dữ liệu rồi tạo bản nháp để nhập nội dung.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-[#002147]">Chọn mẫu tài liệu</h2>
              <p className="mt-1 text-sm text-gray-500">
                Chỉ các mẫu đã duyệt mới có thể dùng để tạo bản nháp tài liệu.
              </p>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-gray-700" htmlFor="template-type-filter">
                  Loại mẫu
                </label>
                <Select
                  value={typeFilter || '__ALL__'}
                  onValueChange={(value) => {
                    const next = value === '__ALL__' ? '' : value;
                    setTypeFilter(next);
                    setSelectedTemplateId('');
                    setDocumentMetadata({});
                  }}>
                  <SelectTrigger id="template-type-filter">
                    <SelectValue placeholder="Tất cả loại mẫu" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__ALL__">Tất cả loại mẫu</SelectItem>
                    {templateTypeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-semibold text-gray-700" htmlFor="template-selector">
                  Mẫu tài liệu
                </label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId} disabled={isLoadingTemplates}>
                  <SelectTrigger id="template-selector">
                    <SelectValue placeholder={isLoadingTemplates ? 'Đang tải mẫu...' : 'Chọn mẫu đã duyệt'} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTemplate ? (
                <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-blue-950">{selectedTemplate.name}</p>
                      <p className="mt-1 text-sm text-blue-900/80">{selectedTemplate.description || 'Chưa có mô tả'}</p>
                    </div>
                    <ApprovalStatusBadge status="Approved" />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-blue-800">
                    <span className="rounded-full border border-blue-200 bg-white px-2.5 py-1">
                      Loại: {selectedTemplateType}
                    </span>
                    <span className="rounded-full border border-blue-200 bg-white px-2.5 py-1">
                      Phiên bản: v{selectedTemplate.version}
                    </span>
                    <span className="rounded-full border border-blue-200 bg-white px-2.5 py-1">
                      Đơn vị: {selectedTemplateDepartment}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                  Chọn một mẫu để xem trước siêu dữ liệu trước khi tạo bản nháp tài liệu.
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => void handleCreate()}
                  disabled={isCreating || !selectedTemplateId || !canCreateDocument}>
                  {isCreating ? <Loader2 className="size-4 animate-spin" /> : <FilePlus2 className="size-4" />}
                  {isCreating ? 'Đang tạo…' : 'Tạo bản nháp'}
                </Button>
              </div>
            </div>
          </div>

          {selectedTemplate && selectedTemplateDetail ? (
            <TemplatePreviewPanel html={selectedTemplatePreviewHtml} templateName={selectedTemplate.name} />
          ) : selectedTemplate && isLoadingTemplateDetail ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
              Đang tải nội dung xem trước...
            </div>
          ) : null}

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#002147]">Trước khi tạo</h2>
            <div className="mt-4 grid gap-3 text-sm text-gray-600">
              <p>Nội dung và biến của mẫu đã chọn sẽ được sao chép vào tài liệu nháp mới.</p>
              <p>Bạn có thể tiếp tục chỉnh sửa bản nháp sau khi tạo, rồi gửi quản trị viên duyệt khi sẵn sàng.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="mb-4 text-sm font-semibold text-gray-700">Thông tin tài liệu</p>

            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500" htmlFor="document-title">
                  Tiêu đề
                </label>
                <Input
                  id="document-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nhập tiêu đề tài liệu"
                />
              </div>

              <div className="grid gap-1.5">
                <label
                  className="text-xs font-semibold uppercase tracking-wide text-gray-500"
                  htmlFor="document-description">
                  Mô tả
                </label>
                <Textarea
                  id="document-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Nhập mô tả tài liệu"
                  className="min-h-28"
                />
              </div>

              {documentMetadataFields.length > 0 && (
                <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Metadata tài liệu</p>
                    {Object.keys(documentMetadata).length > 0 && (
                      <button
                        type="button"
                        className="text-xs font-medium text-blue-600 hover:underline"
                        onClick={() => setDocumentMetadata({})}>
                        Xóa chọn
                      </button>
                    )}
                  </div>

                  <div className="grid gap-3">
                    {documentMetadataFields.map((field) => {
                      const currentEntry = documentMetadata[field.key];
                      const currentVal = currentEntry?.value ?? '';
                      const writeEntry = (val: string, label: string) => {
                        setDocumentMetadata((prev) => {
                          const next = { ...prev };
                          if (val) next[field.key] = { value: val, label: label || val };
                          else delete next[field.key];
                          return next;
                        });
                      };
                      const clearEntry = () => {
                        setDocumentMetadata((prev) => {
                          const next = { ...prev };
                          delete next[field.key];
                          return next;
                        });
                      };

                      return (
                        <div key={field.key} className="grid gap-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            {field.label}
                          </span>
                          {field.source_type === 'api_table' ? (
                            <SearchableSelect
                              value={currentVal || undefined}
                              clearable
                              fetchOnOpen
                              minSearchLength={0}
                              placeholder={`Chọn ${field.label.toLowerCase()}...`}
                              searchPlaceholder={`Tìm ${field.label.toLowerCase()}...`}
                              emptyMessage="Không tìm thấy kết quả."
                              className="h-9 text-sm"
                              apiFunction={async (params) => {
                                const results = await getTemplateTableOptionsAPI({
                                  table: field.table,
                                  field_name: field.field_name,
                                  label_field: field.label_field,
                                  sort_order: 'asc',
                                  search: typeof params.search === 'string' ? params.search : undefined,
                                  page: typeof params.page === 'number' ? params.page : 1,
                                  page_size: 50,
                                });
                                return appendRecordCodeToFilterLabels(applyLabelExpr(results, field.label_expr));
                              }}
                              onValueChange={(value) => {
                                if (!value) clearEntry();
                              }}
                              onOptionSelect={(option) => {
                                if (!option) clearEntry();
                                else writeEntry(option.value, option.label);
                              }}
                            />
                          ) : field.source_type === 'static' ? (
                            <Select
                              value={currentVal || '__NONE__'}
                              onValueChange={(value) => {
                                if (value === '__NONE__') clearEntry();
                                else {
                                  const option = field.options.find((item) => item.value === value);
                                  writeEntry(value, option?.label ?? value);
                                }
                              }}>
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder={`Chọn ${field.label.toLowerCase()}...`} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__NONE__">-- Không chọn --</SelectItem>
                                {field.options.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : field.source_type === 'input_number' ? (
                            <Input
                              type="number"
                              min={field.min}
                              max={field.max}
                              step={field.step}
                              className="h-9 text-sm"
                              value={currentVal}
                              placeholder={field.placeholder ?? field.label}
                              onChange={(event) => writeEntry(event.target.value, event.target.value)}
                            />
                          ) : (
                            <Input
                              type="text"
                              className="h-9 text-sm"
                              value={currentVal}
                              placeholder={field.placeholder ?? field.label}
                              onChange={(event) => writeEntry(event.target.value, event.target.value)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Xem trước bản nháp</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{draftTitle}</p>
                <p className="mt-1 text-sm text-slate-600">{draftDescription}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="mb-4 text-sm font-semibold text-gray-700">Thông tin mẫu</p>

            {selectedTemplate ? (
              <dl className="grid gap-4">
                <MetadataItem label="Mẫu tài liệu" value={selectedTemplate.name} />
                <MetadataItem label="Loại mẫu" value={selectedTemplateType} />
                <MetadataItem label="Đơn vị" value={selectedTemplateDepartment} />
                <MetadataItem label="Phiên bản" value={`v${selectedTemplate.version}`} />
                <MetadataItem label="Người tạo" value={selectedTemplateAuthor} />
                <MetadataItem
                  label="Cập nhật lúc"
                  value={selectedTemplate.updated_at ? formatDate(selectedTemplate.updated_at) : '-'}
                />
              </dl>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                Siêu dữ liệu của mẫu sẽ hiển thị ở đây sau khi bạn chọn một mẫu trong danh sách.
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};
