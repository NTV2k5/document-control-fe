'use client';

import type { ClassicEditor } from 'ckeditor5';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  Button,
  Checkbox,
  Input,
  SearchableSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from 'reactjs-platform/ui';
import { TableTemplateSelector } from '../../table-template/table-template-selector';
import { DocumentTemplateSelector } from '../../template';
import type { ToastProps } from '../../ui';
import {
  DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE,
  TABLE_TEMPLATE_VARIABLE_NAMESPACE,
  buildTextSignature,
  buildTokenSet,
  createPreviewEditorConfig,
  exportToPdf,
  exportToWord,
  generateDocumentHtml,
  generateTableHtmlFromTableTemplate,
  loadEditorRuntime,
  FRAPPE_VARIABLE_INPUT_TYPES,
  isCheckVariableInputType,
  isLongTextVariableInputType,
  isSelectVariableInputType,
  isTableMatrixVariableInputType,
  normalizeVariableInputType,
  parseVariableName,
  registerMentionRichTextEditor,
  type DocumentTemplate,
  type TableTemplate,
  type VariableInputType,
  type VarTypes,
} from '../../../lib';
import { VariableFieldDropdown } from '../variable-field-dropdown';

type VariablesDrawerV1EditorRuntime = Awaited<ReturnType<typeof loadEditorRuntime>>;

const VARIABLE_INPUT_TYPE_LABELS: Partial<Record<VariableInputType, string>> = {
  TextInput: 'Văn bản',
  NumberInput: 'Số',
  DropdownList: 'Danh sách chọn',
  Checkbox: 'Ô chọn',
  Textarea: 'Văn bản nhiều dòng',
  ImageUrl: 'Hình ảnh',
  'Table matrix': 'Ma trận bảng',
  'Table template': 'Mẫu bảng',
  'Document template': 'Mẫu nội dung',
};

const VARIABLE_INPUT_TYPE_OPTIONS: VariableInputType[] = [
  ...FRAPPE_VARIABLE_INPUT_TYPES,
  'Table matrix',
  'Table template',
  'Document template',
];

const getVariableInputTypeLabel = (inputType: VariableInputType) => VARIABLE_INPUT_TYPE_LABELS[inputType] ?? inputType;

export interface IVariablesDrawerV1Props {
  open: boolean;
  onClose?: () => void;
  varsInDoc: string[];
  varValues: Record<string, string>;
  onVarValuesChange: (updates: Record<string, string>) => void;
  varTypes: VarTypes;
  onVarTypesChange: (updates: VarTypes) => void;
  onShowToast: (toast: ToastProps) => void;
  renderedHtml: string;
  renderedHtmlHighlighted: string;
  exportLoading: string | null;
  onSaveVariables: (overrideVarValues: Record<string, string>) => Promise<void>;
  onRemoveVariable?: (varKey: string) => void;
  selectedTemplates: Record<string, TableTemplate>;
  onSelectedTemplatesChange: (updates: Record<string, TableTemplate | null>) => void;
  // Document template support
  selectedDocumentTemplates: Record<string, DocumentTemplate>;
  documentTemplateValues: Record<string, Record<string, string>>;
  onSelectedDocumentTemplatesChange: (updates: Record<string, DocumentTemplate | null>) => void;
  onDocumentTemplateValuesChange: (varKey: string, values: Record<string, string>) => void;
  readOnly?: boolean;
}

export const VariablesDrawerV1 = ({
  open,
  onClose,
  varsInDoc,
  varValues,
  onVarValuesChange,
  varTypes,
  onVarTypesChange,
  onShowToast,
  renderedHtml,
  renderedHtmlHighlighted,
  exportLoading,
  onSaveVariables,
  onRemoveVariable,
  selectedTemplates,
  onSelectedTemplatesChange,
  selectedDocumentTemplates,
  documentTemplateValues,
  onSelectedDocumentTemplatesChange,
  onDocumentTemplateValuesChange,
  readOnly = false,
}: IVariablesDrawerV1Props) => {
  const [isSaving, setIsSaving] = useState(false);
  const [previewContent, setPreviewContent] = useState(renderedHtml);
  const [showTemplateSelector, setShowTemplateSelector] = useState<string | null>(null);
  const [showDocumentTemplateSelector, setShowDocumentTemplateSelector] = useState<string | null>(null);
  const [editorRuntime, setEditorRuntime] = useState<VariablesDrawerV1EditorRuntime | null>(null);
  const [previewEditorConfig, setPreviewEditorConfig] = useState<Awaited<
    ReturnType<typeof createPreviewEditorConfig>
  > | null>(null);
  const editorRef = useRef<{ editor: ClassicEditor } | null>(null);
  const mentionEditorCleanupRef = useRef<(() => void) | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const varsLengthRef = useRef(varsInDoc.length);

  // Refs for mutable state used in stable callbacks
  const varValuesRef = useRef(varValues);
  varValuesRef.current = varValues;
  const varTypesRef = useRef(varTypes);
  varTypesRef.current = varTypes;
  const previewContentRef = useRef(previewContent);
  previewContentRef.current = previewContent;

  useEffect(() => {
    return () => {
      mentionEditorCleanupRef.current?.();
      mentionEditorCleanupRef.current = null;
    };
  }, []);

  // Memoize parsed variable names to avoid regex parsing on every render
  const parsedVariables = useMemo(() => new Map(varsInDoc.map((k) => [k, parseVariableName(k)])), [varsInDoc]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    void loadEditorRuntime()
      .then((runtime) => {
        if (!cancelled) {
          setEditorRuntime(runtime);
        }
      })
      .catch((error) => {
        console.error('Failed to load CKEditor preview runtime', error);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setPreviewEditorConfig(null);

    void createPreviewEditorConfig()
      .then((config) => {
        if (!cancelled) {
          setPreviewEditorConfig(config);
        }
      })
      .catch((error) => {
        console.error('Failed to create CKEditor preview config', error);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const CKEditorComponent = editorRuntime?.CKEditor;
  const ClassicEditorConstructor = editorRuntime?.ClassicEditor;

  useEffect(() => {
    if (varsInDoc.length !== varsLengthRef.current) {
      setPreviewKey((k) => k + 1);
      varsLengthRef.current = varsInDoc.length;
    }
  }, [varsInDoc.length]);

  useEffect(() => {
    if (open && varsInDoc.length > 0) {
      const typeUpdates = {} as VarTypes;
      let hasUpdates = false;
      varsInDoc.forEach((varKey) => {
        if (!varTypes[varKey]) {
          typeUpdates[varKey] = varKey.startsWith(`${TABLE_TEMPLATE_VARIABLE_NAMESPACE}.`)
            ? 'Table template'
            : varKey.startsWith(`${DOCUMENT_TEMPLATE_VARIABLE_NAMESPACE}.`)
              ? 'Document template'
              : 'Select';
          hasUpdates = true;
        }
      });
      if (hasUpdates) onVarTypesChange(typeUpdates);
    }
  }, [open, varsInDoc, varTypes, onVarTypesChange]);

  useEffect(() => {
    setPreviewContent(renderedHtmlHighlighted || renderedHtml);
  }, [renderedHtmlHighlighted, renderedHtml]);

  useEffect(() => {
    const templateVarKeys = Object.keys(selectedTemplates);
    if (templateVarKeys.length === 0) return;

    const htmlUpdates = {} as Record<string, string>;
    let hasChanges = false;

    templateVarKeys.forEach((varKey) => {
      const template = selectedTemplates[varKey];
      const newTableHtml = generateTableHtmlFromTableTemplate(template, varValues);

      if (varValues[varKey] !== newTableHtml) {
        htmlUpdates[varKey] = newTableHtml;
        hasChanges = true;
      }
    });

    if (hasChanges) {
      onVarValuesChange(htmlUpdates);
    }
  }, [selectedTemplates, varValues, onVarValuesChange]);

  // Re-generate document template HTML when values change
  useEffect(() => {
    const docVarKeys = Object.keys(selectedDocumentTemplates);
    if (docVarKeys.length === 0) return;

    const htmlUpdates = {} as Record<string, string>;
    let hasChanges = false;

    docVarKeys.forEach((varKey) => {
      const template = selectedDocumentTemplates[varKey];
      const vals = documentTemplateValues[varKey] ?? {};
      const newHtml = generateDocumentHtml(template, vals);

      if (varValues[varKey] !== newHtml) {
        htmlUpdates[varKey] = newHtml;
        hasChanges = true;
      }
    });

    if (hasChanges) {
      onVarValuesChange(htmlUpdates);
    }
  }, [selectedDocumentTemplates, documentTemplateValues, varValues, onVarValuesChange]);

  const syncTableMatrixEdits = useCallback(() => {
    const currentVarValues = varValuesRef.current;
    const currentVarTypes = varTypesRef.current;
    const updatedVarValues = { ...currentVarValues };
    const tableVars = (Object.keys(currentVarTypes) as string[]).filter((k) =>
      isTableMatrixVariableInputType(currentVarTypes[k]),
    );

    if (tableVars.length === 0) return updatedVarValues;

    let currentContent = previewContentRef.current;
    if (editorRef.current?.editor) {
      currentContent = editorRef.current.editor.getData();
    }

    const tableRegex = /<table[^>]*>[\s\S]*?<\/table>/gi;
    const tables = currentContent.match(tableRegex) || [];

    if (tables.length === 0) return updatedVarValues;

    // Use content-similarity matching instead of index-based matching
    // to handle documents with non-variable tables correctly.
    const usedTableIndices = new Set<number>();

    tableVars.forEach((varKey) => {
      const currentValue = currentVarValues[varKey];
      if (!currentValue) return;

      const expectedSig = buildTextSignature(currentValue);
      if (!expectedSig) return;

      const expectedTokens = buildTokenSet(expectedSig);
      if (expectedTokens.size === 0) return;

      let bestIndex = -1;
      let bestScore = -1;

      tables.forEach((table, idx) => {
        if (usedTableIndices.has(idx)) return;

        const candidateSig = buildTextSignature(table);
        if (!candidateSig) return;

        const candidateTokens = buildTokenSet(candidateSig);
        if (candidateTokens.size === 0) return;

        let intersection = 0;
        expectedTokens.forEach((token) => {
          if (candidateTokens.has(token)) intersection++;
        });

        const score = intersection / expectedTokens.size;
        if (score > bestScore) {
          bestScore = score;
          bestIndex = idx;
        }
      });

      if (bestIndex !== -1 && bestScore >= 0.3) {
        usedTableIndices.add(bestIndex);
        if (currentVarValues[varKey] !== tables[bestIndex]) {
          updatedVarValues[varKey] = tables[bestIndex];
        }
      }
    });

    return updatedVarValues;
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const syncedVarValues = syncTableMatrixEdits();
      await onSaveVariables(syncedVarValues);
      onShowToast({
        message: 'Lưu biến thành công',
        type: 'success',
      });
    } catch (error) {
      console.error(`❌ Lỗi lưu:`, error);
    } finally {
      setIsSaving(false);
    }
  }, [syncTableMatrixEdits, onSaveVariables, onShowToast]);

  const onClearAllVariables = useCallback(() => {
    const currentVarValues = varValuesRef.current;
    onVarValuesChange(Object.fromEntries(Object.keys(currentVarValues).map((k) => [k, ''])));
    onSelectedTemplatesChange(Object.fromEntries(Object.keys(selectedTemplates).map((k) => [k, null])));
    onSelectedDocumentTemplatesChange(Object.fromEntries(Object.keys(selectedDocumentTemplates).map((k) => [k, null])));
  }, [
    onVarValuesChange,
    onSelectedTemplatesChange,
    onSelectedDocumentTemplatesChange,
    selectedTemplates,
    selectedDocumentTemplates,
  ]);

  const handleVarTypeChange = useCallback(
    (varKey: string, newType: VariableInputType) => {
      const currentVarTypes = varTypesRef.current;
      onVarTypesChange({ [varKey]: newType });

      if (
        (currentVarTypes[varKey] === 'Table matrix' || currentVarTypes[varKey] === 'Table template') &&
        newType !== 'Table matrix' &&
        newType !== 'Table template'
      ) {
        onVarValuesChange({ [varKey]: '' });
      }

      if (currentVarTypes[varKey] === 'Document template' && newType !== 'Document template') {
        onVarValuesChange({ [varKey]: '' });
        onSelectedDocumentTemplatesChange({ [varKey]: null });
      }
    },
    [onVarTypesChange, onVarValuesChange, onSelectedDocumentTemplatesChange],
  );

  const handleSelectTemplate = useCallback(
    (varKey: string, template: TableTemplate) => {
      onSelectedTemplatesChange({ [varKey]: template });
      setShowTemplateSelector(null);

      const tableHtml = generateTableHtmlFromTableTemplate(template, varValuesRef.current);
      onVarValuesChange({ [varKey]: tableHtml });
    },
    [onSelectedTemplatesChange, onVarValuesChange],
  );

  const handleSelectDocumentTemplate = useCallback(
    (varKey: string, template: DocumentTemplate) => {
      onSelectedDocumentTemplatesChange({ [varKey]: template });
      setShowDocumentTemplateSelector(null);

      const html = generateDocumentHtml(template, documentTemplateValues[varKey] ?? {});
      onVarValuesChange({ [varKey]: html });
    },
    [onSelectedDocumentTemplatesChange, onVarValuesChange, documentTemplateValues],
  );

  // Stable callbacks for VariableFieldDropdown to avoid re-creating closures per render
  const handleFieldTemplateChange = useCallback(
    (key: string, template: TableTemplate | null) => {
      if (!template) {
        onSelectedTemplatesChange({ [key]: null });
        onVarValuesChange({ [key]: '' });
      } else {
        onSelectedTemplatesChange({ [key]: template });
      }
    },
    [onSelectedTemplatesChange, onVarValuesChange],
  );

  const handleFieldDocTemplateChange = useCallback(
    (key: string, tpl: DocumentTemplate | null) => {
      if (!tpl) {
        onSelectedDocumentTemplatesChange({ [key]: null });
        onVarValuesChange({ [key]: '' });
      } else {
        onSelectedDocumentTemplatesChange({ [key]: tpl });
      }
    },
    [onSelectedDocumentTemplatesChange, onVarValuesChange],
  );

  const handleExportPdf = useCallback(async () => {
    try {
      await exportToPdf(previewContentRef.current, 'preview.pdf');
      onShowToast({
        message: 'Xuất PDF thành công!',
        type: 'success',
      });
    } catch (error: any) {
      console.error('Xuất PDF thất bại:', error);
      onShowToast({
        message: `✕ Xuất PDF thất bại: ${error.message}`,
        type: 'error',
      });
    }
  }, [onShowToast]);

  const handleExportWord = useCallback(() => {
    exportToWord(previewContentRef.current, 'preview.docx');
  }, []);

  return (
    <>
      {open && (
        <div className="modal-overlay" onClick={onClose}>
          <div className="drawer drawer-with-preview" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h2>⚙️ Biến ({varsInDoc.length})</h2>
              {readOnly && (
                <span style={{ fontSize: '0.75em', color: '#ef4444', fontWeight: 500, marginLeft: 8 }}>🔒 Chỉ xem</span>
              )}
              <Button variant="ghost" size="icon" onClick={onClose} title="Đóng bảng biến (Esc)">
                <X className="size-4" />
              </Button>
            </div>

            <div className="drawer-content-wrapper">
              <div className="drawer-variables-section">
                <div className="drawer-content">
                  {varsInDoc.length === 0 ? (
                    <div className="variables-drawer-empty">
                      <p>Chưa tìm thấy biến nào.</p>
                    </div>
                  ) : (
                    <div className="variables-drawer-list">
                      {varsInDoc.map((k) => {
                        const parsed = parsedVariables.get(k);
                        if (parsed) {
                          return (
                            <div
                              key={k}
                              style={{
                                position: 'relative',
                              }}>
                              <VariableFieldDropdown
                                varKey={k}
                                table={parsed.table}
                                field={parsed.field}
                                varValues={varValues}
                                onVarValuesChange={onVarValuesChange}
                                varsInDoc={varsInDoc}
                                varType={varTypes[k]}
                                onVarTypeChange={handleVarTypeChange}
                                selectedTemplate={selectedTemplates[k]}
                                onSelectedTemplateChange={handleFieldTemplateChange}
                                onShowTemplateSelector={setShowTemplateSelector}
                                selectedDocumentTemplate={selectedDocumentTemplates[k]}
                                documentTemplateValues={documentTemplateValues[k]}
                                onDocumentTemplateChange={handleFieldDocTemplateChange}
                                onDocumentTemplateValuesChange={onDocumentTemplateValuesChange}
                                onShowDocumentTemplateSelector={setShowDocumentTemplateSelector}
                                readOnly={readOnly}
                              />
                              {onRemoveVariable && !readOnly && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => onRemoveVariable(k)}
                                  title="Xóa biến"
                                  className="absolute right-1 top-1 h-6 w-6 text-gray-400 hover:text-red-400">
                                  <X className="size-3" />
                                </Button>
                              )}
                            </div>
                          );
                        }

                        const varType = normalizeVariableInputType(varTypes[k] || 'Data');
                        const current = varValues[k] ?? '';
                        const options: string[] = [];

                        return (
                          <div
                            key={k}
                            className="variable-item"
                            style={{
                              position: 'relative',
                              opacity: readOnly ? 0.7 : 1,
                            }}>
                            <div
                              style={{
                                display: 'flex',
                                gap: 8,
                                alignItems: 'center',
                                marginBottom: 8,
                              }}>
                              <label
                                className="variable-label"
                                style={{
                                  flex: 1,
                                }}>
                                <code>{`{{${k}}}`}</code>
                              </label>
                              {onRemoveVariable && !readOnly && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => onRemoveVariable(k)}
                                  title="Xóa biến"
                                  className="h-6 w-6 text-gray-400 hover:text-red-400">
                                  <X className="size-3" />
                                </Button>
                              )}
                              <Select
                                value={varType}
                                disabled={readOnly}
                                onValueChange={(v) => handleVarTypeChange(k, v as VariableInputType)}>
                                <SelectTrigger className="w-36 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {VARIABLE_INPUT_TYPE_OPTIONS.map((type) => (
                                    <SelectItem key={type} value={type}>
                                      {getVariableInputTypeLabel(type)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {isSelectVariableInputType(varType) ? (
                              <SearchableSelect
                                inlineSearchTrigger
                                value={current || undefined}
                                disabled={readOnly}
                                onValueChange={(v) => onVarValuesChange({ [k]: v })}
                                options={options.map((opt) => ({
                                  value: opt,
                                  label: opt,
                                }))}
                                placeholder="Tìm và chọn giá trị..."
                                searchPlaceholder="Tìm giá trị..."
                                emptyMessage="Không tìm thấy giá trị phù hợp."
                                clearable
                              />
                            ) : isCheckVariableInputType(varType) ? (
                              <Checkbox
                                disabled={readOnly}
                                checked={current === 'true' || current === '1'}
                                onCheckedChange={(checked) =>
                                  onVarValuesChange({ [k]: checked === true ? 'true' : 'false' })
                                }
                              />
                            ) : isLongTextVariableInputType(varType) ? (
                              <Textarea
                                value={current}
                                readOnly={readOnly}
                                onChange={(e) => onVarValuesChange({ [k]: e.target.value })}
                                placeholder="Nhập văn bản nhiều dòng..."
                                rows={4}
                                className="w-full"
                              />
                            ) : (
                              <Input
                                type="text"
                                value={current}
                                readOnly={readOnly}
                                onChange={(e) => onVarValuesChange({ [k]: e.target.value })}
                                placeholder="Nhập giá trị..."
                                className="w-full"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {varsInDoc.length > 0 && (
                  <div className="drawer-footer">
                    <Button
                      onClick={handleSave}
                      disabled={isSaving || readOnly}
                      className="w-1/2 bg-emerald-600 hover:bg-emerald-700 text-white">
                      {isSaving ? <span className="loading-spinner" /> : <>💾 Lưu</>}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={onClearAllVariables}
                      disabled={isSaving || readOnly}
                      className="flex-1">
                      🗑️ Xóa tất cả
                    </Button>
                  </div>
                )}
              </div>

              <div className="drawer-preview-section">
                <div className="drawer-preview-header">
                  <span>👁️ Xem trước trực tiếp</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button variant="outline" onClick={handleExportPdf} disabled={exportLoading === 'pdf'}>
                      {exportLoading === 'pdf' ? <span className="loading-spinner" /> : <>📥 PDF</>}
                    </Button>
                    <Button variant="outline" onClick={handleExportWord} disabled={exportLoading === 'word'}>
                      {exportLoading === 'word' ? <span className="loading-spinner" /> : <>📄 Word</>}
                    </Button>
                  </div>
                </div>
                <div className="drawer-preview-content" style={{ padding: 0, overflow: 'auto' }}>
                  {!CKEditorComponent || !ClassicEditorConstructor || !previewEditorConfig ? (
                    <div className="flex min-h-[320px] items-center justify-center text-sm text-gray-500">
                      Đang tải trình xem trước...
                    </div>
                  ) : (
                    <CKEditorComponent
                      key={previewKey}
                      editor={ClassicEditorConstructor}
                      data={previewContent}
                      disabled={readOnly}
                      config={previewEditorConfig}
                      onReady={(editor) => {
                        editorRef.current = { editor };
                        mentionEditorCleanupRef.current?.();
                        mentionEditorCleanupRef.current = registerMentionRichTextEditor(editor);
                      }}
                      onChange={(_event, editor) => setPreviewContent(editor.getData())}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTemplateSelector && (
        <TableTemplateSelector
          onSelectTemplate={(template) => handleSelectTemplate(showTemplateSelector, template)}
          onClose={() => setShowTemplateSelector(null)}
        />
      )}

      {showDocumentTemplateSelector && (
        <DocumentTemplateSelector
          onSelectTemplate={(template) => handleSelectDocumentTemplate(showDocumentTemplateSelector, template)}
          onClose={() => setShowDocumentTemplateSelector(null)}
        />
      )}
    </>
  );
};
