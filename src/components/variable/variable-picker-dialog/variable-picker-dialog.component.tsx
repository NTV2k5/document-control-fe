'use client';

import { Braces, Check, CheckSquare, FileText, Search, Square, Table, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  SearchableSelect,
} from 'reactjs-platform/ui';
import { cn } from 'reactjs-platform/utilities';
import { useTranslation } from '../../../i18n';
import {
  getVariablePickerItems,
  getVariablePickerPreviewHtml,
  type IVariablePickerItem,
  type TVariablePickerDataKind,
  type TVariablePickerScope,
} from '../../../lib';
import type { IVariablePickerDialogProps } from './variable-picker-dialog.type';

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

const dataKindLabelKeyMap: Record<TVariablePickerDataKind, string> = {
  text: 'variables.picker.dataKinds.text',
  number: 'variables.picker.dataKinds.number',
  reference: 'variables.picker.dataKinds.reference',
  flag: 'variables.picker.dataKinds.flag',
  table: 'variables.picker.dataKinds.table',
  document: 'variables.picker.dataKinds.document',
};

export const VariablePickerDialog = ({
  open,
  catalog,
  onOpenChange,
  onSelect,
  onSelectMany,
  onConfirmStart,
  template_type,
  title,
  description,
  confirmLabel,
  contentClassName,
  initialActiveKey = null,
  multiSelect = true,
}: IVariablePickerDialogProps) => {
  const { t } = useTranslation();
  const dialogTitle = title ?? t('variables.picker.title');
  const dialogDescription = description ?? t('variables.picker.description');
  const dialogConfirmLabel = confirmLabel ?? t('variables.picker.confirm');
  const [query, setQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<TVariablePickerScope | 'all'>('all');
  const [dataKindFilter, setDataKindFilter] = useState<TVariablePickerDataKind | ''>('');
  const [sourceTableFilter, setSourceTableFilter] = useState('');
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!open) {
      setQuery('');
      setScopeFilter('all');
      setDataKindFilter('');
      setSourceTableFilter('');
      setActiveKey(null);
      setSelectedKeys(new Set());
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setActiveKey(initialActiveKey);
  }, [initialActiveKey, open]);

  const allItems = useMemo(
    () => getVariablePickerItems('', catalog, { template_type, t }),
    [catalog, t, template_type],
  );

  const filteredItems = useMemo(() => {
    return getVariablePickerItems(query, catalog, { template_type, t }).filter(
      (item) =>
        (scopeFilter === 'all' || item.scope === scopeFilter) &&
        (!dataKindFilter || item.dataKind === dataKindFilter) &&
        (!sourceTableFilter || item.sourceTable === sourceTableFilter),
    );
  }, [catalog, dataKindFilter, query, scopeFilter, sourceTableFilter, t, template_type]);

  const itemByKey = useMemo(() => {
    return new Map(allItems.map((item) => [item.key, item]));
  }, [allItems]);

  const itemIndexByKey = useMemo(() => {
    return new Map(filteredItems.map((item, index) => [item.key, index + 1]));
  }, [filteredItems]);

  const selectedItems = useMemo(() => {
    return Array.from(selectedKeys)
      .map((key) => itemByKey.get(key))
      .filter((item): item is IVariablePickerItem => Boolean(item));
  }, [itemByKey, selectedKeys]);

  const dataKindOptions = useMemo(() => {
    const unique = new Set<TVariablePickerDataKind>();
    allItems.forEach((item) => {
      unique.add(item.dataKind);
    });

    return Array.from(unique)
      .map((value) => ({
        value,
        label: t(dataKindLabelKeyMap[value]),
      }))
      .sort((left, right) => left.label.localeCompare(right.label, 'vi', { sensitivity: 'base' }));
  }, [allItems, t]);

  const sourceTableOptions = useMemo(() => {
    const unique = new Map<string, string>();
    allItems.forEach((item) => {
      if (item.sourceTable) {
        unique.set(item.sourceTable, item.sourceTableLabel || item.sourceTable);
      }
    });

    return Array.from(unique.entries())
      .map(([value, label]) => ({
        value,
        label: `${label} (${value})`,
      }))
      .sort((left, right) => left.label.localeCompare(right.label, 'vi', { sensitivity: 'base' }));
  }, [allItems]);

  const scopeCounts = useMemo(() => {
    return {
      all: allItems.length,
      field: allItems.filter((item) => item.scope === 'field').length,
      tableTemplate: allItems.filter((item) => item.scope === 'tableTemplate').length,
      documentTemplate: allItems.filter((item) => item.scope === 'documentTemplate').length,
    };
  }, [allItems]);

  const groupedItems = useMemo(() => {
    return filteredItems.reduce<Record<string, typeof filteredItems>>((groups, item) => {
      if (!groups[item.groupLabel]) {
        groups[item.groupLabel] = [];
      }

      groups[item.groupLabel].push(item);
      return groups;
    }, {});
  }, [filteredItems]);

  const activeItem = useMemo(() => {
    if (filteredItems.length === 0) return null;

    return filteredItems.find((item) => item.key === activeKey) ?? filteredItems[0];
  }, [activeKey, filteredItems]);

  const activePreviewHtml = useMemo(() => {
    return activeItem ? getVariablePickerPreviewHtml(activeItem, t) : '';
  }, [activeItem, t]);

  const showGroupHeadings = scopeFilter === 'all';
  const itemsToInsert = multiSelect && selectedItems.length > 0 ? selectedItems : activeItem ? [activeItem] : [];
  const selectedSummary = selectedItems
    .slice(0, 3)
    .map((item) => item.label)
    .join(', ');

  useEffect(() => {
    if (!filteredItems.length) {
      setActiveKey(null);
      return;
    }

    setActiveKey((current) =>
      current && filteredItems.some((item) => item.key === current) ? current : filteredItems[0].key,
    );
  }, [filteredItems]);

  const toggleSelectedKey = (key: string) => {
    if (!multiSelect) {
      setActiveKey(key);
      return;
    }

    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSelectVisible = () => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      filteredItems.forEach((item) => {
        next.add(item.key);
      });
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedKeys(new Set());
  };

  const emitSelect = () => {
    if (itemsToInsert.length > 1 && onSelectMany) {
      onSelectMany(itemsToInsert);
      return;
    }

    itemsToInsert.forEach(onSelect);
  };

  const emitSingleSelect = (item: IVariablePickerItem) => {
    onConfirmStart?.();
    onOpenChange(false);

    if (typeof window === 'undefined') {
      onSelect(item);
      return;
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        onSelect(item);
      });
    });
  };

  const handleInsert = () => {
    if (itemsToInsert.length === 0) {
      return;
    }

    onConfirmStart?.();
    onOpenChange(false);

    if (typeof window === 'undefined') {
      emitSelect();
      return;
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        emitSelect();
      });
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'flex h-[94vh] max-h-[94vh] w-[96vw] max-w-[1780px] flex-col overflow-hidden rounded-[22px] border-0 bg-white p-0 shadow-[0_36px_120px_rgba(15,23,42,0.28)]',
          contentClassName,
        )}>
        <DialogHeader className="border-b border-slate-200 px-5 py-3">
          <DialogTitle className="text-lg font-semibold text-slate-900">{dialogTitle}</DialogTitle>
          <DialogDescription className="text-sm leading-5 text-slate-500">{dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="shrink-0 border-b border-slate-200 bg-slate-50/70 px-5 py-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {VARIABLE_SCOPE_OPTIONS.map((scopeOption) => (
                <Button
                  key={scopeOption.key}
                  type="button"
                  size="sm"
                  variant={scopeFilter === scopeOption.key ? 'default' : 'outline'}
                  onClick={() => setScopeFilter(scopeOption.key)}
                  className={cn(
                    'h-9 rounded-lg px-4 text-sm',
                    scopeFilter === scopeOption.key
                      ? 'bg-slate-900 text-white shadow-sm hover:bg-slate-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-white',
                  )}>
                  {t(scopeOption.labelKey)}
                  <span className="ml-2 text-xs opacity-80">
                    {scopeCounts[scopeOption.key as keyof typeof scopeCounts]}
                  </span>
                </Button>
              ))}
            </div>

            <div className="flex w-full flex-col gap-2 xl:max-w-4xl xl:flex-row">
              <SearchableSelect
                value={sourceTableFilter}
                options={sourceTableOptions}
                placeholder={t('variables.picker.allSourceTables')}
                searchPlaceholder={t('variables.picker.searchSourceTable')}
                emptyMessage={t('variables.picker.noSourceTable')}
                clearable
                onValueChange={setSourceTableFilter}
                className="h-10 rounded-xl border-slate-200 xl:w-72"
              />
              <SearchableSelect
                value={dataKindFilter}
                options={dataKindOptions}
                placeholder={t('variables.picker.allDataTypes')}
                searchPlaceholder={t('variables.picker.searchDataType')}
                emptyMessage={t('variables.picker.noDataType')}
                clearable
                onValueChange={(value) => setDataKindFilter(value as TVariablePickerDataKind | '')}
                className="h-10 rounded-xl border-slate-200 xl:w-60"
              />
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('variables.picker.searchPlaceholder')}
                  className="h-10 rounded-xl border-slate-200 pl-10"
                />
              </div>
            </div>
          </div>

          {multiSelect ? (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5">
              <div className="flex min-w-0 items-center gap-2 text-sm text-slate-600">
                <CheckSquare className="size-4 shrink-0 text-blue-600" />
                <span className="truncate">
                  {selectedItems.length > 0
                    ? t('variables.picker.selectedCount', { count: selectedItems.length })
                    : t('variables.picker.multiSelectHint')}
                </span>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={filteredItems.length === 0}
                  onClick={handleSelectVisible}
                  className="h-8 rounded-lg border-slate-200 bg-white px-3 text-xs">
                  <CheckSquare className="size-3.5" />
                  {t('variables.picker.selectVisible')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={selectedItems.length === 0}
                  onClick={handleClearSelection}
                  className="h-8 rounded-lg border-slate-200 bg-white px-3 text-xs">
                  <X className="size-3.5" />
                  {t('variables.picker.clearSelection')}
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(420px,0.8fr)_minmax(0,1.2fr)]">
          <Command
            shouldFilter={false}
            className="flex min-h-0 flex-col overflow-hidden rounded-none border-0 border-b border-slate-200 bg-white lg:border-b-0 lg:border-r">
            <CommandList className="h-full max-h-none min-h-0 flex-1 overflow-y-auto p-4">
              {filteredItems.length === 0 ? (
                <CommandEmpty className="flex min-h-[260px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
                  <p className="text-base font-semibold text-slate-900">{t('variables.picker.noMatchingTitle')}</p>
                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                    {t('variables.picker.noMatchingDescription')}
                  </p>
                </CommandEmpty>
              ) : (
                Object.entries(groupedItems).map(([groupLabel, items]) => (
                  <CommandGroup
                    key={groupLabel}
                    heading={showGroupHeadings ? groupLabel : undefined}
                    className="mb-5 last:mb-0">
                    {items.map((item) => {
                      const ScopeIcon = scopeIconMap[item.scope];
                      const is_active = item.key === activeItem?.key;
                      const isSelected = selectedKeys.has(item.key);
                      const itemIndex = itemIndexByKey.get(item.key) ?? 0;
                      const SelectionIcon = isSelected ? CheckSquare : Square;

                      return (
                        <CommandItem
                          key={item.key}
                          value={`${item.label} ${item.subtitle}`}
                          onFocus={() => setActiveKey(item.key)}
                          onMouseEnter={() => setActiveKey(item.key)}
                          onSelect={() => {
                            setActiveKey(item.key);
                            if (!multiSelect) {
                              emitSingleSelect(item);
                              return;
                            }
                            toggleSelectedKey(item.key);
                          }}
                          className={cn(
                            'mb-2 flex items-start gap-3 rounded-lg border px-3 py-3 transition-all last:mb-0',
                            isSelected
                              ? 'border-emerald-300 bg-emerald-50/80 text-slate-900 shadow-[0_18px_42px_-30px_rgba(16,185,129,0.75)]'
                              : is_active
                                ? 'border-blue-300 bg-blue-50/70 text-slate-900 shadow-[0_18px_42px_-30px_rgba(37,99,235,0.55)]'
                                : 'border-slate-200 bg-white text-slate-900 hover:border-blue-200 hover:bg-slate-50/70',
                          )}>
                          <div
                            className={cn(
                              'mt-0.5 flex h-9 w-10 shrink-0 items-center justify-center rounded-lg border font-mono text-xs font-semibold',
                              isSelected
                                ? 'border-emerald-200 bg-white text-emerald-700'
                                : is_active
                                  ? 'border-blue-200 bg-white text-blue-700'
                                  : 'border-slate-200 bg-slate-50 text-slate-500',
                            )}>
                            #{itemIndex}
                          </div>

                          <div
                            className={cn(
                              'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg',
                              isSelected
                                ? 'bg-emerald-100 text-emerald-700'
                                : is_active
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-slate-100 text-slate-600',
                            )}>
                            <ScopeIcon className="size-4" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold leading-5">{item.label}</div>
                            <div className="mt-1 break-all font-mono text-[11px] leading-4 text-slate-400">
                              {item.token}
                            </div>
                            <div className="mt-1 truncate text-xs text-slate-500">{item.groupLabel}</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
                                {t(scopeLabelKeyMap[item.scope])}
                              </span>
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                                {item.dataLabel}
                              </span>
                              {item.sourceTableLabel ? (
                                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                                  {item.sourceTableLabel}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="pt-0.5">
                            <div
                              className={cn(
                                'flex size-7 items-center justify-center rounded-full border',
                                isSelected
                                  ? 'border-emerald-200 bg-white text-emerald-600'
                                  : multiSelect
                                    ? 'border-slate-200 bg-white text-slate-300'
                                    : is_active
                                      ? 'border-blue-200 bg-white text-blue-600'
                                      : 'border-slate-200 bg-white text-transparent',
                              )}>
                              {multiSelect ? <SelectionIcon className="size-3.5" /> : <Check className="size-3.5" />}
                            </div>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ))
              )}
            </CommandList>
          </Command>

          <div className="flex min-h-0 flex-col overflow-hidden bg-slate-50/80">
            <div className="flex min-h-0 flex-1 flex-col p-3">
              {activeItem ? (
                <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-slate-100 shadow-inner">
                  <div dangerouslySetInnerHTML={{ __html: activePreviewHtml }} />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                  {t('variables.picker.previewEmpty')}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 sm:items-center sm:justify-between sm:space-x-0">
          <div className="min-w-0 text-sm text-slate-500">
            {multiSelect && selectedItems.length > 0 ? (
              <div className="min-w-0">
                <div>
                  {t('variables.picker.selectedCount', { count: selectedItems.length })}
                  {selectedItems.length > 3 ? (
                    <span className="text-slate-400">
                      {' '}
                      {t('variables.picker.andMoreCount', { count: selectedItems.length - 3 })}
                    </span>
                  ) : null}
                </div>
                <div className="mt-0.5 max-w-[760px] truncate font-medium text-slate-900">{selectedSummary}</div>
              </div>
            ) : activeItem ? (
              <>
                {t('variables.picker.selectedPrefix')}{' '}
                <span className="font-medium text-slate-900">{activeItem.label}</span>
              </>
            ) : (
              t('variables.picker.selectOneToInsert')
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-10 rounded-xl px-5">
              {t('common.actions.cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleInsert}
              disabled={itemsToInsert.length === 0}
              className="h-10 rounded-xl bg-emerald-600 px-5 hover:bg-emerald-700">
              {multiSelect && selectedItems.length > 1
                ? t('variables.picker.insertSelectedCount', { count: selectedItems.length })
                : dialogConfirmLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
