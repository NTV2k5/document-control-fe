import {
  Check,
  FileImage,
  FileSpreadsheet,
  FileText,
  Loader2,
  Presentation,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SearchableSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'reactjs-platform/ui';
import { useDebounce } from 'reactjs-platform/utilities';
import {
  applyLabelExpr,
  getMetadataByKeyAPI,
  getTemplateTableOptionsAPI,
  listTemplatesAPI,
  type FilterConfigMetaValues,
  type FilterField,
  type ITemplateListItem,
  type MetadataOption,
  type TemplateArtifactType,
} from 'api';

import { useTranslation } from '../../i18n';
import { toDocumentInputAgentSelectedTemplate } from './document-input-agent-action.type';
import type { IDocumentInputAgentTemplateSelectorProps } from './document-input-agent-template-selector.type';

const getTemplateArtifactLabelKey = (artifactType?: TemplateArtifactType) => {
  switch (artifactType) {
    case 'rich_text':
      return 'documentInputAgent.actions.artifactTypes.richText';
    case 'spreadsheet':
      return 'documentInputAgent.actions.artifactTypes.spreadsheet';
    case 'presentation':
      return 'documentInputAgent.actions.artifactTypes.presentation';
    case 'image_form':
      return 'documentInputAgent.actions.artifactTypes.imageForm';
    default:
      return 'documentInputAgent.actions.artifactTypes.unknown';
  }
};

const renderTemplateArtifactIcon = (artifactType?: TemplateArtifactType): ReactNode => {
  switch (artifactType) {
    case 'spreadsheet':
      return <FileSpreadsheet className="size-5" />;
    case 'presentation':
      return <Presentation className="size-5" />;
    case 'image_form':
      return <FileImage className="size-5" />;
    default:
      return <FileText className="size-5" />;
  }
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

const appendRecordCodeToFilterLabels = <T extends FilterOptionWithRecord>(options: T[]) =>
  options.map((option) => {
    const code = getRecordCode(option.record);
    if (!code || option.label.toLowerCase().includes(code.toLowerCase())) return option;

    return {
      ...option,
      label: `${option.label} (${code})`,
    };
  });

export const DocumentInputAgentTemplateSelector = ({
  open,
  selectedTemplateId,
  onOpenChange,
  onSelectTemplate,
}: IDocumentInputAgentTemplateSelectorProps) => {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<ITemplateListItem[]>([]);
  const [templateTypeOptions, setTemplateTypeOptions] = useState<MetadataOption[]>([]);
  const [filterConfig, setFilterConfig] = useState<FilterConfigMetaValues['filterTemplate']>({});
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [metadataFilter, setMetadataFilter] = useState<Record<string, string>>({});
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [pendingTemplateId, setPendingTemplateId] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const debouncedQuery = useDebounce(query, 350);
  const debouncedMetadataFilter = useDebounce(metadataFilter, 350);
  const metadataFields = useMemo<FilterField[]>(
    () => (typeFilter ? (filterConfig[typeFilter]?.fields ?? []) : []),
    [filterConfig, typeFilter],
  );
  const activeFilterCount = (typeFilter ? 1 : 0) + Object.keys(metadataFilter).length;

  useEffect(() => {
    if (!open) return;

    let isCancelled = false;

    void getMetadataByKeyAPI<MetadataOption[]>('TEMPLATE_TYPE')
      .then((metadata) => {
        if (!isCancelled) setTemplateTypeOptions(metadata.meta_values ?? []);
      })
      .catch(() => {
        if (!isCancelled) setTemplateTypeOptions([]);
      });

    return () => {
      isCancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let isCancelled = false;

    void getMetadataByKeyAPI<FilterConfigMetaValues>('FILTER_CONFIG')
      .then((record) => {
        if (!isCancelled) setFilterConfig(record.meta_values?.filterTemplate ?? {});
      })
      .catch(() => {
        if (!isCancelled) setFilterConfig({});
      });

    return () => {
      isCancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let isCancelled = false;
    setIsLoading(true);
    setErrorMessage('');

    listTemplatesAPI({
      status: 'APPROVED',
      page: 1,
      page_size: 100,
      sort: 'asc:name',
      search: debouncedQuery.trim() || undefined,
      template_type: typeFilter || undefined,
      metadata_filter: Object.keys(debouncedMetadataFilter).length > 0 ? debouncedMetadataFilter : undefined,
    })
      .then(({ data }) => {
        if (isCancelled) return;
        setTemplates(data);
        setPendingTemplateId((current) => {
          if (current && data.some((template) => template.id === current)) return current;
          if (selectedTemplateId && data.some((template) => template.id === selectedTemplateId)) {
            return selectedTemplateId;
          }
          return data[0]?.id;
        });
      })
      .catch((error) => {
        if (!isCancelled) setErrorMessage(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [debouncedMetadataFilter, debouncedQuery, open, selectedTemplateId, typeFilter]);

  const pendingTemplate = useMemo(
    () => templates.find((template) => template.id === pendingTemplateId),
    [pendingTemplateId, templates],
  );

  const confirmTemplate = () => {
    if (!pendingTemplate) return;
    onSelectTemplate(toDocumentInputAgentSelectedTemplate(pendingTemplate));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="bg-white/60 backdrop-blur-sm"
        className="w-[calc(100vw-2rem)] max-w-[640px] gap-0 rounded-2xl border border-neutral-200 bg-white p-4 shadow-[0_16px_48px_rgba(15,23,42,0.16)] sm:rounded-2xl [&>button]:right-4 [&>button]:top-4 [&>button]:rounded-full [&>button]:p-2 [&>button]:hover:bg-neutral-100">
        <DialogHeader className="space-y-4 pr-10 text-left">
          <DialogTitle className="text-2xl font-normal leading-tight tracking-normal text-neutral-950">
            {t('documentInputAgent.actions.chooseTemplateTitle')}
          </DialogTitle>
          <DialogDescription className="text-base leading-7 text-neutral-500">
            {t('documentInputAgent.actions.chooseTemplateDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 flex items-center gap-2">
          <label htmlFor="document-input-agent-template-search" className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <Input
              id="document-input-agent-template-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('documentInputAgent.actions.searchTemplate')}
              className="h-11 rounded-full border-neutral-200 bg-white pl-10 pr-4 text-base shadow-none placeholder:text-neutral-400 focus-visible:ring-4 focus-visible:ring-blue-600/15 focus-visible:ring-offset-0"
            />
          </label>
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={`relative flex size-11 shrink-0 items-center justify-center rounded-full border transition ${
                  activeFilterCount > 0
                    ? 'border-neutral-950 bg-neutral-950 text-white'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                }`}
                title={t('documentInputAgent.actions.filterTemplates')}>
                <SlidersHorizontal className="size-5" />
                {activeFilterCount > 0 ? (
                  <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full border border-white bg-blue-600 text-[11px] font-semibold text-white">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="z-[70] w-[min(380px,calc(100vw-2rem))] rounded-2xl border-neutral-200 bg-white p-4 shadow-[0_16px_48px_rgba(15,23,42,0.16)]">
              <div className="flex items-center justify-between gap-3">
                <div className="text-base font-semibold text-neutral-950">
                  {t('documentInputAgent.actions.filterTemplates')}
                </div>
                {activeFilterCount > 0 ? (
                  <button
                    type="button"
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                    onClick={() => {
                      setTypeFilter('');
                      setMetadataFilter({});
                      setPendingTemplateId(undefined);
                    }}>
                    {t('documentInputAgent.actions.clearFilters')}
                  </button>
                ) : null}
              </div>

              <div className="mt-4 space-y-4">
                <div className="grid gap-1.5">
                  <label
                    htmlFor="document-input-agent-template-type-filter"
                    className="text-sm font-medium text-neutral-700">
                    {t('documentInputAgent.actions.templateType')}
                  </label>
                  <Select
                    value={typeFilter || '__ALL__'}
                    onValueChange={(value) => {
                      const next = value === '__ALL__' ? '' : value;
                      setTypeFilter(next);
                      setMetadataFilter({});
                      setPendingTemplateId(undefined);
                    }}>
                    <SelectTrigger id="document-input-agent-template-type-filter" className="h-10 rounded-xl">
                      <SelectValue placeholder={t('documentInputAgent.actions.allTemplateTypes')} />
                    </SelectTrigger>
                    <SelectContent className="z-[80]">
                      <SelectItem value="__ALL__">{t('documentInputAgent.actions.allTemplateTypes')}</SelectItem>
                      {templateTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {typeFilter && metadataFields.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
                    {t('documentInputAgent.actions.noMetadataFilters')}
                  </div>
                ) : null}

                {metadataFields.length > 0 ? (
                  <div className="grid gap-3 rounded-xl border border-neutral-200 bg-neutral-50/70 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-normal text-neutral-500">
                        {t('documentInputAgent.actions.metadataFilters')}
                      </span>
                      {Object.keys(metadataFilter).length > 0 ? (
                        <button
                          type="button"
                          className="text-xs font-medium text-blue-600 hover:text-blue-700"
                          onClick={() => setMetadataFilter({})}>
                          {t('documentInputAgent.actions.clearFilters')}
                        </button>
                      ) : null}
                    </div>
                    {metadataFields.map((field) => {
                      const currentValue = metadataFilter[field.key] || '';
                      const writeFilter = (value: string) => {
                        setMetadataFilter((current) => {
                          const next = { ...current };
                          if (value) next[field.key] = value;
                          else delete next[field.key];
                          return next;
                        });
                        setPendingTemplateId(undefined);
                      };

                      return (
                        <div key={field.key} className="grid gap-1.5">
                          <span className="text-sm font-medium text-neutral-700">{field.label}</span>
                          {field.source_type === 'api_table' ? (
                            <SearchableSelect
                              value={currentValue || undefined}
                              clearable
                              fetchOnOpen
                              minSearchLength={0}
                              placeholder={t('documentInputAgent.actions.chooseMetadata', { label: field.label })}
                              searchPlaceholder={t('documentInputAgent.actions.searchMetadata', { label: field.label })}
                              emptyMessage={t('documentInputAgent.actions.noMetadataResult')}
                              className="h-10 rounded-xl text-sm"
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
                              onValueChange={(value) => writeFilter(value ?? '')}
                            />
                          ) : field.source_type === 'static' ? (
                            <Select
                              value={currentValue || '__NONE__'}
                              onValueChange={(value) => writeFilter(value === '__NONE__' ? '' : value)}>
                              <SelectTrigger className="h-10 rounded-xl text-sm">
                                <SelectValue
                                  placeholder={t('documentInputAgent.actions.chooseMetadata', { label: field.label })}
                                />
                              </SelectTrigger>
                              <SelectContent className="z-[80]">
                                <SelectItem value="__NONE__">
                                  {t('documentInputAgent.actions.noMetadataSelection')}
                                </SelectItem>
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
                              className="h-10 rounded-xl text-sm"
                              value={currentValue}
                              placeholder={field.placeholder ?? field.label}
                              onChange={(event) => writeFilter(event.target.value)}
                            />
                          ) : (
                            <Input
                              type="text"
                              className="h-10 rounded-xl text-sm"
                              value={currentValue}
                              placeholder={field.placeholder ?? field.label}
                              onChange={(event) => writeFilter(event.target.value)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="mt-4 max-h-[360px] min-h-[220px] overflow-y-auto pr-1">
          {isLoading ? (
            <div className="flex h-44 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 text-sm font-medium text-neutral-500">
              <Loader2 className="size-4 animate-spin" />
              <span>{t('documentInputAgent.actions.loadingTemplates')}</span>
            </div>
          ) : errorMessage ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
              {errorMessage}
            </div>
          ) : templates.length === 0 ? (
            <div className="flex h-44 items-center justify-center rounded-xl border border-dashed border-neutral-200 text-sm text-neutral-500">
              {t('documentInputAgent.actions.noTemplates')}
            </div>
          ) : (
            <div className="space-y-1.5">
              {templates.map((template) => {
                const isSelected = template.id === pendingTemplateId;

                return (
                  <button
                    key={template.id}
                    type="button"
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                      isSelected
                        ? 'border-neutral-950 bg-neutral-50 text-neutral-950'
                        : 'border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50'
                    }`}
                    onClick={() => setPendingTemplateId(template.id)}>
                    <span
                      className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                        template.artifact_type === 'spreadsheet'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-neutral-100 text-neutral-700'
                      }`}>
                      {renderTemplateArtifactIcon(template.artifact_type)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-medium leading-6 text-neutral-950">
                        {template.name}
                      </span>
                      <span className="mt-0.5 block truncate text-sm leading-5 text-neutral-500">
                        {t(getTemplateArtifactLabelKey(template.artifact_type))}
                        {template.template_type ? ` · ${template.template_type}` : ''}
                      </span>
                    </span>
                    {isSelected ? (
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-white">
                        <Check className="size-4" />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="mt-6 flex-row justify-end gap-3 sm:space-x-0">
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-full border border-neutral-300 bg-white px-5 text-base font-medium text-neutral-950 shadow-none hover:bg-neutral-50"
            onClick={() => onOpenChange(false)}>
            {t('documentInputAgent.actions.cancel')}
          </Button>
          <Button
            type="button"
            className="h-10 rounded-full bg-neutral-950 px-5 text-base font-medium text-white shadow-none hover:bg-neutral-800 focus-visible:ring-4 focus-visible:ring-blue-600 focus-visible:ring-offset-0"
            disabled={!pendingTemplate || isLoading}
            onClick={confirmTemplate}>
            {t('documentInputAgent.actions.useTemplate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
