'use client';

import { Check, Columns3, Database, Rows3, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from 'reactjs-platform/ui';
import { cn } from 'reactjs-platform/utilities';
import { useTranslation } from '../../../i18n';
import {
  getAllTableTemplates,
  mapRequiredTypeDisplayValue,
  type TableTemplate,
  type TableTemplateCell,
  type TableTemplateHeader,
  type TableTemplateRow,
} from '../../../lib';

export interface ITableTemplateSelectorProps {
  onSelectTemplate: (template: TableTemplate) => void;
  onClose?: () => void;
}

const countTemplateRows = (template: TableTemplate) => {
  const directRows = Array.isArray(template.structure.rows) ? template.structure.rows.length : 0;
  const blockRows = (template.structure.blocks || []).reduce((total, block) => total + (block.rows?.length || 0), 0);
  return Math.max(directRows, blockRows);
};

const getCellConfig = (cellData: TableTemplateCell) => {
  if (typeof cellData === 'object' && cellData !== null && 'value' in cellData) {
    return {
      value: cellData.value === undefined || cellData.value === null ? '' : cellData.value,
      table_field: cellData.table_field || null,
      is_read_only: cellData.is_read_only || false,
    };
  }

  return {
    value: cellData === undefined || cellData === null ? '' : (cellData as string),
    table_field: null,
    is_read_only: false,
  };
};

const getDisplayCellValue = (cellData: TableTemplateCell, header: TableTemplateHeader) =>
  mapRequiredTypeDisplayValue(getCellConfig(cellData).value, header);

const getFlatPreviewRows = (template: TableTemplate) => {
  const rows: Array<
    | { kind: 'subsection'; key: string; row: Record<string, TableTemplateCell> }
    | { kind: 'row'; key: string; row: TableTemplateRow }
  > = [];

  if (template.structure.blocks?.length) {
    template.structure.blocks.forEach((block, blockIdx) => {
      if (block.subsection) {
        rows.push({
          kind: 'subsection',
          key: `subsection-${block.id ?? blockIdx}`,
          row: block.subsection,
        });
      }

      (block.rows || []).forEach((row, rowIdx) => {
        rows.push({
          kind: 'row',
          key: `row-${block.id ?? blockIdx}-${row.id ?? rowIdx}`,
          row,
        });
      });
    });
  } else {
    (template.structure.rows || []).forEach((row, rowIdx) => {
      rows.push({
        kind: 'row',
        key: `row-${row.id ?? rowIdx}`,
        row,
      });
    });
  }

  return rows;
};

export const TableTemplateSelector = ({ onSelectTemplate, onClose }: ITableTemplateSelectorProps) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const templates = useMemo(() => getAllTableTemplates(), []);

  const filteredTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return templates;
    }

    return templates.filter((template) =>
      [template.name, template.title, template.description, template.id, template.primary_table]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
    );
  }, [query, templates]);

  const selectedTemplate = useMemo(
    () => filteredTemplates.find((template) => template.id === selectedTemplateId) ?? null,
    [filteredTemplates, selectedTemplateId],
  );

  useEffect(() => {
    if (filteredTemplates.length === 0) {
      setSelectedTemplateId(null);
      return;
    }

    setSelectedTemplateId((current) =>
      current && filteredTemplates.some((template) => template.id === current) ? current : filteredTemplates[0].id,
    );
  }, [filteredTemplates]);

  const handleConfirm = () => {
    if (!selectedTemplate) return;

    onSelectTemplate(JSON.parse(JSON.stringify(selectedTemplate)) as TableTemplate);
    onClose?.();
  };

  const previewRows = selectedTemplate ? getFlatPreviewRows(selectedTemplate) : [];

  return (
    <Dialog open onOpenChange={(nextOpen) => !nextOpen && onClose?.()}>
      <DialogContent className="flex h-[94vh] max-h-[94vh] w-[96vw] max-w-[1780px] flex-col overflow-hidden p-0">
        <DialogHeader className="border-b border-slate-200 px-6 py-4">
          <DialogTitle className="text-xl font-semibold text-slate-900">
            {t('templateSelectors.table.title')}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            {t('templateSelectors.table.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="shrink-0 border-b border-slate-200 px-6 py-3.5">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('templateSelectors.table.searchPlaceholder')}
              className="h-11 rounded-xl border-slate-200 pl-10"
            />
          </div>
        </div>

        <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(420px,0.8fr)_minmax(0,1.2fr)]">
          <div className="min-h-0 overflow-hidden border-b border-slate-200 lg:border-b-0 lg:border-r lg:border-slate-200">
            <div className="h-full overflow-y-auto p-5">
              {filteredTemplates.length > 0 ? (
                <div className="grid gap-3 xl:grid-cols-2">
                  {filteredTemplates.map((template) => {
                    const isSelected = selectedTemplate?.id === template.id;

                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => setSelectedTemplateId(template.id)}
                        className={cn(
                          'rounded-2xl border p-4 text-left transition-all',
                          isSelected
                            ? 'border-emerald-300 bg-emerald-50/80 shadow-[0_18px_42px_-30px_rgba(16,185,129,0.75)]'
                            : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50/70',
                        )}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="line-clamp-2 text-lg font-semibold leading-7 text-slate-900">
                              {template.name}
                            </div>
                            <div className="mt-2 line-clamp-4 text-sm leading-6 text-slate-600">
                              {template.description || t('templateSelectors.table.noDescription')}
                            </div>
                          </div>
                          <div
                            className={cn(
                              'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border',
                              isSelected
                                ? 'border-emerald-200 bg-white text-emerald-600'
                                : 'border-slate-200 bg-slate-50 text-transparent',
                            )}>
                            <Check className="size-4" />
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                            <Columns3 className="size-3.5" />
                            {t('templateSelectors.table.columns', { count: template.structure.headers.length })}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                            <Rows3 className="size-3.5" />
                            {t('templateSelectors.table.rows', { count: countTemplateRows(template) })}
                          </span>
                          {template.primary_table ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
                              <Database className="size-3.5" />
                              {template.primary_table}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex min-h-[260px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
                  <p className="text-base font-semibold text-slate-900">
                    {t('templateSelectors.table.noMatchesTitle')}
                  </p>
                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                    {t('templateSelectors.table.noMatchesDescription')}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-col bg-slate-50/80">
            <div className="border-b border-slate-200 px-6 py-5">
              {selectedTemplate ? (
                <>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    {t('templateSelectors.table.preview')}
                  </div>
                  <h3 className="mt-2 text-2xl font-semibold leading-tight text-slate-900">{selectedTemplate.name}</h3>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    {selectedTemplate.description || t('templateSelectors.table.previewDescription')}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
                      {t('templateSelectors.table.columns', { count: selectedTemplate.structure.headers.length })}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
                      {t('templateSelectors.table.rows', { count: countTemplateRows(selectedTemplate) })}
                    </span>
                    {selectedTemplate.primary_table ? (
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 shadow-sm">
                        {t('templateSelectors.table.source', { value: selectedTemplate.primary_table })}
                      </span>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    {t('templateSelectors.table.preview')}
                  </div>
                  <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                    {t('templateSelectors.table.chooseOneTitle')}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {t('templateSelectors.table.chooseOneDescription')}
                  </p>
                </>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-6">
              {selectedTemplate ? (
                <div className="rounded-[30px] border border-slate-200 bg-slate-100 p-5">
                  <div className="mx-auto w-full max-w-[1120px] rounded-[28px] border border-white/80 bg-white shadow-[0_24px_64px_-48px_rgba(15,23,42,0.45)]">
                    <div className="border-b border-slate-200 px-6 py-5">
                      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                        {t('templateSelectors.table.actualPreviewCanvas')}
                      </div>
                      <div className="mt-2 text-2xl font-semibold leading-tight text-slate-900">
                        {selectedTemplate.title || selectedTemplate.name}
                      </div>
                    </div>

                    <div className="overflow-auto p-6">
                      <table className="min-w-full border-collapse text-sm">
                        <thead>
                          <tr>
                            {selectedTemplate.structure.headers.map((header) => (
                              <th
                                key={header.key}
                                className="border border-slate-200 px-4 py-3 text-left align-top font-semibold text-slate-700"
                                style={{ backgroundColor: header.background_color || '#f8fafc' }}>
                                {header.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewRows.length > 0 ? (
                            previewRows.map((entry) => (
                              <tr
                                key={entry.key}
                                className={entry.kind === 'subsection' ? 'bg-slate-50/80' : 'bg-white'}>
                                {selectedTemplate.structure.headers.map((header) => (
                                  <td
                                    key={header.key}
                                    className={cn(
                                      'border border-slate-200 px-4 py-3 align-top text-slate-600',
                                      entry.kind === 'subsection' && 'font-semibold text-slate-700',
                                    )}>
                                    {getDisplayCellValue(entry.row[header.key], header) || '—'}
                                  </td>
                                ))}
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={selectedTemplate.structure.headers.length || 1}
                                className="border border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                                {t('templateSelectors.table.noPreviewRows')}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center rounded-[30px] border border-dashed border-slate-300 bg-white/70 px-6 text-center">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">
                      {t('templateSelectors.table.noPreviewTitle')}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {t('templateSelectors.table.noPreviewDescription')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-slate-200 bg-white px-6 py-4 sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} className="h-11 rounded-xl px-5">
            {t('common.actions.cancel')}
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!selectedTemplate} className="h-11 rounded-xl px-5">
            {t('templateSelectors.table.useTemplate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
