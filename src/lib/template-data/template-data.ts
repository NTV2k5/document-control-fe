import type { ITemplateVariableDefinition, TemplateDataCatalog, TTemplateVariableType } from 'api';
import type { DocumentTemplate } from '../document-templates';
import type { TableTemplate } from '../table-templates';
import { normalizeVariableInputType, type VariableInputType } from '../templates';

export type ExactSchemaCatalog = Record<string, string[]>;

export type ForeignKeyMeta = Record<string, { table: string; display_field: string }>;

export type EditorMetaPayload = {
  schema_field_catalog: TemplateDataCatalog;
  source_schema_field_catalog: TemplateDataCatalog;
  foreign_key_meta: ForeignKeyMeta;
  table_templates: TableTemplate[];
  document_templates: DocumentTemplate[];
  variable_definitions: ITemplateVariableDefinition[];
};

export type TemplateVariableDataSource = {
  type: 'table';
  table: string;
  valueField: string;
  labelField?: string | null;
  filterField?: string | null;
  filterValue?: unknown;
  sort_order?: 'asc' | 'desc';
};

export interface ITemplateVariableDefinitionConfig {
  id: string;
  key: string;
  label: string;
  description?: string | null;
  groupLabel?: string | null;
  templateTypes: string[];
  variableType: TTemplateVariableType;
  inputType: VariableInputType;
  defaultValue?: string | null;
  dataSource?: TemplateVariableDataSource | null;
  uiConfig?: Record<string, unknown> | null;
  sort_order: number;
  is_active: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const isTableTemplateConfig = (value: unknown): value is TableTemplate =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  isRecord(value.structure) &&
  Array.isArray(value.structure.headers) &&
  Array.isArray(value.structure.blocks);

export const isDocumentTemplateConfig = (value: unknown): value is DocumentTemplate =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  value.type === 'document' &&
  Array.isArray(value.sections);

const collectSourceTablesFromConfig = (value: unknown, tables: Set<string>) => {
  if (Array.isArray(value)) {
    value.forEach((item) => collectSourceTablesFromConfig(item, tables));
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  [value.table, value.reference_table, value.primary_table, value.join_table].forEach((candidate) => {
    if (typeof candidate === 'string' && candidate.trim()) {
      tables.add(candidate.trim());
    }
  });

  if (typeof value.table_field === 'string') {
    const [sourceTable] = value.table_field.split('.');
    if (sourceTable?.trim()) {
      tables.add(sourceTable.trim());
    }
  }

  Object.values(value).forEach((nestedValue) => collectSourceTablesFromConfig(nestedValue, tables));
};

export const getTemplateVariableSourceTables = (
  definition?: Pick<ITemplateVariableDefinitionConfig, 'dataSource' | 'uiConfig'> | null,
) => {
  const tables = new Set<string>();
  if (definition?.dataSource?.type === 'table' && definition.dataSource.table.trim()) {
    tables.add(definition.dataSource.table.trim());
  }

  collectSourceTablesFromConfig(definition?.uiConfig, tables);
  return Array.from(tables);
};

export type TExactSchemaCatalog = ExactSchemaCatalog;
export type TForeignKeyMeta = ForeignKeyMeta;
export type IEditorMetaPayload = EditorMetaPayload;

let schemaFieldCatalogCache: ExactSchemaCatalog = {};
let foreignKeyMetaCache: ForeignKeyMeta = {};
let templateVariableDefinitionsCache: ITemplateVariableDefinitionConfig[] = [];

export function setSchemaFieldCatalog(catalog: TemplateDataCatalog) {
  schemaFieldCatalogCache = catalog;
}

export function getSchemaFieldCatalog(): ExactSchemaCatalog {
  return schemaFieldCatalogCache;
}

export function setForeignKeyMeta(meta: ForeignKeyMeta) {
  foreignKeyMetaCache = meta;
}

export function getForeignKeyMeta(): ForeignKeyMeta {
  return foreignKeyMetaCache;
}

export function normalizeTemplateVariableDefinitions(
  definitions?: ITemplateVariableDefinition[] | null,
): ITemplateVariableDefinitionConfig[] {
  if (!Array.isArray(definitions)) {
    return [];
  }

  return definitions
    .map((definition): ITemplateVariableDefinitionConfig | null => {
      const key = definition.key?.trim();
      const label = definition.label?.trim();
      const dataSource = definition.data_source;

      if (!key || !label) {
        return null;
      }

      return {
        id: definition.id,
        key,
        label,
        description: definition.description ?? null,
        groupLabel: definition.group_label ?? null,
        templateTypes: definition.template_types ?? [],
        variableType: definition.variable_type ?? 'FIELD_VARIABLE',
        inputType: normalizeVariableInputType(definition.input_type),
        defaultValue: definition.default_value ?? null,
        dataSource:
          dataSource?.type === 'table'
            ? {
                type: 'table' as const,
                table: dataSource.table,
                valueField: dataSource.value_field,
                labelField: dataSource.label_field ?? null,
                filterField: dataSource.filter_field ?? null,
                filterValue: dataSource.filter_value,
                sort_order: dataSource.sort_order ?? 'asc',
              }
            : null,
        uiConfig: definition.ui_config ?? null,
        sort_order: definition.sort_order ?? 0,
        is_active: definition.is_active,
      };
    })
    .filter((definition): definition is ITemplateVariableDefinitionConfig => definition !== null);
}

export function setTemplateVariableDefinitions(
  definitions?: Array<ITemplateVariableDefinition | ITemplateVariableDefinitionConfig> | null,
) {
  if (!Array.isArray(definitions)) {
    templateVariableDefinitionsCache = [];
    return;
  }

  const alreadyNormalized = definitions.every((definition) => 'inputType' in definition);
  templateVariableDefinitionsCache = alreadyNormalized
    ? (definitions as ITemplateVariableDefinitionConfig[])
    : normalizeTemplateVariableDefinitions(definitions as ITemplateVariableDefinition[]);
}

export function getTemplateVariableDefinitions(): ITemplateVariableDefinitionConfig[] {
  return templateVariableDefinitionsCache;
}

export function templateVariableMatchesTemplateType(
  definition: Pick<ITemplateVariableDefinitionConfig, 'templateTypes'>,
  template_type?: string | null,
): boolean {
  if (!template_type) {
    return true;
  }

  return definition.templateTypes.length === 0 || definition.templateTypes.includes(template_type);
}

export function getTemplateVariableDefinitionByKey(
  key: string,
  template_type?: string | null,
): ITemplateVariableDefinitionConfig | undefined {
  return templateVariableDefinitionsCache.find(
    (definition) => definition.key === key && templateVariableMatchesTemplateType(definition, template_type),
  );
}

export function getTemplateVariableTableTemplateByKey(
  key: string,
  template_type?: string | null,
): TableTemplate | undefined {
  const definition = getTemplateVariableDefinitionByKey(key, template_type);
  const tableTemplate = definition?.uiConfig?.table_template;

  return definition?.variableType === 'TABLE_VARIABLE' && isTableTemplateConfig(tableTemplate)
    ? tableTemplate
    : undefined;
}

export function getTemplateVariableDocumentTemplateByKey(
  key: string,
  template_type?: string | null,
): DocumentTemplate | undefined {
  const definition = getTemplateVariableDefinitionByKey(key, template_type);
  const documentTemplate = definition?.uiConfig?.document_template;

  return definition?.variableType === 'DOCUMENT_VARIABLE' && isDocumentTemplateConfig(documentTemplate)
    ? documentTemplate
    : undefined;
}

const collectTableTemplatesFromDefinitions = (
  definitions: ITemplateVariableDefinitionConfig[],
  tableTemplates: TableTemplate[],
) => {
  const templateMap = new Map<string, TableTemplate>();

  [...tableTemplates, ...definitions.map((definition) => definition.uiConfig?.table_template)]
    .filter(isTableTemplateConfig)
    .forEach((tableTemplate) => {
      if (!templateMap.has(tableTemplate.id)) {
        templateMap.set(tableTemplate.id, tableTemplate);
      }
    });

  return Array.from(templateMap.values());
};

const collectDocumentTemplatesFromDefinitions = (
  definitions: ITemplateVariableDefinitionConfig[],
  documentTemplates: DocumentTemplate[],
) => {
  const templateMap = new Map<string, DocumentTemplate>();

  [...documentTemplates, ...definitions.map((definition) => definition.uiConfig?.document_template)]
    .filter(isDocumentTemplateConfig)
    .forEach((documentTemplate) => {
      if (!templateMap.has(documentTemplate.id)) {
        templateMap.set(documentTemplate.id, documentTemplate);
      }
    });

  return Array.from(templateMap.values());
};

export function normalizeEditorMeta(payload: EditorMetaPayload) {
  const variable_definitions = normalizeTemplateVariableDefinitions(payload.variable_definitions);

  return {
    schema_field_catalog: payload.schema_field_catalog,
    source_schema_field_catalog: payload.source_schema_field_catalog,
    foreign_key_meta: payload.foreign_key_meta,
    table_templates: collectTableTemplatesFromDefinitions(variable_definitions, payload.table_templates),
    document_templates: collectDocumentTemplatesFromDefinitions(variable_definitions, payload.document_templates),
    variable_definitions,
  };
}
