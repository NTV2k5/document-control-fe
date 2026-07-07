import { API } from 'reactjs-platform/utilities';

export type MetadataOption = {
  value: string;
  label: string;
};

export type FilterFieldApiTable = {
  key: string;
  label: string;
  source_type: 'api_table';
  table: string;
  field_name: string;
  label_field?: string;
  label_expr?: string;
};

export type FilterFieldStatic = {
  key: string;
  label: string;
  source_type: 'static';
  options: MetadataOption[];
};

export type FilterFieldInputText = {
  key: string;
  label: string;
  source_type: 'input_text';
  placeholder?: string;
};

export type FilterFieldInputNumber = {
  key: string;
  label: string;
  source_type: 'input_number';
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
};

export type FilterField = FilterFieldApiTable | FilterFieldStatic | FilterFieldInputText | FilterFieldInputNumber;

export type TemplateFilterConfig = {
  fields: FilterField[];
};

export type FilterConfigByType = Record<string, TemplateFilterConfig>;

export type FilterConfigMetaValues = {
  filterDocument?: FilterConfigByType | TemplateFilterConfig;
  filterTemplate: FilterConfigByType;
};

const isFlatFilterConfig = (config: FilterConfigByType | TemplateFilterConfig): config is TemplateFilterConfig => {
  return Array.isArray((config as TemplateFilterConfig).fields);
};

export const getFilterFieldsForType = (
  config: FilterConfigByType | TemplateFilterConfig | null | undefined,
  type?: string | null,
): FilterField[] => {
  if (!config || !type || type === 'ALL') return [];

  if (isFlatFilterConfig(config)) {
    return config.fields;
  }

  return config[type]?.fields ?? [];
};

export const getDocumentFilterConfigByType = (metaValues?: FilterConfigMetaValues | null): FilterConfigByType => {
  const documentConfig = metaValues?.filterDocument;

  if (documentConfig && !isFlatFilterConfig(documentConfig)) {
    return documentConfig;
  }

  return metaValues?.filterTemplate ?? {};
};

type OptionWithRecord = {
  value: string;
  label: string;
  record?: Record<string, unknown>;
};

const exprCache = new Map<string, (record: unknown, value: unknown, label: unknown) => unknown>();

const compileLabelExpr = (expr: string) => {
  const cached = exprCache.get(expr);
  if (cached) return cached;
  try {
    const fn = new Function('record', 'value', 'label', `"use strict"; return (${expr});`) as (
      record: unknown,
      value: unknown,
      label: unknown,
    ) => unknown;
    exprCache.set(expr, fn);
    return fn;
  } catch {
    return null;
  }
};

export const applyLabelExpr = <T extends OptionWithRecord>(options: T[], expr?: string): T[] => {
  if (!expr) return options;
  const fn = compileLabelExpr(expr);
  if (!fn) return options;
  return options.map((opt) => {
    try {
      const result = fn(opt.record ?? {}, opt.value, opt.label);
      const label = result === null || result === undefined ? opt.label : String(result);
      return { ...opt, label };
    } catch {
      return opt;
    }
  });
};

export type MetadataRecord<TMetaValues = unknown> = {
  id: string;
  meta_key: string;
  meta_values: TMetaValues;
  meta_values_display?: string | null;
  created_at: string;
  updated_at: string;
};

const pendingMetadataRequests = new Map<string, Promise<MetadataRecord<unknown>>>();

export const getMetadataByKeyAPI = async <TMetaValues = unknown>(
  meta_key: string,
): Promise<MetadataRecord<TMetaValues>> => {
  const existing = pendingMetadataRequests.get(meta_key);
  if (existing) {
    return existing as Promise<MetadataRecord<TMetaValues>>;
  }

  const request = API.get<{ data: MetadataRecord<TMetaValues> }>('/api/v1/metadata', {
    params: { meta_key },
  })
    .then((response) => response.data.data)
    .finally(() => {
      pendingMetadataRequests.delete(meta_key);
    });

  pendingMetadataRequests.set(meta_key, request as Promise<MetadataRecord<unknown>>);
  return request;
};
