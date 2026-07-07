'use client';

import { Check, Database, FileText, FolderTree, Search } from 'lucide-react';
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
import { useTranslation, type TTranslationParams } from '../../../i18n';
import {
  generateDocumentHtml,
  getAllDocumentTemplates,
  serializeDocumentMultiReferenceListValue,
  type TDocumentTemplate,
} from '../../../lib';

export interface IDocumentTemplateSelectorProps {
  onSelectTemplate: (template: TDocumentTemplate) => void;
  onClose?: () => void;
}

type TPreviewSubItem = {
  table_field?: string;
  label?: string;
  value?: string;
  sub_items?: TPreviewSubItem[];
};

const countDocumentSections = (sections: TDocumentTemplate['sections']): number =>
  sections.reduce((total, section) => total + 1 + countDocumentSections(section.children || []), 0);

const countDocumentFields = (sections: TDocumentTemplate['sections']): number =>
  sections.reduce((total, section) => total + section.fields.length + countDocumentFields(section.children || []), 0);

const cloneTemplateForPreview = (template: TDocumentTemplate): TDocumentTemplate => {
  const previewTemplate = JSON.parse(JSON.stringify(template)) as TDocumentTemplate;

  const walkSections = (sections: TDocumentTemplate['sections']) => {
    sections.forEach((section) => {
      section.fields.forEach((field) => {
        if (field.type === 'checkbox') {
          field.options = field.options.map((option, index) => ({
            ...option,
            checked: index === 0,
          }));
        }
      });

      if (section.children?.length) {
        walkSections(section.children);
      }
    });
  };

  walkSections(previewTemplate.sections);
  return previewTemplate;
};

const buildPreviewValues = (template: TDocumentTemplate, t: (key: string, params?: TTranslationParams) => string) => {
  const values: Record<string, string> = {};

  const fillSubItems = (fieldId: string, parentIndex: number, subItems: NonNullable<unknown>, depth = 1) => {
    if (!Array.isArray(subItems)) {
      return;
    }

    (subItems as TPreviewSubItem[]).forEach((subItem, subIndex) => {
      const key = subItem.table_field || `${fieldId}_${parentIndex}_sub_${subIndex}`;
      const label =
        subItem.label?.trim() || t('templateSelectors.document.sampleSubItem', { depth, index: subIndex + 1 });
      values[key] = subItem.value || t('templateSelectors.document.sampleSuffix', { label });

      if (Array.isArray(subItem.sub_items) && subItem.sub_items.length > 0) {
        fillSubItems(fieldId, parentIndex, subItem.sub_items, depth + 1);
      }
    });
  };

  const walkSections = (sections: TDocumentTemplate['sections']) => {
    sections.forEach((section) => {
      section.fields.forEach((field) => {
        if (field.type === 'checkbox') {
          return;
        }

        if (field.type === 'list') {
          field.items.forEach((item, itemIndex) => {
            const key = item.table_field || `${field.id}_${itemIndex}`;
            const label =
              item.label?.trim() ||
              t('templateSelectors.document.sampleItem', {
                label: field.label || t('templateSelectors.document.sampleValue'),
                index: itemIndex + 1,
              });
            values[key] = item.value || t('templateSelectors.document.sampleSuffix', { label });

            if (item.sub_items?.length) {
              fillSubItems(field.id, itemIndex, item.sub_items);
            }
          });
          return;
        }

        if (field.type === 'multi_reference_list') {
          values[field.id] = serializeDocumentMultiReferenceListValue([
            {
              value: 'sample-person-1',
              label: 'Lê Huỳnh Phước',
              record: {
                id: 'sample-person-1',
                name: 'Lê Huỳnh Phước',
                degree: 'Thạc sĩ',
                phones: ['0907 667 299'],
                emails: ['phuoclh@giadinh.edu.vn'],
              },
            },
          ]);
          return;
        }

        const key = field.table_field || field.id;
        const label = field.label?.trim() || t('templateSelectors.document.sampleValue');
        values[key] = field.value || t('templateSelectors.document.sampleSuffix', { label });
      });

      if (section.children?.length) {
        walkSections(section.children);
      }
    });
  };

  walkSections(template.sections);
  return values;
};

export const DocumentTemplateSelector = ({ onSelectTemplate, onClose }: IDocumentTemplateSelectorProps) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const templates = useMemo(() => getAllDocumentTemplates(), []);

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

  const previewHtml = useMemo(() => {
    if (!selectedTemplate) {
      return '';
    }

    const previewTemplate = cloneTemplateForPreview(selectedTemplate);
    return generateDocumentHtml(previewTemplate, buildPreviewValues(previewTemplate, t));
  }, [selectedTemplate, t]);

  const handleConfirm = () => {
    if (!selectedTemplate) return;

    onSelectTemplate(JSON.parse(JSON.stringify(selectedTemplate)) as TDocumentTemplate);
    onClose?.();
  };

  return (
    <Dialog open onOpenChange={(nextOpen) => !nextOpen && onClose?.()}>
      <DialogContent className="flex h-[94vh] max-h-[94vh] w-[96vw] max-w-[1780px] flex-col overflow-hidden p-0">
        <DialogHeader className="border-b border-slate-200 px-6 py-4">
          <DialogTitle className="text-xl font-semibold text-slate-900">
            {t('templateSelectors.document.title')}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            {t('templateSelectors.document.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="shrink-0 border-b border-slate-200 px-6 py-3.5">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('templateSelectors.document.searchPlaceholder')}
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
                              {template.description || t('templateSelectors.document.noDescription')}
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
                            <FolderTree className="size-3.5" />
                            {t('templateSelectors.document.sections', {
                              count: countDocumentSections(template.sections),
                            })}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                            <FileText className="size-3.5" />
                            {t('templateSelectors.document.fields', { count: countDocumentFields(template.sections) })}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
                            <Database className="size-3.5" />
                            {template.primary_table}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex min-h-[260px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
                  <p className="text-base font-semibold text-slate-900">
                    {t('templateSelectors.document.noMatchesTitle')}
                  </p>
                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                    {t('templateSelectors.document.noMatchesDescription')}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-col bg-slate-50/80">
            <div className="border-b border-slate-200 px-6 py-5">
              {selectedTemplate ? (
                <>
                  <div className="text-[13px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    {t('templateSelectors.document.preview')}
                  </div>
                  <h3 className="mt-2 text-2xl font-semibold leading-tight text-slate-900">{selectedTemplate.name}</h3>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    {selectedTemplate.description || t('templateSelectors.document.previewDescription')}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-[13px] font-medium text-slate-600 shadow-sm">
                      {t('templateSelectors.document.sections', {
                        count: countDocumentSections(selectedTemplate.sections),
                      })}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-[13px] font-medium text-slate-600 shadow-sm">
                      {t('templateSelectors.document.fields', {
                        count: countDocumentFields(selectedTemplate.sections),
                      })}
                    </span>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-[13px] font-medium text-blue-700 shadow-sm">
                      {t('templateSelectors.document.source', { value: selectedTemplate.primary_table })}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[13px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    {t('templateSelectors.document.preview')}
                  </div>
                  <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                    {t('templateSelectors.document.chooseOneTitle')}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {t('templateSelectors.document.chooseOneDescription')}
                  </p>
                </>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-6">
              {selectedTemplate ? (
                <div className="rounded-[30px] border border-slate-200 bg-slate-100 p-5">
                  <div className="mx-auto w-full max-w-[1120px] rounded-[28px] border border-white/80 bg-white shadow-[0_24px_64px_-48px_rgba(15,23,42,0.45)]">
                    <div className="border-b border-slate-200 px-6 py-5">
                      <div className="text-[13px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                        {t('templateSelectors.document.actualPreviewCanvas')}
                      </div>
                      <div className="mt-2 text-2xl font-semibold leading-tight text-slate-900">
                        {selectedTemplate.title || selectedTemplate.name}
                      </div>
                    </div>

                    <div className="max-h-[58vh] overflow-auto p-6">
                      <div
                        className="prose prose-slate max-w-none text-[15px] leading-7"
                        // biome-ignore lint/security/noDangerouslySetInnerHtml: Preview HTML is generated from trusted document template content.
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center rounded-[30px] border border-dashed border-slate-300 bg-white/70 px-6 text-center">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">
                      {t('templateSelectors.document.noPreviewTitle')}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {t('templateSelectors.document.noPreviewDescription')}
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
            {t('templateSelectors.document.useTemplate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
