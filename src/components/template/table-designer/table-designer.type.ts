import type { TTemplateVariableInputType } from 'api';
import type { ExactSchemaCatalog, TableTemplate, TableTemplateRow } from '../../../lib';

export type TTableBuilderBlockType = 'section' | 'rows';
export type TTableBuilderCalculationType = 'sum' | 'percent';

export interface ITableBuilderColumn {
  id: string;
  key: string;
  label: string;
  width?: string;
  input_type?: TTemplateVariableInputType;
  header_group_id?: string | null;
  table_field?: string | null;
  label_field?: string | null;
  computed_type?: TTableBuilderCalculationType | null;
  computed_from?: string[];
  read_only?: boolean;
  is_required?: boolean;
  background_color?: string;
  default_value?: string;
  raw_header?: Record<string, unknown>;
}

export interface ITableBuilderHeaderGroup {
  id: string;
  key: string;
  label: string;
  parent_group_id?: string | null;
  background_color?: string;
  raw_header?: Record<string, unknown>;
}

export interface ITableBuilderRowBlock {
  id: string;
  type: TTableBuilderBlockType;
  label: string;
  merge_column_key?: string | null;
  merge_colspan?: number;
  allow_add_row?: boolean;
  allow_copy_row?: boolean;
  allow_delete_row?: boolean;
  manual_fields?: string[];
  row_template?: Record<string, unknown> | null;
  rows?: TableTemplateRow[];
  subsection_values?: Record<string, unknown>;
  row_fetch_config?: Record<string, unknown> | null;
  raw_block?: Record<string, unknown>;
}

export interface ITableBuilderOptions {
  show_add_row_button?: boolean;
  show_copy_button?: boolean;
  show_delete_button?: boolean;
}

export interface ITableBuilderConfig {
  version: 1;
  id: string;
  name: string;
  description?: string;
  columns: ITableBuilderColumn[];
  header_groups: ITableBuilderHeaderGroup[];
  row_blocks: ITableBuilderRowBlock[];
  options: ITableBuilderOptions;
}

export type TTableDesignerSelection =
  | { type: 'table' }
  | { type: 'column'; id: string }
  | { type: 'group'; id: string }
  | { type: 'block'; id: string }
  | { type: 'row'; block_id: string; row_index: number };

export interface ITableDesignerChangePayload {
  tableBuilder: ITableBuilderConfig;
  tableTemplate: TableTemplate;
}

export interface ITableDesignerProps {
  tableTemplate: TableTemplate;
  tableBuilder?: ITableBuilderConfig | null;
  schemaCatalog: ExactSchemaCatalog;
  onChange: (payload: ITableDesignerChangePayload) => void;
}
