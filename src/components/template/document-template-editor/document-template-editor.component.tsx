'use client';

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  getTemplateDocumentDataAPI,
  getTemplateTableOptionsAPI,
  getTemplateTableRecordsAPI,
  type TTemplateDataRecord,
} from 'api';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import { SearchableMultiSelect, SearchableSelect } from 'reactjs-platform/ui';
import {
  formatDocumentMultiReferenceListItem,
  generateDocumentHtml,
  logVariablePerformance,
  measureVariablePerformance,
  getDocumentFetchFields,
  getDocumentCheckboxOptionValue,
  getDocumentCheckboxSelectedValues,
  getDocumentFieldValueKey,
  isDocumentCheckboxOptionChecked,
  parseDocumentMultiReferenceListValue,
  resolveDocumentFieldValue,
  serializeDocumentCheckboxValue,
  serializeDocumentMultiReferenceListValue,
  type DocumentTemplate,
  type DocumentField,
  type DocumentTextField,
  type DocumentListField,
  type DocumentMultiReferenceListField,
  type DocumentMultiReferenceListValueItem,
  type DocumentSection,
  normalizeEditorTextStyle,
  shouldLogVariablePerformanceCycle,
  type TEditorTextStyle,
} from '../../../lib';
import { useTranslation } from '../../../i18n';
import '../../../styles/DocumentTemplateEditor.css';

const DOCUMENT_LABEL_ICONS = ['❖', '◆', '◇', '●', '○', '■', '□', '✓', '✦', '★', '▸', '▪', '▫', '➤', '※', '§'];
const DOCUMENT_TEMPLATE_UNDO_LIMIT = 50;
const STYLE_FONT_OPTIONS = [
  { value: 'Times New Roman, Times, serif', label: 'Times New Roman' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { value: 'Calibri, Arial, sans-serif', label: 'Calibri' },
  { value: 'Cambria, Georgia, serif', label: 'Cambria' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Tahoma, Geneva, sans-serif', label: 'Tahoma' },
  { value: 'Verdana, Geneva, sans-serif', label: 'Verdana' },
  { value: 'Courier New, Courier, monospace', label: 'Courier New' },
] as const;
const STYLE_FONT_SIZE_OPTIONS = ['8pt', '9pt', '10pt', '11pt', '12pt', '13pt', '14pt', '16pt', '18pt', '20pt', '24pt'];
const STYLE_LINE_HEIGHT_OPTIONS = ['1', '1.15', '1.25', '1.5', '2'];
const STYLE_TEXT_ALIGN_OPTIONS = ['left', 'center', 'right', 'justify'] as const;

const getLabelIcon = (value: string) => {
  const trimmed = value.trimStart();
  return DOCUMENT_LABEL_ICONS.find((icon) => trimmed.startsWith(icon)) ?? '';
};

const stripLabelIcon = (value: string) => {
  const trimmed = value.trimStart();
  const icon = getLabelIcon(trimmed);
  return icon ? trimmed.slice(icon.length).trimStart() : value.trim();
};

const applyLabelIcon = (value: string, icon: string, fallback: string) => {
  const text = stripLabelIcon(value) || fallback;
  return icon ? `${icon} ${text}` : text;
};

const pruneStyle = (style: TEditorTextStyle): TEditorTextStyle | undefined => {
  const nextStyle = Object.fromEntries(
    Object.entries(style).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ) as TEditorTextStyle;
  return Object.keys(nextStyle).length > 0 ? nextStyle : undefined;
};

const patchStyle = (style: TEditorTextStyle | undefined, patch: TEditorTextStyle): TEditorTextStyle | undefined =>
  pruneStyle({ ...(style ?? {}), ...patch });

const getEditorReactStyle = (style?: TEditorTextStyle | null): CSSProperties | undefined => {
  if (!style || Object.keys(style).length === 0) return undefined;

  const normalizedStyle = normalizeEditorTextStyle(style);
  return {
    fontFamily: normalizedStyle.font_family,
    fontSize: normalizedStyle.font_size,
    lineHeight: normalizedStyle.line_height,
    color: normalizedStyle.color,
    fontWeight: typeof style.bold === 'boolean' ? (style.bold ? 700 : 400) : undefined,
    fontStyle: typeof style.italic === 'boolean' ? (style.italic ? 'italic' : 'normal') : undefined,
    textDecoration: typeof style.underline === 'boolean' ? (style.underline ? 'underline' : 'none') : undefined,
    textAlign: normalizedStyle.text_align,
    backgroundColor: normalizedStyle.background_color,
  };
};

const getReferenceLookupValueField = (field: Extract<DocumentField, { type: 'reference' }>) =>
  field.lookup_value_field?.trim() || field.reference_field;

const getReferenceLookupLabelField = (field: Extract<DocumentField, { type: 'reference' }>) =>
  field.lookup_label_field?.trim() || undefined;

const getMultiReferenceLookupValueField = (field: DocumentMultiReferenceListField) =>
  field.lookup_value_field?.trim() || field.reference_field?.trim() || 'id';

const getMultiReferenceLookupLabelField = (field: DocumentMultiReferenceListField) =>
  field.lookup_label_field?.trim() || field.reference_field?.trim() || 'name';

const toOptionText = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value
      .map((item) => toOptionText(item))
      .filter(Boolean)
      .join(', ');
  }

  if (value === null || value === undefined || typeof value === 'object') return '';
  return String(value).trim();
};

const getRecordFieldText = (record: TTemplateDataRecord, fieldName: string): string =>
  toOptionText(record[fieldName] ?? (fieldName === 'id' ? record._id : undefined));

const shouldUseMultilineDocumentValueEditor = (value: string) => value.length > 80 || value.includes('\n');
const shouldUseMultilineTextField = (field: DocumentTextField, value: string) =>
  field.multiline === true || shouldUseMultilineDocumentValueEditor(value);
const getDocumentFieldLabelSuffix = (field: Pick<DocumentField, 'label_suffix'>, fallback = ':') =>
  field.label_suffix ?? fallback;

type TDocumentDragSensors = ReturnType<typeof useSensors>;

interface ISortableDocumentNodeProps {
  id: string;
  disabled?: boolean;
  dragTitle: string;
  tag?: 'div' | 'li' | 'span';
  className?: string;
  children: (dragHandle: ReactNode) => ReactNode;
}

const getDocumentSectionSortableId = (section: DocumentSection) => `doc-section-${section.id}`;
const getDocumentFieldSortableId = (field: DocumentField) => `doc-field-${field.id}`;
const getDocumentListItemSortableId = (field: DocumentListField, itemIdx: number) => `doc-list-${field.id}-${itemIdx}`;
const getDocumentCheckboxOptionSortableId = (fieldId: string, optionValue: string, optionIdx: number) =>
  `doc-checkbox-option-${fieldId}-${optionValue || optionIdx}`;
const getDocumentSubItemSortableId = (field: DocumentListField, itemIdx: number, subIdx: number) =>
  `doc-sub-list-${field.id}-${itemIdx}-${subIdx}`;

const getSortableIndexes = (ids: string[], event: DragEndEvent) => {
  const { active, over } = event;
  if (!over || active.id === over.id) return null;

  const oldIndex = ids.findIndex((id) => id === active.id);
  const newIndex = ids.findIndex((id) => id === over.id);
  if (oldIndex < 0 || newIndex < 0) return null;

  return { oldIndex, newIndex };
};

const SortableDocumentNode = ({
  id,
  disabled = false,
  dragTitle,
  tag = 'div',
  className,
  children,
}: ISortableDocumentNodeProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const dragHandle = disabled ? null : (
    <button
      type="button"
      className="doc-drag-handle"
      aria-label={dragTitle}
      title={dragTitle}
      onClick={(event) => event.stopPropagation()}
      {...attributes}
      {...listeners}>
      <GripVertical className="doc-drag-icon" aria-hidden />
    </button>
  );

  const nodeClassName = `${className ?? ''}${isDragging ? ' is-dragging' : ''}`;

  if (tag === 'li') {
    return (
      <li ref={setNodeRef} style={style} className={nodeClassName}>
        {children(dragHandle)}
      </li>
    );
  }

  if (tag === 'span') {
    return (
      <span ref={setNodeRef} style={style} className={nodeClassName}>
        {children(dragHandle)}
      </span>
    );
  }

  return (
    <div ref={setNodeRef} style={style} className={nodeClassName}>
      {children(dragHandle)}
    </div>
  );
};

export interface IDocumentTemplateEditorProps {
  template: DocumentTemplate;
  values: Record<string, string>;
  onValuesChange: (updates: Record<string, string>) => void;
  onTemplateChange: (template: DocumentTemplate) => void;
  onHtmlChange?: (html: string) => void;
  simpleMode?: boolean;
  editableTemplateMeta?: boolean;
  allowLockedStructureEditing?: boolean;
  allowStructureReorder?: boolean;
  allowStyleEditing?: boolean;
}

export const DocumentTemplateEditor = ({
  template,
  values,
  onValuesChange,
  onTemplateChange,
  onHtmlChange,
  simpleMode = false,
  editableTemplateMeta = false,
  allowLockedStructureEditing = false,
  allowStructureReorder = false,
  allowStyleEditing = true,
}: IDocumentTemplateEditorProps) => {
  const { t } = useTranslation();
  const triggerSelectId = useId();
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [triggerDropdownData, setTriggerDropdownData] = useState<Array<{ id: string; label: string; value: string }>>(
    [],
  );
  const isStaticTemplate = template.render_mode === 'raw_html';
  const showTriggerSelector = template.show_trigger_selector === true;
  const isStructureLocked = template.lock_structure === true;
  const canEditStructure = !isStructureLocked || allowLockedStructureEditing;
  const canReorderStructure = allowStructureReorder || (!simpleMode && canEditStructure);
  const allowSectionManagement = template.allow_section_management === true;
  const documentDragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const rootSectionSortableIds = useMemo(
    () => template.sections.map(getDocumentSectionSortableId),
    [template.sections],
  );
  const triggerSourceLabel =
    template.primary_table === 'syllabuses' ? t('documentTemplateEditor.sources.syllabuses') : template.primary_table;
  const onHtmlChangeRef = useRef(onHtmlChange);
  const lastEmittedHtmlRef = useRef<string | null>(null);
  const htmlGenerationCycleRef = useRef(0);
  const latestTemplateRef = useRef(template);
  const templateIdRef = useRef(template.id);
  const lastInteractionInEditorRef = useRef(false);
  const undoStackRef = useRef<DocumentTemplate[]>([]);
  onHtmlChangeRef.current = onHtmlChange;
  latestTemplateRef.current = template;

  const commitTemplateChange = useCallback(
    (nextTemplate: DocumentTemplate) => {
      undoStackRef.current.push(structuredClone(latestTemplateRef.current));
      if (undoStackRef.current.length > DOCUMENT_TEMPLATE_UNDO_LIMIT) {
        undoStackRef.current.shift();
      }
      onTemplateChange(nextTemplate);
    },
    [onTemplateChange],
  );

  const undoTemplateChange = useCallback(() => {
    const previousTemplate = undoStackRef.current.pop();
    if (!previousTemplate) return false;

    setEditingField(null);
    setEditingLabel(null);
    onTemplateChange(previousTemplate);
    return true;
  }, [onTemplateChange]);

  const handleRootSectionDragEnd = useCallback(
    (event: DragEndEvent) => {
      const indexes = getSortableIndexes(rootSectionSortableIds, event);
      if (!indexes) return;

      const updated = structuredClone(template);
      updated.sections = arrayMove(updated.sections, indexes.oldIndex, indexes.newIndex);
      setEditingField(null);
      setEditingLabel(null);
      commitTemplateChange(updated);
    },
    [commitTemplateChange, rootSectionSortableIds, template],
  );

  const handleReorderChildSections = useCallback(
    (parentSectionId: string, oldIndex: number, newIndex: number) => {
      const updated = structuredClone(template);
      reorderChildSections(updated.sections, parentSectionId, oldIndex, newIndex);
      setEditingField(null);
      setEditingLabel(null);
      commitTemplateChange(updated);
    },
    [commitTemplateChange, template],
  );

  const handleReorderFields = useCallback(
    (sectionId: string, oldIndex: number, newIndex: number) => {
      const updated = structuredClone(template);
      reorderFieldsInSection(updated.sections, sectionId, oldIndex, newIndex);
      setEditingField(null);
      setEditingLabel(null);
      commitTemplateChange(updated);
    },
    [commitTemplateChange, template],
  );

  const handleReorderListItems = useCallback(
    (fieldId: string, oldIndex: number, newIndex: number) => {
      const valueUpdates = buildListItemReorderValueUpdates(template.sections, fieldId, oldIndex, newIndex, values);
      const updated = structuredClone(template);
      reorderListItems(updated.sections, fieldId, oldIndex, newIndex);
      if (Object.keys(valueUpdates).length > 0) {
        onValuesChange(valueUpdates);
      }
      setEditingField(null);
      setEditingLabel(null);
      commitTemplateChange(updated);
    },
    [commitTemplateChange, onValuesChange, template, values],
  );

  const handleReorderSubItems = useCallback(
    (fieldId: string, itemIdx: number, oldIndex: number, newIndex: number) => {
      const valueUpdates = buildSubItemReorderValueUpdates(
        template.sections,
        fieldId,
        itemIdx,
        oldIndex,
        newIndex,
        values,
      );
      const updated = structuredClone(template);
      reorderSubItems(updated.sections, fieldId, itemIdx, oldIndex, newIndex);
      if (Object.keys(valueUpdates).length > 0) {
        onValuesChange(valueUpdates);
      }
      setEditingField(null);
      setEditingLabel(null);
      commitTemplateChange(updated);
    },
    [commitTemplateChange, onValuesChange, template, values],
  );

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const editorElement = editorRef.current;
      lastInteractionInEditorRef.current = Boolean(
        editorElement && event.target instanceof Node && editorElement.contains(event.target),
      );
    };

    window.addEventListener('pointerdown', handlePointerDown, true);
    return () => window.removeEventListener('pointerdown', handlePointerDown, true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'z' || (!event.ctrlKey && !event.metaKey) || event.altKey || event.shiftKey) {
        return;
      }

      const activeElement = document.activeElement;
      const editorElement = editorRef.current;
      const isInsideEditor = Boolean(
        editorElement && activeElement instanceof Node && editorElement.contains(activeElement),
      );
      if (!isInsideEditor && !lastInteractionInEditorRef.current) return;

      const isNativeEditable =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        (activeElement instanceof HTMLElement && activeElement.isContentEditable);
      if (isNativeEditable) return;

      if (undoTemplateChange()) {
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoTemplateChange]);

  useEffect(() => {
    if (templateIdRef.current === template.id) return;
    templateIdRef.current = template.id;
    undoStackRef.current = [];
  }, [template.id]);

  // Build fetch fields list from template
  const fetchFields = useMemo(() => getDocumentFetchFields(template), [template]);

  // Build checkbox and reference configs for the template-data API.
  const checkboxConfigs = useMemo(() => {
    const result: Array<{
      key: string;
      sourceTable: string;
      sourceField: string;
      referenceTable: string;
      referenceField: string;
      matchValues: string[];
    }> = [];

    function walkSections(sections: DocumentSection[]) {
      for (const section of sections) {
        for (const field of section.fields) {
          if (field.type === 'checkbox' && field.fk_path) {
            const [srcTable, srcField] = field.fk_path.split('.');
            result.push({
              key: field.id,
              sourceTable: srcTable,
              sourceField: srcField,
              referenceTable: field.reference_table ?? '',
              referenceField: field.reference_field ?? '',
              matchValues: field.options.map((o) => o.match_value),
            });
          }
        }
        if (section.children) walkSections(section.children);
      }
    }

    walkSections(template.sections);
    return result;
  }, [template]);

  const referenceLookups = useMemo(() => {
    const result: Array<{
      key: string;
      fkTable: string;
      fkField: string;
      targetTable: string;
      targetField: string;
    }> = [];

    function walkSections(sections: DocumentSection[]) {
      for (const section of sections) {
        for (const field of section.fields) {
          if (field.type === 'reference' && field.fk_field) {
            const [fkTable, fkField] = field.fk_field.split('.');
            if (fkTable && fkField) {
              result.push({
                key: field.id,
                fkTable,
                fkField,
                targetTable: field.reference_table,
                targetField: field.reference_field,
              });
            }
          }
        }
        if (section.children) walkSections(section.children);
      }
    }

    walkSections(template.sections);
    return result;
  }, [template]);

  useEffect(() => {
    if (isStaticTemplate || !showTriggerSelector || !template.primary_table || !template.trigger_field) {
      setTriggerDropdownData([]);
      return;
    }

    let cancelled = false;

    void getTemplateTableOptionsAPI({
      table: template.primary_table,
      field_name: template.trigger_field,
      sort_order: 'asc',
    })
      .then((items) => {
        if (!cancelled) {
          setTriggerDropdownData(items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTriggerDropdownData([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isStaticTemplate, showTriggerSelector, template.primary_table, template.trigger_field]);

  // Auto-fetch data when trigger value changes
  const handleTriggerSelect = useCallback(
    async (selectedValue: string) => {
      if (isStaticTemplate || !showTriggerSelector) return;
      if (!selectedValue) return;
      setIsFetching(true);

      try {
        const result = await getTemplateDocumentDataAPI({
          primary_table: template.primary_table,
          trigger_field: template.trigger_field,
          trigger_value: selectedValue,
          join_conditions: template.join_conditions,
          fields_to_fetch: fetchFields,
          reference_lookups: referenceLookups.map((lookup) => ({
            key: lookup.key,
            fk_table: lookup.fkTable,
            fk_field: lookup.fkField,
            target_table: lookup.targetTable,
            target_field: lookup.targetField,
          })),
          checkbox_fields: checkboxConfigs.map((checkbox) => ({
            key: checkbox.key,
            source_table: checkbox.sourceTable,
            source_field: checkbox.sourceField,
            reference_table: checkbox.referenceTable,
            reference_field: checkbox.referenceField,
            match_values: checkbox.matchValues,
          })),
        });

        if (result) {
          // Update plain values
          const newValues: Record<string, string> = {};
          for (const [key, val] of Object.entries(result.values ?? {})) {
            newValues[key] = val !== null && val !== undefined ? String(val) : '';
          }
          const checkboxResults = result.checkbox_results as Record<string, string[]> | undefined;
          const checkboxValueUpdates = checkboxResults
            ? buildCheckboxValueUpdates(template.sections, checkboxResults)
            : {};
          onValuesChange({ ...newValues, ...checkboxValueUpdates });

          // Update checkbox fields in template
          if (checkboxResults && Object.keys(checkboxResults).length > 0) {
            const updated = structuredClone(template);
            updateCheckboxes(updated.sections, checkboxResults);
            onTemplateChange(updated);
          }
        }
      } catch (err) {
        console.error('❌ Document template fetch error:', err);
      } finally {
        setIsFetching(false);
      }
    },
    [
      template,
      fetchFields,
      referenceLookups,
      checkboxConfigs,
      onValuesChange,
      onTemplateChange,
      isStaticTemplate,
      showTriggerSelector,
    ],
  );

  // Regenerate HTML when values or template change
  useEffect(() => {
    if (!onHtmlChangeRef.current) return;

    htmlGenerationCycleRef.current += 1;
    const cycle = htmlGenerationCycleRef.current;
    const nextHtml = measureVariablePerformance(
      'DocumentTemplateEditor generateDocumentHtml',
      () => generateDocumentHtml(template, values),
      {
        cycle,
        template_id: template.id,
        value_count: Object.keys(values).length,
      },
    );
    if (lastEmittedHtmlRef.current === nextHtml) return;
    lastEmittedHtmlRef.current = nextHtml;
    if (shouldLogVariablePerformanceCycle(cycle)) {
      logVariablePerformance('DocumentTemplateEditor emit html', {
        cycle,
        template_id: template.id,
        html_length: nextHtml.length,
      });
    }
    onHtmlChangeRef.current?.(nextHtml);
  }, [template, values]);

  // ─── Render ───

  return (
    <div
      ref={editorRef}
      className={`doc-template-editor${simpleMode ? ' doc-editor-simple' : ''}${
        canReorderStructure ? ' doc-editor-reorder-enabled' : ''
      } ${isStructureLocked ? 'doc-template-locked' : ''}`}>
      <div className="doc-template-header">
        {editableTemplateMeta ? (
          <div className="doc-template-meta-editor">
            <input
              className="doc-template-name-input"
              value={template.name}
              onChange={(event) => onTemplateChange({ ...template, name: event.target.value })}
              placeholder={t('documentTemplateEditor.templateNamePlaceholder')}
            />
          </div>
        ) : (
          <>
            <h4>{template.name}</h4>
            {template.description && <p className="doc-template-desc">{template.description}</p>}
          </>
        )}
      </div>

      {isStaticTemplate ? (
        <div className="doc-template-static-note">{t('documentTemplateEditor.staticTemplateNote')}</div>
      ) : (
        <>
          {showTriggerSelector && (
            <div className="doc-template-trigger">
              <label htmlFor={triggerSelectId}>
                {t('documentTemplateEditor.triggerLabel', {
                  source: triggerSourceLabel || t('documentTemplateEditor.sources.data'),
                })}
              </label>
              <select
                id={triggerSelectId}
                onChange={(e) => handleTriggerSelect(e.target.value)}
                disabled={isFetching}
                defaultValue="">
                <option value="" disabled>
                  {isFetching ? t('common.status.loading') : t('documentTemplateEditor.selectPlaceholder')}
                </option>
                {(triggerDropdownData ?? []).map((item) => (
                  <option key={item.id} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              {isFetching && <span className="doc-spinner" />}
            </div>
          )}

          {/* Sections */}
          <div className="doc-template-sections">
            <DndContext
              sensors={documentDragSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleRootSectionDragEnd}>
              <SortableContext items={rootSectionSortableIds} strategy={verticalListSortingStrategy}>
                {template.sections.map((section, sectionIdx) => (
                  <SortableDocumentNode
                    key={section.id}
                    id={rootSectionSortableIds[sectionIdx]}
                    disabled={!canReorderStructure || template.sections.length <= 1}
                    dragTitle={t('documentTemplateEditor.reorderSection')}
                    className="doc-sortable-section">
                    {(sectionDragHandle) => (
                      <div className="doc-section-wrapper">
                        <SectionRenderer
                          section={section}
                          values={values}
                          editingField={editingField}
                          onEditField={setEditingField}
                          onValueChange={(fieldId, val) => onValuesChange({ [fieldId]: val })}
                          editingLabel={editingLabel}
                          onEditLabel={setEditingLabel}
                          simpleMode={simpleMode}
                          allowStyleEditing={allowStyleEditing}
                          dragSensors={documentDragSensors}
                          sectionDragHandle={sectionDragHandle}
                          onReorderFields={handleReorderFields}
                          onReorderChildSections={handleReorderChildSections}
                          onReorderListItems={handleReorderListItems}
                          onReorderSubItems={handleReorderSubItems}
                          canReorderStructure={canReorderStructure}
                          onFieldLabelChange={(fieldId, newLabel) => {
                            const updated = structuredClone(template);
                            updateFieldLabel(updated.sections, fieldId, newLabel);
                            commitTemplateChange(updated);
                          }}
                          onListItemLabelChange={(fieldId, itemIdx, newLabel) => {
                            const updated = structuredClone(template);
                            updateListItemLabel(updated.sections, fieldId, itemIdx, newLabel);
                            commitTemplateChange(updated);
                          }}
                          onListItemPrefixChange={(fieldId, prefix) => {
                            const updated = structuredClone(template);
                            updateListItemPrefix(updated.sections, fieldId, prefix);
                            commitTemplateChange(updated);
                          }}
                          onListItemNumberChange={(fieldId, itemIdx, itemNumber) => {
                            const updated = structuredClone(template);
                            updateListItemNumber(updated.sections, fieldId, itemIdx, itemNumber);
                            commitTemplateChange(updated);
                          }}
                          onSectionTitleChange={(sectionId, newTitle) => {
                            const updated = structuredClone(template);
                            updateSectionTitle(updated.sections, sectionId, newTitle);
                            commitTemplateChange(updated);
                          }}
                          onSectionStyleChange={(sectionId, style) => {
                            const updated = structuredClone(template);
                            updateSectionStyle(updated.sections, sectionId, style);
                            commitTemplateChange(updated);
                          }}
                          onFieldStyleChange={(fieldId, style) => {
                            const updated = structuredClone(template);
                            updateFieldStyle(updated.sections, fieldId, style);
                            commitTemplateChange(updated);
                          }}
                          onListItemStyleChange={(fieldId, itemIdx, style) => {
                            const updated = structuredClone(template);
                            updateListItemStyle(updated.sections, fieldId, itemIdx, style);
                            commitTemplateChange(updated);
                          }}
                          onSubItemStyleChange={(fieldId, itemIdx, subIdx, style) => {
                            const updated = structuredClone(template);
                            updateSubItemStyle(updated.sections, fieldId, itemIdx, subIdx, style);
                            commitTemplateChange(updated);
                          }}
                          onCheckboxToggle={(fieldId, optIdx) => {
                            const field = findCheckboxField(template.sections, fieldId);
                            if (field) {
                              const option = field.options[optIdx];
                              const optionValue = option ? getDocumentCheckboxOptionValue(option) : '';
                              const selectedValues = new Set(getDocumentCheckboxSelectedValues(field, values));

                              if (optionValue) {
                                if (selectedValues.has(optionValue)) {
                                  selectedValues.delete(optionValue);
                                } else {
                                  if (field.exclusive) {
                                    selectedValues.clear();
                                  }
                                  selectedValues.add(optionValue);
                                }

                                onValuesChange({
                                  [getDocumentFieldValueKey(field)]: serializeDocumentCheckboxValue(
                                    field.options
                                      .map(getDocumentCheckboxOptionValue)
                                      .filter((value) => selectedValues.has(value)),
                                  ),
                                });
                              }
                            }

                            const updated = structuredClone(template);
                            toggleCheckbox(updated.sections, fieldId, optIdx);
                            commitTemplateChange(updated);
                          }}
                          onAddCheckboxOption={(fieldId, label) => {
                            const updated = structuredClone(template);
                            addCheckboxOption(updated.sections, fieldId, label);
                            commitTemplateChange(updated);
                          }}
                          onRemoveCheckboxOption={(fieldId, optionIdx) => {
                            const field = findCheckboxField(template.sections, fieldId);
                            const option = field?.options[optionIdx];

                            if (field && option) {
                              const optionValue = getDocumentCheckboxOptionValue(option);
                              const nextSelectedValues = getDocumentCheckboxSelectedValues(field, values).filter(
                                (value) => value !== optionValue,
                              );
                              onValuesChange({
                                [getDocumentFieldValueKey(field)]: serializeDocumentCheckboxValue(nextSelectedValues),
                              });
                            }

                            const updated = structuredClone(template);
                            removeCheckboxOption(updated.sections, fieldId, optionIdx);
                            commitTemplateChange(updated);
                          }}
                          onReorderCheckboxOptions={(fieldId, oldIndex, newIndex) => {
                            const updated = structuredClone(template);
                            reorderCheckboxOptions(updated.sections, fieldId, oldIndex, newIndex);
                            commitTemplateChange(updated);
                          }}
                          onAddField={(sectionId, fieldType) => {
                            const updated = structuredClone(template);
                            addFieldToSection(updated.sections, sectionId, fieldType);
                            commitTemplateChange(updated);
                          }}
                          onAddListItem={(fieldId) => {
                            const updated = structuredClone(template);
                            addListItem(updated.sections, fieldId);
                            commitTemplateChange(updated);
                          }}
                          onRemoveField={(sectionId, fieldId) => {
                            const updated = structuredClone(template);
                            removeFieldFromSection(updated.sections, sectionId, fieldId);
                            commitTemplateChange(updated);
                          }}
                          onRemoveListItem={(fieldId, itemIdx) => {
                            const valueUpdates = buildListItemRemovalValueUpdates(
                              template.sections,
                              fieldId,
                              itemIdx,
                              values,
                            );
                            const updated = structuredClone(template);
                            removeListItem(updated.sections, fieldId, itemIdx);
                            if (Object.keys(valueUpdates).length > 0) {
                              onValuesChange(valueUpdates);
                            }
                            commitTemplateChange(updated);
                          }}
                          onAddSubItem={(fieldId, itemIdx) => {
                            const updated = structuredClone(template);
                            addSubItem(updated.sections, fieldId, itemIdx);
                            commitTemplateChange(updated);
                          }}
                          onRemoveSubItem={(fieldId, itemIdx, subIdx) => {
                            const updated = structuredClone(template);
                            removeSubItem(updated.sections, fieldId, itemIdx, subIdx);
                            commitTemplateChange(updated);
                          }}
                          onAddChildSection={(parentSectionId) => {
                            const updated = structuredClone(template);
                            addChildSection(updated.sections, parentSectionId);
                            commitTemplateChange(updated);
                          }}
                          onRemoveChildSection={(parentSectionId, childSectionId) => {
                            const updated = structuredClone(template);
                            removeChildSection(updated.sections, parentSectionId, childSectionId);
                            commitTemplateChange(updated);
                          }}
                          isStructureLocked={isStructureLocked}
                          canEditStructure={canEditStructure}
                          allowSectionManagement={allowSectionManagement}
                        />
                        {canEditStructure && (
                          <button
                            type="button"
                            className="doc-remove-btn doc-remove-section-btn"
                            onClick={() => {
                              const updated = structuredClone(template);
                              updated.sections = updated.sections.filter((s) => s.id !== section.id);
                              commitTemplateChange(updated);
                            }}
                            title={t('documentTemplateEditor.removeSection')}
                            aria-label={t('documentTemplateEditor.removeSection')}>
                            <Trash2 className="doc-action-icon" aria-hidden />
                          </button>
                        )}
                      </div>
                    )}
                  </SortableDocumentNode>
                ))}
              </SortableContext>
            </DndContext>
            {canEditStructure && !allowSectionManagement && (
              <button
                type="button"
                className="doc-add-btn"
                onClick={() => {
                  const updated = structuredClone(template);
                  const idx = updated.sections.length + 1;
                  updated.sections.push({
                    id: `sec_${Date.now()}`,
                    title: t('documentTemplateEditor.newSectionTitle', { index: idx }),
                    fields: [],
                  });
                  commitTemplateChange(updated);
                }}>
                + {t('documentTemplateEditor.addSection')}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const MultiReferenceListEditor = ({
  field,
  value,
  onChange,
}: {
  field: DocumentMultiReferenceListField;
  value: string;
  onChange: (value: string) => void;
}) => {
  const [records, setRecords] = useState<TTemplateDataRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const selectedItems = useMemo(() => parseDocumentMultiReferenceListValue(value), [value]);
  const valueField = useMemo(() => getMultiReferenceLookupValueField(field), [field]);
  const labelField = useMemo(() => getMultiReferenceLookupLabelField(field), [field]);

  useEffect(() => {
    if (!field.reference_table) {
      setRecords([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    void getTemplateTableRecordsAPI(field.reference_table)
      .then((items) => {
        if (!cancelled) {
          setRecords(items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRecords([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [field.reference_table]);

  const options = useMemo(() => {
    const seen = new Set<string>();

    return records
      .map((record) => {
        const optionValue = getRecordFieldText(record, valueField);
        if (!optionValue || seen.has(optionValue)) return null;

        seen.add(optionValue);

        const labelValue = getRecordFieldText(record, labelField) || optionValue;
        const code = getRecordFieldText(record, 'code');
        const label = code && code !== labelValue ? `${labelValue} - ${code}` : labelValue;

        return {
          value: optionValue,
          label,
          record,
        };
      })
      .filter((item): item is { value: string; label: string; record: TTemplateDataRecord } => item !== null);
  }, [labelField, records, valueField]);

  const selectedValues = useMemo(() => selectedItems.map((item) => item.value), [selectedItems]);

  const handleValueChange = useCallback(
    (nextValues: string[]) => {
      const nextItems = nextValues
        .map((nextValue): DocumentMultiReferenceListValueItem | null => {
          const option = options.find((item) => item.value === nextValue);
          const existing = selectedItems.find((item) => item.value === nextValue);

          return {
            value: nextValue,
            label: option?.label ?? existing?.label ?? nextValue,
            record: option?.record ?? existing?.record,
          };
        })
        .filter((item): item is DocumentMultiReferenceListValueItem => item !== null);

      onChange(serializeDocumentMultiReferenceListValue(nextItems));
    },
    [onChange, options, selectedItems],
  );

  return (
    <div className="doc-reference-editor">
      <SearchableMultiSelect
        value={selectedValues}
        onValueChange={handleValueChange}
        options={options}
        loading={isLoading}
        placeholder="Chọn giảng viên"
        searchPlaceholder="Tìm giảng viên"
        emptyMessage="Không có giảng viên phù hợp."
        clearLabel="Xóa chọn"
        className="doc-reference-select"
        triggerClassName="doc-reference-select-trigger"
        contentClassName="z-[70]"
        maxDisplay={4}
      />
      {selectedItems.length > 0 && (
        <div className="doc-multi-reference-preview" style={getEditorReactStyle(field.style)}>
          {selectedItems.map((item, index) => {
            const itemLabel = field.item_label_prefix ? `${field.item_label_prefix}${index + 1}: ` : '';
            const dashPrefix = field.show_dash_prefix === false ? '' : '- ';
            return (
              <div key={`${item.value}-${index}`}>
                {dashPrefix}
                {itemLabel}
                {formatDocumentMultiReferenceListItem(field, item)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Section renderer ───

function SectionRenderer({
  section,
  values,
  editingField,
  onEditField,
  editingLabel,
  onEditLabel,
  onFieldLabelChange,
  onListItemLabelChange,
  onListItemPrefixChange,
  onListItemNumberChange,
  onSectionTitleChange,
  onSectionStyleChange,
  onFieldStyleChange,
  onListItemStyleChange,
  onSubItemStyleChange,
  onValueChange,
  onCheckboxToggle,
  onAddCheckboxOption,
  onRemoveCheckboxOption,
  onReorderCheckboxOptions,
  onAddField,
  onAddListItem,
  onRemoveField,
  onRemoveListItem,
  onAddSubItem,
  onRemoveSubItem,
  onAddChildSection,
  onRemoveChildSection,
  onRemoveSelf,
  onReorderFields,
  onReorderChildSections,
  onReorderListItems,
  onReorderSubItems,
  dragSensors,
  sectionDragHandle,
  isStructureLocked,
  canEditStructure,
  canReorderStructure,
  allowSectionManagement,
  simpleMode = false,
  allowStyleEditing = true,
  depth = 0,
}: {
  section: DocumentSection;
  values: Record<string, string>;
  simpleMode?: boolean;
  allowStyleEditing?: boolean;
  editingField: string | null;
  onEditField: (id: string | null) => void;
  editingLabel: string | null;
  onEditLabel: (id: string | null) => void;
  onFieldLabelChange: (fieldId: string, newLabel: string) => void;
  onListItemLabelChange: (fieldId: string, itemIdx: number, newLabel: string) => void;
  onListItemPrefixChange: (fieldId: string, prefix: string) => void;
  onListItemNumberChange: (fieldId: string, itemIdx: number, itemNumber: string) => void;
  onSectionTitleChange: (sectionId: string, newTitle: string) => void;
  onSectionStyleChange: (sectionId: string, style: TEditorTextStyle | undefined) => void;
  onFieldStyleChange: (fieldId: string, style: TEditorTextStyle | undefined) => void;
  onListItemStyleChange: (fieldId: string, itemIdx: number, style: TEditorTextStyle | undefined) => void;
  onSubItemStyleChange: (fieldId: string, itemIdx: number, subIdx: number, style: TEditorTextStyle | undefined) => void;
  onValueChange: (fieldId: string, value: string) => void;
  onCheckboxToggle: (fieldId: string, optionIdx: number) => void;
  onAddCheckboxOption: (fieldId: string, label: string) => void;
  onRemoveCheckboxOption: (fieldId: string, optionIdx: number) => void;
  onReorderCheckboxOptions: (fieldId: string, oldIndex: number, newIndex: number) => void;
  onAddField: (sectionId: string, fieldType?: string) => void;
  onAddListItem: (fieldId: string) => void;
  onRemoveField: (sectionId: string, fieldId: string) => void;
  onRemoveListItem: (fieldId: string, itemIdx: number) => void;
  onAddSubItem: (fieldId: string, itemIdx: number) => void;
  onRemoveSubItem: (fieldId: string, itemIdx: number, subIdx: number) => void;
  onAddChildSection: (parentSectionId: string) => void;
  onRemoveChildSection: (parentSectionId: string, childSectionId: string) => void;
  onRemoveSelf?: () => void;
  onReorderFields: (sectionId: string, oldIndex: number, newIndex: number) => void;
  onReorderChildSections: (parentSectionId: string, oldIndex: number, newIndex: number) => void;
  onReorderListItems: (fieldId: string, oldIndex: number, newIndex: number) => void;
  onReorderSubItems: (fieldId: string, itemIdx: number, oldIndex: number, newIndex: number) => void;
  dragSensors: TDocumentDragSensors;
  sectionDragHandle?: ReactNode;
  isStructureLocked?: boolean;
  canEditStructure?: boolean;
  canReorderStructure?: boolean;
  allowSectionManagement?: boolean;
  depth?: number;
}) {
  const { t } = useTranslation();
  const sectionLabelKey = `section:${section.id}`;
  const [newFieldType, setNewFieldType] = useState<string>('text');
  const isFormTableSection = section.layout === 'form_table';
  const fieldSortableIds = useMemo(() => section.fields.map(getDocumentFieldSortableId), [section.fields]);
  const childSectionSortableIds = useMemo(
    () => (section.children ?? []).map(getDocumentSectionSortableId),
    [section.children],
  );
  const handleFieldDragEnd = useCallback(
    (event: DragEndEvent) => {
      const indexes = getSortableIndexes(fieldSortableIds, event);
      if (indexes) onReorderFields(section.id, indexes.oldIndex, indexes.newIndex);
    },
    [fieldSortableIds, onReorderFields, section.id],
  );
  const handleChildSectionDragEnd = useCallback(
    (event: DragEndEvent) => {
      const indexes = getSortableIndexes(childSectionSortableIds, event);
      if (indexes) onReorderChildSections(section.id, indexes.oldIndex, indexes.newIndex);
    },
    [childSectionSortableIds, onReorderChildSections, section.id],
  );

  return (
    <div className={`doc-section doc-section-depth-${depth}`}>
      <div className="doc-field" style={{ alignItems: 'center' }}>
        {sectionDragHandle}
        <EditableLabel
          value={section.title}
          isEditing={editingLabel === sectionLabelKey}
          onDoubleClick={() => onEditLabel(sectionLabelKey)}
          onSave={(val) => {
            onSectionTitleChange(section.id, val);
            onEditLabel(null);
          }}
          onCancel={() => onEditLabel(null)}
          className="doc-section-title"
          tag="h5"
          styleConfig={section.style}
        />
        {allowStyleEditing && (
          <DocumentNodeStyleControl
            value={section.style}
            onChange={(style) => onSectionStyleChange(section.id, style)}
            title={t('documentTemplateEditor.styleSectionTitle')}
          />
        )}
        {canEditStructure && onRemoveSelf && (
          <button
            type="button"
            className="doc-remove-btn"
            onClick={onRemoveSelf}
            title={t('documentTemplateEditor.removeItem')}
            aria-label={t('documentTemplateEditor.removeItem')}>
            <Trash2 className="doc-action-icon" aria-hidden />
          </button>
        )}
      </div>

      <DndContext sensors={dragSensors} collisionDetection={closestCenter} onDragEnd={handleFieldDragEnd}>
        <SortableContext items={fieldSortableIds} strategy={verticalListSortingStrategy}>
          <div
            className={isFormTableSection ? 'doc-form-table' : undefined}
            style={
              isFormTableSection
                ? ({ ['--doc-form-label-width' as const]: section.label_width ?? '24%' } as React.CSSProperties)
                : undefined
            }>
            {section.fields.map((field, fieldIdx) => (
              <SortableDocumentNode
                key={field.id}
                id={fieldSortableIds[fieldIdx]}
                disabled={!canReorderStructure || section.fields.length <= 1}
                dragTitle={t('documentTemplateEditor.reorderField')}
                className="doc-sortable-field">
                {(fieldDragHandle) => (
                  <FieldRenderer
                    field={field}
                    sectionId={section.id}
                    values={values}
                    isEditing={editingField === field.id}
                    onEdit={() => onEditField(field.id)}
                    onBlur={() => onEditField(null)}
                    editingLabel={editingLabel}
                    onEditLabel={onEditLabel}
                    onFieldLabelChange={onFieldLabelChange}
                    onListItemLabelChange={onListItemLabelChange}
                    onListItemPrefixChange={onListItemPrefixChange}
                    onListItemNumberChange={onListItemNumberChange}
                    onFieldStyleChange={onFieldStyleChange}
                    onListItemStyleChange={onListItemStyleChange}
                    onSubItemStyleChange={onSubItemStyleChange}
                    onValueChange={onValueChange}
                    onCheckboxToggle={onCheckboxToggle}
                    onAddCheckboxOption={onAddCheckboxOption}
                    onRemoveCheckboxOption={onRemoveCheckboxOption}
                    onReorderCheckboxOptions={onReorderCheckboxOptions}
                    onAddListItem={onAddListItem}
                    onRemoveField={onRemoveField}
                    onRemoveListItem={onRemoveListItem}
                    onAddSubItem={onAddSubItem}
                    onRemoveSubItem={onRemoveSubItem}
                    onReorderListItems={onReorderListItems}
                    onReorderSubItems={onReorderSubItems}
                    dragSensors={dragSensors}
                    fieldDragHandle={fieldDragHandle}
                    isStructureLocked={isStructureLocked}
                    canEditStructure={canEditStructure}
                    canReorderStructure={canReorderStructure}
                    simpleMode={simpleMode}
                    allowStyleEditing={allowStyleEditing}
                    sectionLayout={section.layout}
                  />
                )}
              </SortableDocumentNode>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {canEditStructure && !allowSectionManagement && (
        <div className="doc-add-field-row">
          <select
            className="doc-add-field-select"
            value={newFieldType}
            onChange={(e) => setNewFieldType(e.target.value)}>
            <option value="text">{t('documentTemplateEditor.fieldTypes.text')}</option>
            <option value="number">{t('documentTemplateEditor.fieldTypes.number')}</option>
            <option value="list">{t('documentTemplateEditor.fieldTypes.list')}</option>
            <option value="nested_list">{t('documentTemplateEditor.fieldTypes.nestedList')}</option>
            <option value="checkbox">{t('documentTemplateEditor.fieldTypes.checkbox')}</option>
            <option value="computed">{t('documentTemplateEditor.fieldTypes.computed')}</option>
            <option value="reference">{t('documentTemplateEditor.fieldTypes.reference')}</option>
          </select>
          <button
            type="button"
            className="doc-add-btn"
            onClick={() => onAddField(section.id, newFieldType)}
            title={t('documentTemplateEditor.addField')}>
            + {t('documentTemplateEditor.addField')}
          </button>
          <button
            type="button"
            className="doc-add-btn doc-add-btn-secondary"
            onClick={() => onAddField(section.id, 'nested_list')}
            title={t('documentTemplateEditor.addNestedList')}>
            + {t('documentTemplateEditor.addNestedList')}
          </button>
        </div>
      )}

      {section.children && (
        <DndContext sensors={dragSensors} collisionDetection={closestCenter} onDragEnd={handleChildSectionDragEnd}>
          <SortableContext items={childSectionSortableIds} strategy={verticalListSortingStrategy}>
            {section.children.map((child, childIdx) => (
              <SortableDocumentNode
                key={child.id}
                id={childSectionSortableIds[childIdx]}
                disabled={!canReorderStructure || (section.children?.length ?? 0) <= 1}
                dragTitle={t('documentTemplateEditor.reorderSection')}
                className="doc-sortable-section">
                {(childSectionDragHandle) => (
                  <div className="doc-section-wrapper" style={{ position: 'relative' }}>
                    <SectionRenderer
                      section={child}
                      values={values}
                      editingField={editingField}
                      onEditField={onEditField}
                      onValueChange={onValueChange}
                      onCheckboxToggle={onCheckboxToggle}
                      onAddCheckboxOption={onAddCheckboxOption}
                      onRemoveCheckboxOption={onRemoveCheckboxOption}
                      onReorderCheckboxOptions={onReorderCheckboxOptions}
                      editingLabel={editingLabel}
                      onEditLabel={onEditLabel}
                      onFieldLabelChange={onFieldLabelChange}
                      onListItemLabelChange={onListItemLabelChange}
                      onListItemPrefixChange={onListItemPrefixChange}
                      onListItemNumberChange={onListItemNumberChange}
                      onSectionTitleChange={onSectionTitleChange}
                      onSectionStyleChange={onSectionStyleChange}
                      onFieldStyleChange={onFieldStyleChange}
                      onListItemStyleChange={onListItemStyleChange}
                      onSubItemStyleChange={onSubItemStyleChange}
                      onAddField={onAddField}
                      onAddListItem={onAddListItem}
                      onRemoveField={onRemoveField}
                      onRemoveListItem={onRemoveListItem}
                      onAddSubItem={onAddSubItem}
                      onRemoveSubItem={onRemoveSubItem}
                      onAddChildSection={onAddChildSection}
                      onRemoveChildSection={onRemoveChildSection}
                      onRemoveSelf={canEditStructure ? () => onRemoveChildSection(section.id, child.id) : undefined}
                      onReorderFields={onReorderFields}
                      onReorderChildSections={onReorderChildSections}
                      onReorderListItems={onReorderListItems}
                      onReorderSubItems={onReorderSubItems}
                      dragSensors={dragSensors}
                      sectionDragHandle={childSectionDragHandle}
                      isStructureLocked={isStructureLocked}
                      canEditStructure={canEditStructure}
                      canReorderStructure={canReorderStructure}
                      allowSectionManagement={allowSectionManagement}
                      simpleMode={simpleMode}
                      allowStyleEditing={allowStyleEditing}
                      depth={depth + 1}
                    />
                    {canEditStructure && (
                      <button
                        type="button"
                        className="doc-add-btn"
                        onClick={() => onAddField(child.id, 'text')}
                        title={t('documentTemplateEditor.addChildItemToSection')}>
                        + {t('documentTemplateEditor.addChildItem')}
                      </button>
                    )}
                  </div>
                )}
              </SortableDocumentNode>
            ))}
          </SortableContext>
        </DndContext>
      )}

      {canEditStructure && Array.isArray(section.children) && (
        <button
          type="button"
          className="doc-add-btn"
          style={{ marginTop: 4 }}
          onClick={() => onAddChildSection(section.id)}>
          + {t('documentTemplateEditor.addItem')}
        </button>
      )}
    </div>
  );
}

// ─── Field renderer ───

function FieldRenderer({
  field,
  sectionId,
  values,
  isEditing,
  onEdit,
  onBlur,
  editingLabel,
  onEditLabel,
  onFieldLabelChange,
  onListItemLabelChange,
  onListItemPrefixChange,
  onListItemNumberChange,
  onFieldStyleChange,
  onListItemStyleChange,
  onSubItemStyleChange,
  onValueChange,
  onCheckboxToggle,
  onAddCheckboxOption,
  onRemoveCheckboxOption,
  onReorderCheckboxOptions,
  onAddListItem,
  onRemoveField,
  onRemoveListItem,
  onAddSubItem,
  onRemoveSubItem,
  onReorderListItems,
  onReorderSubItems,
  dragSensors,
  fieldDragHandle,
  isStructureLocked = false,
  canEditStructure = !isStructureLocked,
  canReorderStructure = canEditStructure,
  allowSectionManagement: _allowSectionManagement = false,
  simpleMode = false,
  allowStyleEditing = true,
  sectionLayout,
}: {
  field: DocumentField;
  sectionId: string;
  values: Record<string, string>;
  isEditing: boolean;
  onEdit: () => void;
  onBlur: () => void;
  editingLabel: string | null;
  onEditLabel: (id: string | null) => void;
  onFieldLabelChange: (fieldId: string, newLabel: string) => void;
  onListItemLabelChange: (fieldId: string, itemIdx: number, newLabel: string) => void;
  onListItemPrefixChange: (fieldId: string, prefix: string) => void;
  onListItemNumberChange: (fieldId: string, itemIdx: number, itemNumber: string) => void;
  onFieldStyleChange: (fieldId: string, style: TEditorTextStyle | undefined) => void;
  onListItemStyleChange: (fieldId: string, itemIdx: number, style: TEditorTextStyle | undefined) => void;
  onSubItemStyleChange: (fieldId: string, itemIdx: number, subIdx: number, style: TEditorTextStyle | undefined) => void;
  onValueChange: (fieldId: string, value: string) => void;
  onCheckboxToggle: (fieldId: string, optionIdx: number) => void;
  onAddCheckboxOption: (fieldId: string, label: string) => void;
  onRemoveCheckboxOption: (fieldId: string, optionIdx: number) => void;
  onReorderCheckboxOptions: (fieldId: string, oldIndex: number, newIndex: number) => void;
  onAddListItem: (fieldId: string) => void;
  onRemoveField: (sectionId: string, fieldId: string) => void;
  onRemoveListItem: (fieldId: string, itemIdx: number) => void;
  onAddSubItem: (fieldId: string, itemIdx: number) => void;
  onRemoveSubItem: (fieldId: string, itemIdx: number, subIdx: number) => void;
  onReorderListItems: (fieldId: string, oldIndex: number, newIndex: number) => void;
  onReorderSubItems: (fieldId: string, itemIdx: number, oldIndex: number, newIndex: number) => void;
  dragSensors: TDocumentDragSensors;
  fieldDragHandle?: ReactNode;
  isStructureLocked?: boolean;
  canEditStructure?: boolean;
  canReorderStructure?: boolean;
  allowSectionManagement?: boolean;
  simpleMode?: boolean;
  allowStyleEditing?: boolean;
  sectionLayout?: DocumentSection['layout'];
}) {
  const { t } = useTranslation();
  const fieldLabelKey = `field:${field.id}`;
  const isFormTableLayout = sectionLayout === 'form_table';
  const checkboxOptionSortableIds = useMemo(
    () =>
      field.type === 'checkbox'
        ? field.options.map((opt, idx) =>
            getDocumentCheckboxOptionSortableId(field.id, getDocumentCheckboxOptionValue(opt), idx),
          )
        : [],
    [field],
  );
  const handleAddCheckboxOption = () => {
    if (field.type !== 'checkbox') return;

    const defaultLabel = t('documentTemplateEditor.checkboxOptionDefaultLabel', {
      index: field.options.length + 1,
    });
    const promptedLabel = window.prompt(t('documentTemplateEditor.checkboxOptionPrompt'), defaultLabel);
    const nextLabel = promptedLabel?.trim();

    if (!nextLabel) return;

    onAddCheckboxOption(field.id, nextLabel);
  };
  const handleCheckboxOptionDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (field.type !== 'checkbox') return;

      const indexes = getSortableIndexes(checkboxOptionSortableIds, event);
      if (indexes) {
        onReorderCheckboxOptions(field.id, indexes.oldIndex, indexes.newIndex);
      }
    },
    [checkboxOptionSortableIds, field, onReorderCheckboxOptions],
  );

  if (isFormTableLayout && !field.label.trim()) {
    const val =
      field.type === 'checkbox' || field.type === 'list' || field.type === 'multi_reference_list'
        ? ''
        : resolveDocumentFieldValue(field, values);

    return (
      <div className="doc-form-note">
        {fieldDragHandle}
        <span className="doc-form-note-text" style={getEditorReactStyle(field.style)}>
          {val}
        </span>
        {allowStyleEditing && (
          <DocumentNodeStyleControl
            value={field.style}
            onChange={(style) => onFieldStyleChange(field.id, style)}
            title={t('documentTemplateEditor.styleFieldTitle')}
          />
        )}
        {canEditStructure && (
          <button
            type="button"
            className="doc-remove-btn doc-remove-structural"
            onClick={() => onRemoveField(sectionId, field.id)}
            title={t('documentTemplateEditor.removeField')}
            aria-label={t('documentTemplateEditor.removeField')}>
            <Trash2 className="doc-action-icon" aria-hidden />
          </button>
        )}
      </div>
    );
  }

  if (field.type === 'checkbox') {
    const canManageCheckboxOptions = canEditStructure && !simpleMode;
    const checkboxOptionsContent = (
      <span
        className={`doc-field-options${canManageCheckboxOptions ? ' doc-field-options-manageable' : ''}`}
        style={getEditorReactStyle(field.style)}>
        {field.options.map((opt, idx) => {
          const optionContent = (
            <>
              {canManageCheckboxOptions && field.options.length > 1 ? (
                <button
                  type="button"
                  className="doc-drag-handle doc-checkbox-option-drag-handle"
                  title={t('documentTemplateEditor.reorderOption')}>
                  <GripVertical className="doc-drag-icon" aria-hidden />
                </button>
              ) : null}
              <label className="doc-checkbox-option">
                <input
                  type="checkbox"
                  checked={isDocumentCheckboxOptionChecked(field, opt, values)}
                  onChange={() => onCheckboxToggle(field.id, idx)}
                />
                {opt.label}
              </label>
              {canManageCheckboxOptions && (
                <button
                  type="button"
                  className="doc-remove-btn doc-checkbox-option-remove"
                  onClick={() => onRemoveCheckboxOption(field.id, idx)}
                  title={t('documentTemplateEditor.removeOption')}
                  aria-label={t('documentTemplateEditor.removeOption')}>
                  <Trash2 className="doc-action-icon" aria-hidden />
                </button>
              )}
            </>
          );

          if (!canManageCheckboxOptions) {
            return (
              <span key={opt.match_value || opt.label} className="doc-checkbox-option-row">
                {optionContent}
              </span>
            );
          }

          return (
            <SortableDocumentNode
              key={checkboxOptionSortableIds[idx]}
              id={checkboxOptionSortableIds[idx]}
              tag="span"
              disabled={field.options.length <= 1}
              dragTitle={t('documentTemplateEditor.reorderOption')}
              className="doc-checkbox-option-row">
              {(optionDragHandle) => (
                <>
                  {field.options.length > 1 ? optionDragHandle : null}
                  <label className="doc-checkbox-option">
                    <input
                      type="checkbox"
                      checked={isDocumentCheckboxOptionChecked(field, opt, values)}
                      onChange={() => onCheckboxToggle(field.id, idx)}
                    />
                    {opt.label}
                  </label>
                  <button
                    type="button"
                    className="doc-remove-btn doc-checkbox-option-remove"
                    onClick={() => onRemoveCheckboxOption(field.id, idx)}
                    title={t('documentTemplateEditor.removeOption')}
                    aria-label={t('documentTemplateEditor.removeOption')}>
                    <Trash2 className="doc-action-icon" aria-hidden />
                  </button>
                </>
              )}
            </SortableDocumentNode>
          );
        })}
        {canManageCheckboxOptions && (
          <button
            type="button"
            className="doc-add-btn doc-checkbox-add-btn"
            onClick={handleAddCheckboxOption}
            title={t('documentTemplateEditor.addOption')}>
            + {t('documentTemplateEditor.addOption')}
          </button>
        )}
      </span>
    );
    const checkboxOptions = canManageCheckboxOptions ? (
      <DndContext sensors={dragSensors} collisionDetection={closestCenter} onDragEnd={handleCheckboxOptionDragEnd}>
        <SortableContext items={checkboxOptionSortableIds} strategy={rectSortingStrategy}>
          {checkboxOptionsContent}
        </SortableContext>
      </DndContext>
    ) : (
      checkboxOptionsContent
    );

    if (isFormTableLayout) {
      return (
        <div className="doc-field doc-field-form-row doc-field-form-row-checkbox">
          <div className="doc-form-label-cell">
            {fieldDragHandle}
            <EditableLabel
              value={field.label}
              isEditing={editingLabel === fieldLabelKey}
              onDoubleClick={() => onEditLabel(fieldLabelKey)}
              onSave={(val) => {
                onFieldLabelChange(field.id, val);
                onEditLabel(null);
              }}
              onCancel={() => onEditLabel(null)}
              className="doc-field-label doc-form-label-text"
              suffix={getDocumentFieldLabelSuffix(field, '')}
              styleConfig={field.style}
            />
          </div>
          <div className="doc-form-value-cell">
            {checkboxOptions}
            {(allowStyleEditing || canEditStructure) && (
              <div className="doc-form-value-actions">
                {allowStyleEditing && (
                  <DocumentNodeStyleControl
                    value={field.style}
                    onChange={(style) => onFieldStyleChange(field.id, style)}
                    title={t('documentTemplateEditor.styleFieldTitle')}
                  />
                )}
                {canEditStructure && (
                  <button
                    type="button"
                    className="doc-remove-btn doc-remove-structural"
                    onClick={() => onRemoveField(sectionId, field.id)}
                    title={t('documentTemplateEditor.removeField')}
                    aria-label={t('documentTemplateEditor.removeField')}>
                    <Trash2 className="doc-action-icon" aria-hidden />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="doc-field doc-field-checkbox">
        {fieldDragHandle}
        <EditableLabel
          value={field.label}
          isEditing={editingLabel === fieldLabelKey}
          onDoubleClick={() => onEditLabel(fieldLabelKey)}
          onSave={(val) => {
            onFieldLabelChange(field.id, val);
            onEditLabel(null);
          }}
          onCancel={() => onEditLabel(null)}
          className="doc-field-label"
          suffix={getDocumentFieldLabelSuffix(field)}
          styleConfig={field.style}
        />
        {allowStyleEditing && (
          <DocumentNodeStyleControl
            value={field.style}
            onChange={(style) => onFieldStyleChange(field.id, style)}
            title={t('documentTemplateEditor.styleFieldTitle')}
          />
        )}
        {checkboxOptions}
        {canEditStructure && (
          <button
            type="button"
            className="doc-remove-btn doc-remove-structural"
            onClick={() => onRemoveField(sectionId, field.id)}
            title={t('documentTemplateEditor.removeField')}
            aria-label={t('documentTemplateEditor.removeField')}>
            <Trash2 className="doc-action-icon" aria-hidden />
          </button>
        )}
      </div>
    );
  }

  if (field.type === 'list') {
    const canManageListItems = canEditStructure || field.allow_item_management_in_locked === true;
    const canReorderListItems = canReorderStructure || (!simpleMode && canManageListItems);
    const listItemSortableIds = field.items.map((_, idx) => getDocumentListItemSortableId(field, idx));
    return (
      <div className="doc-field doc-field-list">
        <div className="doc-field-list-header">
          {fieldDragHandle}
          <EditableLabel
            value={field.label}
            isEditing={editingLabel === fieldLabelKey}
            onDoubleClick={() => onEditLabel(fieldLabelKey)}
            onSave={(val) => {
              onFieldLabelChange(field.id, val);
              onEditLabel(null);
            }}
            onCancel={() => onEditLabel(null)}
            className="doc-field-label"
            suffix=":"
            styleConfig={field.style}
          />
          {allowStyleEditing && (
            <DocumentNodeStyleControl
              value={field.style}
              onChange={(style) => onFieldStyleChange(field.id, style)}
              title={t('documentTemplateEditor.styleFieldTitle')}
            />
          )}
          {field.block_layout && !simpleMode && (
            <label className="doc-list-prefix-editor">
              <span>{t('documentTemplateEditor.itemNumberPrefix')}</span>
              <input
                type="text"
                value={field.item_label_prefix ?? ''}
                placeholder={t('documentTemplateEditor.itemNumberPrefixPlaceholder')}
                onChange={(event) => onListItemPrefixChange(field.id, event.target.value)}
              />
            </label>
          )}
          {canEditStructure && !simpleMode && (
            <button
              type="button"
              className="doc-remove-btn doc-remove-structural"
              onClick={() => onRemoveField(sectionId, field.id)}
              title={t('documentTemplateEditor.removeField')}
              aria-label={t('documentTemplateEditor.removeField')}>
              <Trash2 className="doc-action-icon" aria-hidden />
            </button>
          )}
        </div>
        <DndContext
          sensors={dragSensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => {
            const indexes = getSortableIndexes(listItemSortableIds, event);
            if (indexes) onReorderListItems(field.id, indexes.oldIndex, indexes.newIndex);
          }}>
          <SortableContext items={listItemSortableIds} strategy={verticalListSortingStrategy}>
            <ul className="doc-list-items">
              {field.items.map((item, idx) => {
                const itemKey = item.table_field || `${field.id}_${idx}`;
                const itemVal = values[itemKey] ?? item.value ?? '';
                const itemNumber = field.block_layout
                  ? (item.number ?? `${field.item_label_prefix ?? ''}${idx + 1}`)
                  : '';
                const subItemSortableIds = (item.sub_items ?? []).map((_, subIdx) =>
                  getDocumentSubItemSortableId(field, idx, subIdx),
                );
                return (
                  <SortableDocumentNode
                    key={itemKey}
                    id={listItemSortableIds[idx]}
                    tag="li"
                    disabled={!canReorderListItems || field.items.length <= 1}
                    dragTitle={t('documentTemplateEditor.reorderItem')}
                    className="doc-list-item">
                    {(itemDragHandle) => (
                      <>
                        <div className="doc-list-item-row">
                          {itemDragHandle}
                          {field.block_layout && (
                            <input
                              className="doc-list-item-number"
                              type="text"
                              value={itemNumber}
                              aria-label={t('documentTemplateEditor.itemNumberLabel')}
                              onChange={(event) => onListItemNumberChange(field.id, idx, event.target.value)}
                            />
                          )}
                          {(!simpleMode || item.label.trim()) && (
                            <>
                              <EditableLabel
                                value={item.label}
                                isEditing={editingLabel === `item:${field.id}:${idx}`}
                                onDoubleClick={() => onEditLabel(`item:${field.id}:${idx}`)}
                                onSave={(val) => {
                                  onListItemLabelChange(field.id, idx, val);
                                  onEditLabel(null);
                                }}
                                onCancel={() => onEditLabel(null)}
                                className="doc-list-item-label"
                                suffix=":"
                                styleConfig={item.style}
                              />
                              {allowStyleEditing && (
                                <DocumentNodeStyleControl
                                  value={item.style}
                                  onChange={(style) => onListItemStyleChange(field.id, idx, style)}
                                  title={t('documentTemplateEditor.styleItemTitle')}
                                />
                              )}
                            </>
                          )}
                          {shouldUseMultilineDocumentValueEditor(itemVal) ? (
                            <textarea
                              className="doc-field-textarea"
                              value={itemVal}
                              rows={2}
                              onChange={(e) => onValueChange(itemKey, e.target.value)}
                              style={getEditorReactStyle(item.style ?? field.style)}
                            />
                          ) : (
                            <input
                              type="text"
                              className="doc-field-input"
                              value={itemVal}
                              onChange={(e) => onValueChange(itemKey, e.target.value)}
                              style={getEditorReactStyle(item.style ?? field.style)}
                            />
                          )}
                          {item.suffix && <span className="doc-field-suffix">{item.suffix}</span>}
                          {canManageListItems && (
                            <button
                              type="button"
                              className="doc-remove-btn"
                              onClick={() => onRemoveListItem(field.id, idx)}
                              title={t('documentTemplateEditor.removeItem')}
                              aria-label={t('documentTemplateEditor.removeItem')}>
                              <Trash2 className="doc-action-icon" aria-hidden />
                            </button>
                          )}
                        </div>
                        {/* Sub-items */}
                        {item.sub_items && item.sub_items.length > 0 && (
                          <DndContext
                            sensors={dragSensors}
                            collisionDetection={closestCenter}
                            onDragEnd={(event) => {
                              const indexes = getSortableIndexes(subItemSortableIds, event);
                              if (indexes) onReorderSubItems(field.id, idx, indexes.oldIndex, indexes.newIndex);
                            }}>
                            <SortableContext items={subItemSortableIds} strategy={verticalListSortingStrategy}>
                              <ul className="doc-sub-items">
                                {item.sub_items.map((sub, subIdx) => {
                                  const subKey = sub.table_field || `${field.id}_${idx}_sub_${subIdx}`;
                                  const subVal = values[subKey] ?? sub.value ?? '';
                                  return (
                                    <SortableDocumentNode
                                      key={subKey}
                                      id={subItemSortableIds[subIdx]}
                                      tag="li"
                                      disabled={!canReorderListItems || (item.sub_items?.length ?? 0) <= 1}
                                      dragTitle={t('documentTemplateEditor.reorderSubItem')}
                                      className="doc-sub-item">
                                      {(subItemDragHandle) => (
                                        <>
                                          {subItemDragHandle}
                                          {allowStyleEditing && (
                                            <DocumentNodeStyleControl
                                              value={sub.style}
                                              onChange={(style) => onSubItemStyleChange(field.id, idx, subIdx, style)}
                                              title={t('documentTemplateEditor.styleSubItemTitle')}
                                            />
                                          )}
                                          {shouldUseMultilineDocumentValueEditor(subVal) ? (
                                            <textarea
                                              className="doc-field-textarea"
                                              value={subVal}
                                              rows={1}
                                              placeholder={t('documentTemplateEditor.subItemPlaceholder')}
                                              onChange={(e) => onValueChange(subKey, e.target.value)}
                                              style={getEditorReactStyle(sub.style ?? item.style ?? field.style)}
                                            />
                                          ) : (
                                            <input
                                              type="text"
                                              className="doc-field-input"
                                              value={subVal}
                                              placeholder={t('documentTemplateEditor.subItemPlaceholder')}
                                              onChange={(e) => onValueChange(subKey, e.target.value)}
                                              style={getEditorReactStyle(sub.style ?? item.style ?? field.style)}
                                            />
                                          )}
                                          {canManageListItems && (
                                            <button
                                              type="button"
                                              className="doc-remove-btn"
                                              onClick={() => onRemoveSubItem(field.id, idx, subIdx)}
                                              title={t('documentTemplateEditor.removeSubItem')}
                                              aria-label={t('documentTemplateEditor.removeSubItem')}>
                                              <Trash2 className="doc-action-icon" aria-hidden />
                                            </button>
                                          )}
                                        </>
                                      )}
                                    </SortableDocumentNode>
                                  );
                                })}
                              </ul>
                            </SortableContext>
                          </DndContext>
                        )}
                        {canManageListItems && (
                          <button
                            type="button"
                            className="doc-add-btn doc-add-btn-xs"
                            onClick={() => onAddSubItem(field.id, idx)}
                            title={t('documentTemplateEditor.addSubItem')}>
                            + {t('documentTemplateEditor.addSubItem')}
                          </button>
                        )}
                      </>
                    )}
                  </SortableDocumentNode>
                );
              })}
            </ul>
          </SortableContext>
        </DndContext>
        {canManageListItems && (
          <button
            type="button"
            className="doc-add-btn doc-add-btn-sm"
            onClick={() => onAddListItem(field.id)}
            title={t('documentTemplateEditor.addItem')}>
            + {t('documentTemplateEditor.addItem')}
          </button>
        )}
      </div>
    );
  }

  if (field.type === 'multi_reference_list') {
    const key = getDocumentFieldValueKey(field);
    const val = values[key] ?? field.value ?? '';
    const selectedItems = parseDocumentMultiReferenceListValue(val);
    const isReadOnly = field.is_read_only ?? false;
    const renderedItems = selectedItems.map((item, index) => {
      const itemLabel = field.item_label_prefix ? `${field.item_label_prefix}${index + 1}: ` : '';
      const dashPrefix = field.show_dash_prefix === false ? '' : '- ';
      return `${dashPrefix}${itemLabel}${formatDocumentMultiReferenceListItem(field, item)}`;
    });

    if (isEditing && !isReadOnly) {
      return (
        <div className="doc-field doc-field-list">
          <div className="doc-field-list-header">
            {fieldDragHandle}
            <EditableLabel
              value={field.label}
              isEditing={editingLabel === fieldLabelKey}
              onDoubleClick={() => onEditLabel(fieldLabelKey)}
              onSave={(nextLabel) => {
                onFieldLabelChange(field.id, nextLabel);
                onEditLabel(null);
              }}
              onCancel={() => onEditLabel(null)}
              className="doc-field-label"
              suffix=":"
              styleConfig={field.style}
            />
            {allowStyleEditing && (
              <DocumentNodeStyleControl
                value={field.style}
                onChange={(style) => onFieldStyleChange(field.id, style)}
                title={t('documentTemplateEditor.styleFieldTitle')}
              />
            )}
            {canEditStructure && !simpleMode && (
              <button
                type="button"
                className="doc-remove-btn doc-remove-structural"
                onClick={() => onRemoveField(sectionId, field.id)}
                title={t('documentTemplateEditor.removeField')}
                aria-label={t('documentTemplateEditor.removeField')}>
                <Trash2 className="doc-action-icon" aria-hidden />
              </button>
            )}
          </div>
          <MultiReferenceListEditor field={field} value={val} onChange={(nextValue) => onValueChange(key, nextValue)} />
        </div>
      );
    }

    const hasValue = renderedItems.length > 0;
    const displayItems = hasValue
      ? renderedItems
      : [field.empty_text || t('documentTemplateEditor.emptyValuePlaceholder')];

    return (
      <div className={`doc-field ${!isReadOnly ? 'doc-field-editable' : ''}`}>
        {fieldDragHandle}
        <EditableLabel
          value={field.label}
          isEditing={editingLabel === fieldLabelKey}
          onDoubleClick={() => onEditLabel(fieldLabelKey)}
          onSave={(nextLabel) => {
            onFieldLabelChange(field.id, nextLabel);
            onEditLabel(null);
          }}
          onCancel={() => onEditLabel(null)}
          className="doc-field-label"
          suffix=":"
          styleConfig={field.style}
        />
        {allowStyleEditing && (
          <DocumentNodeStyleControl
            value={field.style}
            onChange={(style) => onFieldStyleChange(field.id, style)}
            title={t('documentTemplateEditor.styleFieldTitle')}
          />
        )}
        {!isReadOnly ? (
          <button
            type="button"
            className={`doc-field-value doc-field-value-button ${!hasValue ? 'doc-field-empty' : ''}`}
            onClick={onEdit}
            style={getEditorReactStyle(field.style)}>
            <span>
              {displayItems.map((item, index) => (
                <span key={`${item}-${index}`}>
                  {index > 0 && <br />}
                  {item}
                </span>
              ))}
            </span>
            <Pencil className="doc-field-edit-icon" aria-hidden />
          </button>
        ) : (
          <span
            className={`doc-field-value ${!hasValue ? 'doc-field-empty' : ''}`}
            style={getEditorReactStyle(field.style)}>
            {displayItems.map((item, index) => (
              <span key={`${item}-${index}`}>
                {index > 0 && <br />}
                {item}
              </span>
            ))}
          </span>
        )}
        {canEditStructure && (
          <button
            type="button"
            className="doc-remove-btn"
            onClick={(event) => {
              event.stopPropagation();
              onRemoveField(sectionId, field.id);
            }}
            title={t('documentTemplateEditor.removeField')}
            aria-label={t('documentTemplateEditor.removeField')}>
            <Trash2 className="doc-action-icon" aria-hidden />
          </button>
        )}
      </div>
    );
  }

  if (field.type === 'computed') {
    const total = resolveDocumentFieldValue(field, values);

    return (
      <div className="doc-field doc-field-computed">
        {fieldDragHandle}
        <EditableLabel
          value={field.label}
          isEditing={editingLabel === fieldLabelKey}
          onDoubleClick={() => onEditLabel(fieldLabelKey)}
          onSave={(val) => {
            onFieldLabelChange(field.id, val);
            onEditLabel(null);
          }}
          onCancel={() => onEditLabel(null)}
          className="doc-field-label"
          suffix=":"
          styleConfig={field.style}
        />
        {allowStyleEditing && (
          <DocumentNodeStyleControl
            value={field.style}
            onChange={(style) => onFieldStyleChange(field.id, style)}
            title={t('documentTemplateEditor.styleFieldTitle')}
          />
        )}
        <span className="doc-field-value doc-field-value-computed" style={getEditorReactStyle(field.style)}>
          {total || 0}
          {field.suffix ?? ''}
        </span>
        {canEditStructure && (
          <button
            type="button"
            className="doc-remove-btn doc-remove-structural"
            onClick={() => onRemoveField(sectionId, field.id)}
            title={t('documentTemplateEditor.removeField')}
            aria-label={t('documentTemplateEditor.removeField')}>
            <Trash2 className="doc-action-icon" aria-hidden />
          </button>
        )}
      </div>
    );
  }

  // text, number, reference
  const key = getDocumentFieldValueKey(field);
  const val = values[key] ?? (field.table_field ? values[field.table_field] : undefined) ?? field.value ?? '';
  const isReadOnly = field.is_read_only ?? false;
  const labelSuffix = getDocumentFieldLabelSuffix(field);
  const isStackedField = field.layout === 'stacked';
  const canUseReferenceLookup =
    field.type === 'reference' && Boolean(field.reference_table && getReferenceLookupValueField(field));
  const referenceValueField = field.type === 'reference' ? getReferenceLookupValueField(field) : '';
  const referenceLabelField = field.type === 'reference' ? getReferenceLookupLabelField(field) : undefined;

  if (isFormTableLayout) {
    return (
      <div className="doc-field doc-field-form-row">
        <div className="doc-form-label-cell">
          {fieldDragHandle}
          <EditableLabel
            value={field.label}
            isEditing={editingLabel === fieldLabelKey}
            onDoubleClick={() => onEditLabel(fieldLabelKey)}
            onSave={(nextLabel) => {
              onFieldLabelChange(field.id, nextLabel);
              onEditLabel(null);
            }}
            onCancel={() => onEditLabel(null)}
            className="doc-field-label doc-form-label-text"
            suffix={getDocumentFieldLabelSuffix(field, '')}
            styleConfig={field.style}
          />
        </div>
        <div className="doc-form-value-cell">
          <div className="doc-form-value-main">
            {isReadOnly ? (
              <div className="doc-form-readonly" style={getEditorReactStyle(field.style)}>
                {val || ' '}
              </div>
            ) : canUseReferenceLookup && field.type === 'reference' ? (
              <div className="doc-reference-editor doc-reference-editor-form">
                <SearchableSelect
                  inlineSearchTrigger
                  persistSearchText
                  fetchOnOpen
                  clearOnEmptySearch={false}
                  minSearchLength={0}
                  value={val || undefined}
                  onValueChange={(nextValue) => onValueChange(key, nextValue)}
                  apiFunction={(params) =>
                    getTemplateTableOptionsAPI({
                      table: field.reference_table,
                      field_name: referenceValueField,
                      label_field: referenceLabelField,
                      sort_order: 'asc',
                      search: typeof params.search === 'string' ? params.search : undefined,
                      page: typeof params.page === 'number' ? params.page : 1,
                      page_size: typeof params.page_size === 'number' ? params.page_size : 20,
                    })
                  }
                  loadByIdFunction={async (selectedValue) => {
                    const fetched = await getTemplateTableOptionsAPI({
                      table: field.reference_table,
                      field_name: referenceValueField,
                      label_field: referenceLabelField,
                      sort_order: 'asc',
                      search: selectedValue,
                      page: 1,
                      page_size: 20,
                    });
                    const matchedOption =
                      fetched.find((option) => option.value === selectedValue) ??
                      fetched.find((option) => option.label === selectedValue);

                    return matchedOption ?? (selectedValue ? { value: selectedValue, label: selectedValue } : null);
                  }}
                  placeholder={t('documentTemplateEditor.referenceSelectPlaceholder')}
                  searchPlaceholder={t('documentTemplateEditor.referenceSearchPlaceholder')}
                  emptyMessage={t('documentTemplateEditor.referenceEmpty')}
                  className="doc-reference-select"
                  triggerClassName="doc-reference-select-trigger"
                  contentClassName="z-[70]"
                  apiPageSize={20}
                  clearable
                />
                {field.allow_manual_entry !== false && (
                  <input
                    type="text"
                    className="doc-field-input doc-reference-manual-input doc-field-line doc-form-input"
                    value={val}
                    onBlur={onBlur}
                    onChange={(e) => onValueChange(key, e.target.value)}
                    placeholder={t('documentTemplateEditor.manualReferencePlaceholder')}
                    style={getEditorReactStyle(field.style)}
                  />
                )}
              </div>
            ) : field.type === 'text' && shouldUseMultilineTextField(field, val) ? (
              <textarea
                className="doc-field-textarea doc-field-line doc-form-input"
                value={val}
                rows={Math.max(2, field.rows ?? 4)}
                onBlur={onBlur}
                onChange={(e) => onValueChange(key, e.target.value)}
                style={getEditorReactStyle(field.style)}
              />
            ) : (
              <input
                type={field.type === 'number' ? 'number' : 'text'}
                className="doc-field-input doc-field-line doc-form-input"
                value={val}
                onBlur={onBlur}
                onChange={(e) => onValueChange(key, e.target.value)}
                style={getEditorReactStyle(field.style)}
              />
            )}
          </div>
          {(allowStyleEditing || canEditStructure) && (
            <div className="doc-form-value-actions">
              {allowStyleEditing && (
                <DocumentNodeStyleControl
                  value={field.style}
                  onChange={(style) => onFieldStyleChange(field.id, style)}
                  title={t('documentTemplateEditor.styleFieldTitle')}
                />
              )}
              {canEditStructure && (
                <button
                  type="button"
                  className="doc-remove-btn doc-remove-structural"
                  onClick={() => onRemoveField(sectionId, field.id)}
                  title={t('documentTemplateEditor.removeField')}
                  aria-label={t('documentTemplateEditor.removeField')}>
                  <Trash2 className="doc-action-icon" aria-hidden />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isEditing && !isReadOnly) {
    return (
      <div className={`doc-field${isStackedField ? ' doc-field-stacked' : ''}`}>
        {fieldDragHandle}
        <EditableLabel
          value={field.label}
          isEditing={editingLabel === fieldLabelKey}
          onDoubleClick={() => onEditLabel(fieldLabelKey)}
          onSave={(val) => {
            onFieldLabelChange(field.id, val);
            onEditLabel(null);
          }}
          onCancel={() => onEditLabel(null)}
          className="doc-field-label"
          suffix={labelSuffix}
          styleConfig={field.style}
        />
        {allowStyleEditing && (
          <DocumentNodeStyleControl
            value={field.style}
            onChange={(style) => onFieldStyleChange(field.id, style)}
            title={t('documentTemplateEditor.styleFieldTitle')}
          />
        )}
        <div className={isStackedField ? 'doc-field-stack-body' : undefined}>
          {canUseReferenceLookup && field.type === 'reference' ? (
            <div className="doc-reference-editor">
              <SearchableSelect
                inlineSearchTrigger
                persistSearchText
                fetchOnOpen
                clearOnEmptySearch={false}
                minSearchLength={0}
                value={val || undefined}
                onValueChange={(nextValue) => onValueChange(key, nextValue)}
                apiFunction={(params) =>
                  getTemplateTableOptionsAPI({
                    table: field.reference_table,
                    field_name: referenceValueField,
                    label_field: referenceLabelField,
                    sort_order: 'asc',
                    search: typeof params.search === 'string' ? params.search : undefined,
                    page: typeof params.page === 'number' ? params.page : 1,
                    page_size: typeof params.page_size === 'number' ? params.page_size : 20,
                  })
                }
                loadByIdFunction={async (selectedValue) => {
                  const fetched = await getTemplateTableOptionsAPI({
                    table: field.reference_table,
                    field_name: referenceValueField,
                    label_field: referenceLabelField,
                    sort_order: 'asc',
                    search: selectedValue,
                    page: 1,
                    page_size: 20,
                  });
                  const matchedOption =
                    fetched.find((option) => option.value === selectedValue) ??
                    fetched.find((option) => option.label === selectedValue);

                  return matchedOption ?? (selectedValue ? { value: selectedValue, label: selectedValue } : null);
                }}
                placeholder={t('documentTemplateEditor.referenceSelectPlaceholder')}
                searchPlaceholder={t('documentTemplateEditor.referenceSearchPlaceholder')}
                emptyMessage={t('documentTemplateEditor.referenceEmpty')}
                className="doc-reference-select"
                triggerClassName="doc-reference-select-trigger"
                contentClassName="z-[70]"
                apiPageSize={20}
                clearable
              />
              {field.allow_manual_entry !== false && (
                <input
                  type="text"
                  className={`doc-field-input doc-reference-manual-input${isStackedField ? ' doc-field-line' : ''}`}
                  value={val}
                  onBlur={onBlur}
                  onChange={(e) => onValueChange(key, e.target.value)}
                  placeholder={t('documentTemplateEditor.manualReferencePlaceholder')}
                  style={getEditorReactStyle(field.style)}
                />
              )}
            </div>
          ) : field.type === 'text' && shouldUseMultilineTextField(field, val) ? (
            <textarea
              className={`doc-field-textarea${isStackedField ? ' doc-field-line' : ''}`}
              value={val}
              rows={Math.max(2, field.rows ?? 4)}
              onBlur={onBlur}
              onChange={(e) => onValueChange(key, e.target.value)}
              style={getEditorReactStyle(field.style)}
            />
          ) : (
            <input
              type={field.type === 'number' ? 'number' : 'text'}
              className={`doc-field-input${isStackedField ? ' doc-field-line' : ''}`}
              value={val}
              onBlur={onBlur}
              onChange={(e) => onValueChange(key, e.target.value)}
              style={getEditorReactStyle(field.style)}
            />
          )}
        </div>
        {field.suffix && <span className="doc-field-suffix">{field.suffix}</span>}
        {canEditStructure && (
          <button
            type="button"
            className="doc-remove-btn"
            onMouseDown={(e) => {
              e.preventDefault();
              onRemoveField(sectionId, field.id);
            }}
            title={t('documentTemplateEditor.removeField')}
            aria-label={t('documentTemplateEditor.removeField')}>
            <Trash2 className="doc-action-icon" aria-hidden />
          </button>
        )}
      </div>
    );
  }

  const displayValue = val
    ? `${field.prefix ?? ''}${val}${field.suffix ?? ''}`
    : isReadOnly
      ? field.empty_text || '—'
      : t('documentTemplateEditor.emptyValuePlaceholder');

  return (
    <div
      className={`doc-field ${!isReadOnly ? 'doc-field-editable' : ''}${isStackedField ? ' doc-field-stacked' : ''}`}>
      {fieldDragHandle}
      <EditableLabel
        value={field.label}
        isEditing={editingLabel === fieldLabelKey}
        onDoubleClick={() => onEditLabel(fieldLabelKey)}
        onSave={(val) => {
          onFieldLabelChange(field.id, val);
          onEditLabel(null);
        }}
        onCancel={() => onEditLabel(null)}
        className="doc-field-label"
        suffix={labelSuffix}
        styleConfig={field.style}
      />
      {allowStyleEditing && (
        <DocumentNodeStyleControl
          value={field.style}
          onChange={(style) => onFieldStyleChange(field.id, style)}
          title={t('documentTemplateEditor.styleFieldTitle')}
        />
      )}
      {!isReadOnly ? (
        <button
          type="button"
          className={`doc-field-value doc-field-value-button ${!val ? 'doc-field-empty' : ''}${isStackedField ? ' doc-field-line doc-field-stack-body' : ''}`}
          onClick={onEdit}
          style={getEditorReactStyle(field.style)}>
          <span>{displayValue}</span>
          <Pencil className="doc-field-edit-icon" aria-hidden />
        </button>
      ) : (
        <span
          className={`doc-field-value ${!val ? 'doc-field-empty' : ''}${isStackedField ? ' doc-field-line doc-field-stack-body' : ''}`}
          style={getEditorReactStyle(field.style)}>
          {displayValue}
        </span>
      )}
      {canEditStructure && (
        <button
          type="button"
          className="doc-remove-btn"
          onClick={(e) => {
            e.stopPropagation();
            onRemoveField(sectionId, field.id);
          }}
          title={t('documentTemplateEditor.removeField')}
          aria-label={t('documentTemplateEditor.removeField')}>
          <Trash2 className="doc-action-icon" aria-hidden />
        </button>
      )}
    </div>
  );
}

// ─── Helpers ───

function findCheckboxField(
  sections: DocumentSection[],
  fieldId: string,
): Extract<DocumentField, { type: 'checkbox' }> | null {
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.type === 'checkbox' && field.id === fieldId) {
        return field;
      }
    }

    if (section.children) {
      const childField = findCheckboxField(section.children, fieldId);
      if (childField) return childField;
    }
  }

  return null;
}

function buildCheckboxValueUpdates(
  sections: DocumentSection[],
  checkbox_results: Record<string, string[]>,
): Record<string, string> {
  const updates: Record<string, string> = {};

  Object.entries(checkbox_results).forEach(([fieldId, selectedValues]) => {
    const field = findCheckboxField(sections, fieldId);
    if (!field) return;

    updates[getDocumentFieldValueKey(field)] = serializeDocumentCheckboxValue(selectedValues);
  });

  return updates;
}

function updateCheckboxes(sections: DocumentSection[], checkbox_results: Record<string, string[]>) {
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.type === 'checkbox' && checkbox_results[field.id]) {
        const checkedValues = checkbox_results[field.id];
        for (const opt of field.options) {
          opt.checked = checkedValues.includes(getDocumentCheckboxOptionValue(opt));
        }
      }
    }
    if (section.children) {
      updateCheckboxes(section.children, checkbox_results);
    }
  }
}

function toggleCheckbox(sections: DocumentSection[], fieldId: string, optionIdx: number) {
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.type === 'checkbox' && field.id === fieldId) {
        const opt = field.options[optionIdx];
        if (opt) {
          const nextChecked = !opt.checked;
          if (field.exclusive) {
            field.options.forEach((option, index) => {
              option.checked = index === optionIdx ? nextChecked : false;
            });
          } else {
            opt.checked = nextChecked;
          }
        }
        return;
      }
    }
    if (section.children) {
      toggleCheckbox(section.children, fieldId, optionIdx);
    }
  }
}

function buildCheckboxOptionMatchValue(label: string, existingValues: Set<string>): string {
  const base =
    label
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'option';

  let candidate = base;
  let suffix = 2;

  while (existingValues.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function addCheckboxOption(sections: DocumentSection[], fieldId: string, label: string) {
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.type === 'checkbox' && field.id === fieldId) {
        const normalizedLabel = label.trim();
        if (!normalizedLabel) return;

        const existingValues = new Set(field.options.map(getDocumentCheckboxOptionValue));
        field.options.push({
          label: normalizedLabel,
          match_value: buildCheckboxOptionMatchValue(normalizedLabel, existingValues),
          checked: false,
        });
        return;
      }
    }
    if (section.children) {
      addCheckboxOption(section.children, fieldId, label);
    }
  }
}

function removeCheckboxOption(sections: DocumentSection[], fieldId: string, optionIdx: number) {
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.type === 'checkbox' && field.id === fieldId) {
        field.options.splice(optionIdx, 1);
        return;
      }
    }
    if (section.children) {
      removeCheckboxOption(section.children, fieldId, optionIdx);
    }
  }
}

function reorderCheckboxOptions(sections: DocumentSection[], fieldId: string, oldIndex: number, newIndex: number) {
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.type === 'checkbox' && field.id === fieldId) {
        field.options = arrayMove(field.options, oldIndex, newIndex);
        return;
      }
    }
    if (section.children) {
      reorderCheckboxOptions(section.children, fieldId, oldIndex, newIndex);
    }
  }
}

function addFieldToSection(sections: DocumentSection[], sectionId: string, fieldType?: string) {
  for (const section of sections) {
    if (section.id === sectionId) {
      const type = fieldType ?? 'text';
      const baseField = {
        id: `${sectionId}_field_${Date.now()}`,
        label: '',
      };

      let newField: DocumentField;
      switch (type) {
        case 'nested_list':
          newField = {
            ...baseField,
            label: 'Danh sách có ý con',
            type: 'list',
            allow_item_management_in_locked: true,
            items: [
              {
                label: 'Mục 1',
                value: '',
                sub_items: [{ label: '', value: '' }],
              },
            ],
          };
          break;
        case 'list':
          newField = {
            ...baseField,
            label: 'Danh sách',
            type: 'list',
            items: [{ label: 'Mục 1', value: '' }],
          };
          break;
        case 'checkbox':
          newField = {
            ...baseField,
            type: 'checkbox',
            options: [
              {
                label: 'Lựa chọn 1',
                match_value: 'Lựa chọn 1',
                checked: false,
              },
            ],
          };
          break;
        case 'computed':
          newField = {
            ...baseField,
            type: 'computed',
            computed_type: 'sum',
            computed_from: [],
          };
          break;
        case 'reference':
          newField = {
            ...baseField,
            type: 'reference',
            reference_table: '',
            reference_field: '',
          };
          break;
        default:
          newField = {
            ...baseField,
            type: type as 'text' | 'number',
            value: '',
          };
          break;
      }

      section.fields.push(newField);
      return;
    }
    if (section.children) {
      addFieldToSection(section.children, sectionId, fieldType);
    }
  }
}

function addListItem(sections: DocumentSection[], fieldId: string) {
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.type === 'list' && field.id === fieldId) {
        field.items.push({ label: field.block_layout ? '' : 'Mục mới', value: '' });
        return;
      }
    }
    if (section.children) {
      addListItem(section.children, fieldId);
    }
  }
}

function removeFieldFromSection(sections: DocumentSection[], sectionId: string, fieldId: string) {
  for (const section of sections) {
    if (section.id === sectionId) {
      section.fields = section.fields.filter((f) => f.id !== fieldId);
      return;
    }
    if (section.children) {
      removeFieldFromSection(section.children, sectionId, fieldId);
    }
  }
}

function removeListItem(sections: DocumentSection[], fieldId: string, itemIdx: number) {
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.type === 'list' && field.id === fieldId) {
        field.items.splice(itemIdx, 1);
        return;
      }
    }
    if (section.children) {
      removeListItem(section.children, fieldId, itemIdx);
    }
  }
}

function buildListItemRemovalValueUpdates(
  sections: DocumentSection[],
  fieldId: string,
  itemIdx: number,
  values: Record<string, string>,
): Record<string, string> {
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.type !== 'list' || field.id !== fieldId) continue;

      const updates: Record<string, string> = {};
      const items = field.items;

      for (let idx = itemIdx; idx < items.length - 1; idx += 1) {
        const nextItem = items[idx + 1];
        const targetKey = items[idx].table_field || `${field.id}_${idx}`;
        const sourceKey = nextItem.table_field || `${field.id}_${idx + 1}`;
        updates[targetKey] = values[sourceKey] ?? nextItem.value ?? '';

        items[idx].sub_items?.forEach((subItem, subIdx) => {
          const nextSubItem = nextItem.sub_items?.[subIdx];
          const targetSubKey = subItem.table_field || `${field.id}_${idx}_sub_${subIdx}`;
          if (nextSubItem) {
            const sourceSubKey = nextSubItem.table_field || `${field.id}_${idx + 1}_sub_${subIdx}`;
            updates[targetSubKey] = values[sourceSubKey] ?? nextSubItem.value ?? '';
          } else {
            updates[targetSubKey] = '';
          }
        });
      }

      const lastIdx = items.length - 1;
      if (lastIdx >= itemIdx) {
        const lastItem = items[lastIdx];
        updates[lastItem.table_field || `${field.id}_${lastIdx}`] = '';
        lastItem.sub_items?.forEach((subItem, subIdx) => {
          updates[subItem.table_field || `${field.id}_${lastIdx}_sub_${subIdx}`] = '';
        });
      }

      return updates;
    }

    if (section.children) {
      const childUpdates = buildListItemRemovalValueUpdates(section.children, fieldId, itemIdx, values);
      if (Object.keys(childUpdates).length > 0) return childUpdates;
    }
  }

  return {};
}

function addSubItem(sections: DocumentSection[], fieldId: string, itemIdx: number) {
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.type === 'list' && field.id === fieldId) {
        const item = field.items[itemIdx];
        if (item) {
          if (!item.sub_items) item.sub_items = [];
          item.sub_items.push({ label: '', value: '' });
        }
        return;
      }
    }
    if (section.children) {
      addSubItem(section.children, fieldId, itemIdx);
    }
  }
}

function removeSubItem(sections: DocumentSection[], fieldId: string, itemIdx: number, subIdx: number) {
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.type === 'list' && field.id === fieldId) {
        const item = field.items[itemIdx];
        if (item?.sub_items) {
          item.sub_items.splice(subIdx, 1);
        }
        return;
      }
    }
    if (section.children) {
      removeSubItem(section.children, fieldId, itemIdx, subIdx);
    }
  }
}

function updateFieldLabel(sections: DocumentSection[], fieldId: string, newLabel: string) {
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.id === fieldId) {
        field.label = newLabel;
        return;
      }
    }
    if (section.children) {
      updateFieldLabel(section.children, fieldId, newLabel);
    }
  }
}

function updateListItemLabel(sections: DocumentSection[], fieldId: string, itemIdx: number, newLabel: string) {
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.type === 'list' && field.id === fieldId) {
        if (field.items[itemIdx]) {
          field.items[itemIdx].label = newLabel;
        }
        return;
      }
    }
    if (section.children) {
      updateListItemLabel(section.children, fieldId, itemIdx, newLabel);
    }
  }
}

function updateListItemPrefix(sections: DocumentSection[], fieldId: string, prefix: string) {
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.type === 'list' && field.id === fieldId) {
        field.item_label_prefix = prefix;
        return;
      }
    }
    if (section.children) {
      updateListItemPrefix(section.children, fieldId, prefix);
    }
  }
}

function updateListItemNumber(sections: DocumentSection[], fieldId: string, itemIdx: number, itemNumber: string) {
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.type === 'list' && field.id === fieldId) {
        if (field.items[itemIdx]) {
          field.items[itemIdx].number = itemNumber;
        }
        return;
      }
    }
    if (section.children) {
      updateListItemNumber(section.children, fieldId, itemIdx, itemNumber);
    }
  }
}

function updateSectionTitle(sections: DocumentSection[], sectionId: string, newTitle: string) {
  for (const section of sections) {
    if (section.id === sectionId) {
      section.title = newTitle;
      return;
    }
    if (section.children) {
      updateSectionTitle(section.children, sectionId, newTitle);
    }
  }
}

function addChildSection(sections: DocumentSection[], parentSectionId: string) {
  for (const section of sections) {
    if (section.id === parentSectionId) {
      if (!section.children) section.children = [];
      const idx = section.children.length + 1;
      // Extract parent number prefix e.g. "2" from "2.3 Sứ mạng" or "II. ..."
      const parentNumMatch = section.title.match(/^([\d]+)\b/);
      const prefix = parentNumMatch ? `${parentNumMatch[1]}.${idx}` : String(idx);
      section.children.push({
        id: `sec_${Date.now()}`,
        title: `${prefix}. Mục mới`,
        fields: [
          {
            id: `field_${Date.now()}`,
            label: '',
            type: 'text',
            value: '',
          },
        ],
      });
      return;
    }
    if (section.children) {
      addChildSection(section.children, parentSectionId);
    }
  }
}

function removeChildSection(sections: DocumentSection[], parentSectionId: string, childSectionId: string) {
  for (const section of sections) {
    if (section.id === parentSectionId && section.children) {
      section.children = section.children.filter((c) => c.id !== childSectionId);
      return;
    }
    if (section.children) {
      removeChildSection(section.children, parentSectionId, childSectionId);
    }
  }
}

function reorderChildSections(
  sections: DocumentSection[],
  parentSectionId: string,
  oldIndex: number,
  newIndex: number,
) {
  for (const section of sections) {
    if (section.id === parentSectionId && section.children) {
      section.children = arrayMove(section.children, oldIndex, newIndex);
      return;
    }
    if (section.children) {
      reorderChildSections(section.children, parentSectionId, oldIndex, newIndex);
    }
  }
}

function reorderFieldsInSection(sections: DocumentSection[], sectionId: string, oldIndex: number, newIndex: number) {
  for (const section of sections) {
    if (section.id === sectionId) {
      section.fields = arrayMove(section.fields, oldIndex, newIndex);
      return;
    }
    if (section.children) {
      reorderFieldsInSection(section.children, sectionId, oldIndex, newIndex);
    }
  }
}

function reorderListItems(sections: DocumentSection[], fieldId: string, oldIndex: number, newIndex: number) {
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.type === 'list' && field.id === fieldId) {
        field.items = arrayMove(field.items, oldIndex, newIndex);
        return;
      }
    }
    if (section.children) {
      reorderListItems(section.children, fieldId, oldIndex, newIndex);
    }
  }
}

function reorderSubItems(
  sections: DocumentSection[],
  fieldId: string,
  itemIdx: number,
  oldIndex: number,
  newIndex: number,
) {
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.type === 'list' && field.id === fieldId) {
        const item = field.items[itemIdx];
        if (item?.sub_items) {
          item.sub_items = arrayMove(item.sub_items, oldIndex, newIndex);
        }
        return;
      }
    }
    if (section.children) {
      reorderSubItems(section.children, fieldId, itemIdx, oldIndex, newIndex);
    }
  }
}

function buildListItemReorderValueUpdates(
  sections: DocumentSection[],
  fieldId: string,
  oldIndex: number,
  newIndex: number,
  values: Record<string, string>,
): Record<string, string> {
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.type !== 'list' || field.id !== fieldId) continue;

      const updates: Record<string, string> = {};
      const reorderedItems = arrayMove(field.items, oldIndex, newIndex);

      reorderedItems.forEach((item, targetIdx) => {
        const sourceIdx = field.items.indexOf(item);
        const targetKey = item.table_field || `${field.id}_${targetIdx}`;
        const sourceKey = item.table_field || `${field.id}_${sourceIdx}`;
        updates[targetKey] = values[sourceKey] ?? item.value ?? '';

        item.sub_items?.forEach((subItem, subIdx) => {
          const targetSubKey = subItem.table_field || `${field.id}_${targetIdx}_sub_${subIdx}`;
          const sourceSubKey = subItem.table_field || `${field.id}_${sourceIdx}_sub_${subIdx}`;
          updates[targetSubKey] = values[sourceSubKey] ?? subItem.value ?? '';
        });
      });

      return updates;
    }

    if (section.children) {
      const childUpdates = buildListItemReorderValueUpdates(section.children, fieldId, oldIndex, newIndex, values);
      if (Object.keys(childUpdates).length > 0) return childUpdates;
    }
  }

  return {};
}

function buildSubItemReorderValueUpdates(
  sections: DocumentSection[],
  fieldId: string,
  itemIdx: number,
  oldIndex: number,
  newIndex: number,
  values: Record<string, string>,
): Record<string, string> {
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.type !== 'list' || field.id !== fieldId) continue;

      const item = field.items[itemIdx];
      if (!item?.sub_items) return {};

      const updates: Record<string, string> = {};
      const reorderedSubItems = arrayMove(item.sub_items, oldIndex, newIndex);

      reorderedSubItems.forEach((subItem, targetIdx) => {
        const sourceIdx = item.sub_items?.indexOf(subItem) ?? targetIdx;
        const targetKey = subItem.table_field || `${field.id}_${itemIdx}_sub_${targetIdx}`;
        const sourceKey = subItem.table_field || `${field.id}_${itemIdx}_sub_${sourceIdx}`;
        updates[targetKey] = values[sourceKey] ?? subItem.value ?? '';
      });

      return updates;
    }

    if (section.children) {
      const childUpdates = buildSubItemReorderValueUpdates(
        section.children,
        fieldId,
        itemIdx,
        oldIndex,
        newIndex,
        values,
      );
      if (Object.keys(childUpdates).length > 0) return childUpdates;
    }
  }

  return {};
}

function updateSectionStyle(sections: DocumentSection[], sectionId: string, style: TEditorTextStyle | undefined) {
  for (const section of sections) {
    if (section.id === sectionId) {
      section.style = style;
      return;
    }
    if (section.children) {
      updateSectionStyle(section.children, sectionId, style);
    }
  }
}

function updateFieldStyle(sections: DocumentSection[], fieldId: string, style: TEditorTextStyle | undefined) {
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.id === fieldId) {
        field.style = style;
        return;
      }
    }
    if (section.children) {
      updateFieldStyle(section.children, fieldId, style);
    }
  }
}

function updateListItemStyle(
  sections: DocumentSection[],
  fieldId: string,
  itemIdx: number,
  style: TEditorTextStyle | undefined,
) {
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.type === 'list' && field.id === fieldId) {
        const item = field.items[itemIdx];
        if (item) {
          item.style = style;
        }
        return;
      }
    }
    if (section.children) {
      updateListItemStyle(section.children, fieldId, itemIdx, style);
    }
  }
}

function updateSubItemStyle(
  sections: DocumentSection[],
  fieldId: string,
  itemIdx: number,
  subIdx: number,
  style: TEditorTextStyle | undefined,
) {
  for (const section of sections) {
    for (const field of section.fields) {
      if (field.type === 'list' && field.id === fieldId) {
        const subItem = field.items[itemIdx]?.sub_items?.[subIdx];
        if (subItem) {
          subItem.style = style;
        }
        return;
      }
    }
    if (section.children) {
      updateSubItemStyle(section.children, fieldId, itemIdx, subIdx, style);
    }
  }
}

function DocumentNodeStyleControl({
  value,
  title,
  onChange,
}: {
  value?: TEditorTextStyle;
  title: string;
  onChange: (style: TEditorTextStyle | undefined) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const patch = (patchValue: TEditorTextStyle) => onChange(patchStyle(value, patchValue));
  const booleanValue = (key: 'bold' | 'italic' | 'underline') =>
    typeof value?.[key] === 'boolean' ? String(value[key]) : '';

  return (
    <span className="doc-node-style-control" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className={`doc-style-btn ${open ? 'doc-style-btn-active' : ''}`}
        onClick={() => setOpen((current) => !current)}
        title={title}
        aria-label={title}>
        Aa
      </button>
      {open && (
        <span className="doc-style-panel">
          <span className="doc-style-panel-title">{title}</span>
          <label className="doc-style-control-field">
            <span>{t('variables.management.settings.editorFontFamily')}</span>
            <select value={value?.font_family ?? ''} onChange={(event) => patch({ font_family: event.target.value })}>
              <option value="">{t('documentTemplateEditor.styleDefault')}</option>
              {STYLE_FONT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <span className="doc-style-grid">
            <label className="doc-style-control-field">
              <span>{t('variables.management.settings.editorFontSize')}</span>
              <select value={value?.font_size ?? ''} onChange={(event) => patch({ font_size: event.target.value })}>
                <option value="">{t('documentTemplateEditor.styleDefault')}</option>
                {STYLE_FONT_SIZE_OPTIONS.map((fontSize) => (
                  <option key={fontSize} value={fontSize}>
                    {fontSize}
                  </option>
                ))}
              </select>
            </label>
            <label className="doc-style-control-field">
              <span>{t('variables.management.settings.editorLineHeight')}</span>
              <select value={value?.line_height ?? ''} onChange={(event) => patch({ line_height: event.target.value })}>
                <option value="">{t('documentTemplateEditor.styleDefault')}</option>
                {STYLE_LINE_HEIGHT_OPTIONS.map((lineHeight) => (
                  <option key={lineHeight} value={lineHeight}>
                    {lineHeight}
                  </option>
                ))}
              </select>
            </label>
          </span>
          <label className="doc-style-control-field">
            <span>{t('variables.management.form.textAlign')}</span>
            <select
              value={value?.text_align ?? ''}
              onChange={(event) => patch({ text_align: event.target.value as TEditorTextStyle['text_align'] })}>
              <option value="">{t('documentTemplateEditor.styleDefault')}</option>
              {STYLE_TEXT_ALIGN_OPTIONS.map((textAlign) => (
                <option key={textAlign} value={textAlign}>
                  {t(`variables.management.form.align${textAlign[0].toUpperCase()}${textAlign.slice(1)}`)}
                </option>
              ))}
            </select>
          </label>
          <span className="doc-style-grid">
            {(
              [
                ['bold', t('variables.management.form.bold')],
                ['italic', t('variables.management.form.italic')],
                ['underline', t('variables.management.form.underline')],
              ] as const
            ).map(([styleKey, label]) => (
              <label key={styleKey} className="doc-style-control-field">
                <span>{label}</span>
                <select
                  value={booleanValue(styleKey)}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    patch({ [styleKey]: nextValue === '' ? undefined : nextValue === 'true' } as TEditorTextStyle);
                  }}>
                  <option value="">{t('documentTemplateEditor.styleDefault')}</option>
                  <option value="true">{t('documentTemplateEditor.styleYes')}</option>
                  <option value="false">{t('documentTemplateEditor.styleNo')}</option>
                </select>
              </label>
            ))}
          </span>
          <span className="doc-style-grid">
            <label className="doc-style-control-field">
              <span>{t('variables.management.settings.editorTextColor')}</span>
              <input
                type="color"
                value={value?.color ?? '#000000'}
                onChange={(event) => patch({ color: event.target.value })}
              />
            </label>
            <label className="doc-style-control-field">
              <span>{t('documentTemplateEditor.styleBackgroundColor')}</span>
              <input
                type="color"
                value={value?.background_color ?? '#ffffff'}
                onChange={(event) => patch({ background_color: event.target.value })}
              />
            </label>
          </span>
          <button type="button" className="doc-style-reset-btn" onClick={() => onChange(undefined)}>
            {t('documentTemplateEditor.styleReset')}
          </button>
        </span>
      )}
    </span>
  );
}

// ─── Editable label component ───

function EditableLabel({
  value,
  isEditing,
  onDoubleClick,
  onSave,
  onCancel,
  disabled = false,
  className,
  suffix,
  tag: Tag = 'span',
  styleConfig,
}: {
  value: string;
  isEditing: boolean;
  onDoubleClick: () => void;
  onSave: (newValue: string) => void;
  onCancel: () => void;
  disabled?: boolean;
  className?: string;
  suffix?: string;
  tag?: 'span' | 'h5';
  styleConfig?: TEditorTextStyle;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value);
  const selectedIcon = getLabelIcon(value);

  useEffect(() => {
    if (isEditing) setDraft(value);
  }, [isEditing, value]);

  if (isEditing && !disabled) {
    return (
      <input
        className={`doc-label-edit ${className ?? ''}`}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onSave(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave(draft);
          if (e.key === 'Escape') onCancel();
        }}
        onClick={(e) => e.stopPropagation()}
        style={getEditorReactStyle(styleConfig)}
      />
    );
  }

  return (
    <Tag
      className={`${className ?? ''} ${disabled ? '' : 'doc-label-clickable'} ${!value.trim() ? 'doc-label-empty' : ''}`}
      style={getEditorReactStyle(styleConfig)}
      onDoubleClick={
        disabled
          ? undefined
          : (e) => {
              e.stopPropagation();
              onDoubleClick();
            }
      }
      title={disabled ? undefined : t('documentTemplateEditor.editLabelHint')}>
      <span className="doc-label-text">
        {value.trim() || t('documentTemplateEditor.emptyLabelPlaceholder')}
        {suffix ?? ''}
      </span>
      {!disabled && (
        <select
          className="doc-label-icon-select"
          value={selectedIcon}
          onChange={(e) =>
            onSave(applyLabelIcon(value, e.target.value, t('documentTemplateEditor.emptyLabelFallback')))
          }
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          title={t('documentTemplateEditor.iconPickerLabel')}
          aria-label={t('documentTemplateEditor.iconPickerLabel')}>
          <option value="">◇</option>
          {DOCUMENT_LABEL_ICONS.map((icon) => (
            <option key={icon} value={icon}>
              {icon}
            </option>
          ))}
        </select>
      )}
      {!disabled && <Pencil className="doc-label-edit-icon" aria-hidden />}
    </Tag>
  );
}
