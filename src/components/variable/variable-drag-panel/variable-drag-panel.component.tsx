import { memo, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Braces, Eye, FileText, GripVertical, Search, Table, X } from 'lucide-react';
import { cn } from 'reactjs-platform/utilities';
import { useTranslation } from '../../../i18n';
import { getVariablePickerPreviewHtml, type IVariablePickerItem, type TVariablePickerScope } from '../../../lib';
import { VARIABLE_DRAG_MIME } from '../../../lib/editor-config/variable-drop-handler';

interface IVariableDragPanelProps {
  items: IVariablePickerItem[];
}

const VARIABLE_SCOPE_OPTIONS: Array<{
  key: TVariablePickerScope | 'all';
  labelKey: string;
}> = [
  { key: 'all', labelKey: 'variables.picker.scopes.all' },
  { key: 'field', labelKey: 'variables.picker.scopes.field' },
  { key: 'tableTemplate', labelKey: 'variables.picker.scopes.tableTemplate' },
  { key: 'documentTemplate', labelKey: 'variables.picker.scopes.documentTemplate' },
];

const scopeIconMap: Record<TVariablePickerScope, typeof Braces> = {
  field: Braces,
  tableTemplate: Table,
  documentTemplate: FileText,
};

const scopeLabelKeyMap: Record<TVariablePickerScope, string> = {
  field: 'variables.picker.scopes.field',
  tableTemplate: 'variables.picker.scopes.tableTemplate',
  documentTemplate: 'variables.picker.scopes.documentTemplate',
};

const DragItem = memo(
  ({
    item,
    onPreview,
    onDragStartItem,
  }: {
    item: IVariablePickerItem;
    onPreview: () => void;
    onDragStartItem: () => void;
  }) => {
    const { t } = useTranslation();
    const ScopeIcon = scopeIconMap[item.scope];

    const handleDragStart = (event: React.DragEvent) => {
      // Only set the custom MIME — do NOT set text/plain, otherwise CKEditor's
      // own clipboard pipeline also inserts the token, producing a duplicate.
      event.dataTransfer.setData(VARIABLE_DRAG_MIME, item.token);
      event.dataTransfer.effectAllowed = 'copy';
      onDragStartItem();
    };

    return (
      <div
        draggable
        onDragStart={handleDragStart}
        onDoubleClick={onPreview}
        className="mb-2 flex cursor-grab items-start gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 transition-all last:mb-0 hover:border-blue-200 hover:bg-slate-50/70 active:cursor-grabbing select-none"
        title={item.token}>
        <GripVertical className="mt-0.5 size-4 shrink-0 text-slate-400" />
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
          <ScopeIcon className="size-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold leading-5 text-slate-900">{item.label}</div>
          <div className="mt-0.5 break-all font-mono text-[10px] leading-4 text-slate-400">{item.token}</div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
              {t(scopeLabelKeyMap[item.scope])}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
              {item.dataLabel}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onPreview}
          onMouseDown={(e) => e.stopPropagation()}
          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
          title={t('variables.picker.preview')}>
          <Eye className="size-3.5" />
        </button>
      </div>
    );
  },
);
DragItem.displayName = 'DragItem';

export const VariableDragPanel = memo(({ items }: IVariableDragPanelProps) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<TVariablePickerScope | 'all'>('all');
  const [previewKey, setPreviewKey] = useState<string | null>(null);

  const scopeCounts = useMemo(
    () => ({
      all: items.length,
      field: items.filter((item) => item.scope === 'field').length,
      tableTemplate: items.filter((item) => item.scope === 'tableTemplate').length,
      documentTemplate: items.filter((item) => item.scope === 'documentTemplate').length,
    }),
    [items],
  );

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter(
      (item) =>
        (scopeFilter === 'all' || item.scope === scopeFilter) &&
        (!normalizedQuery ||
          item.searchText.includes(normalizedQuery) ||
          item.token.toLowerCase().includes(normalizedQuery)),
    );
  }, [items, query, scopeFilter]);

  const groupedItems = useMemo(() => {
    return filteredItems.reduce<Record<string, IVariablePickerItem[]>>((groups, item) => {
      if (!groups[item.groupLabel]) {
        groups[item.groupLabel] = [];
      }
      groups[item.groupLabel].push(item);
      return groups;
    }, {});
  }, [filteredItems]);

  const previewItem = useMemo(() => {
    if (!previewKey) return null;
    return items.find((item) => item.key === previewKey) ?? null;
  }, [previewKey, items]);

  const previewHtml = useMemo(() => {
    return previewItem ? getVariablePickerPreviewHtml(previewItem, t) : '';
  }, [previewItem, t]);

  const showGroupHeadings = scopeFilter === 'all';

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Filters */}
      <div className="shrink-0 space-y-2 border-b border-slate-200 bg-slate-50/70 p-2">
        <div className="flex flex-wrap gap-1.5">
          {VARIABLE_SCOPE_OPTIONS.map((scopeOption) => (
            <button
              key={scopeOption.key}
              type="button"
              onClick={() => setScopeFilter(scopeOption.key)}
              className={cn(
                'h-7 rounded-md px-2.5 text-xs font-semibold transition',
                scopeFilter === scopeOption.key
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300',
              )}>
              {t(scopeOption.labelKey)}
              <span className="ml-1 opacity-70">{scopeCounts[scopeOption.key as keyof typeof scopeCounts]}</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('variables.picker.searchPlaceholder')}
            className="h-8 w-full rounded-md border border-slate-200 pl-8 pr-3 text-sm focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
          />
        </div>
        <p className="text-[11px] text-slate-400">{t('variables.picker.dragDropHint')}</p>
      </div>

      {/* List */}
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {filteredItems.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center">
            <p className="text-sm font-semibold text-slate-700">{t('variables.picker.noMatchingTitle')}</p>
          </div>
        ) : (
          Object.entries(groupedItems).map(([groupLabel, groupItems]) => (
            <div key={groupLabel} className="mb-3 last:mb-0">
              {showGroupHeadings && (
                <div className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {groupLabel}
                </div>
              )}
              {groupItems.map((item) => (
                <DragItem
                  key={item.key}
                  item={item}
                  onPreview={() => setPreviewKey(item.key)}
                  onDragStartItem={() => setPreviewKey(null)}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Preview modal (click eye) */}
      {previewItem &&
        previewHtml &&
        createPortal(
          <div
            className="fixed inset-0 z-9999 flex items-center justify-center bg-slate-900/40 p-6"
            onClick={() => setPreviewKey(null)}>
            <div
              className="flex max-h-[85vh] w-200 max-w-[92vw] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_36px_120px_rgba(15,23,42,0.32)]"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                <span className="text-sm font-semibold text-slate-900">{previewItem.label}</span>
                <span className="truncate font-mono text-[11px] text-slate-400">{previewItem.token}</span>
                <button
                  type="button"
                  onClick={() => setPreviewKey(null)}
                  className="ml-auto flex size-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                  title={t('common.actions.close')}>
                  <X className="size-4" />
                </button>
              </div>
              <div
                className="min-h-0 flex-1 overflow-auto p-3 text-sm"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
});
VariableDragPanel.displayName = 'VariableDragPanel';
