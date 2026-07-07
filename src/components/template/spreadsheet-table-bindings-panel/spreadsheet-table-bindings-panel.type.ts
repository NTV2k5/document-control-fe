export interface ISpreadsheetTableBindingColumn {
  id: string;
  column: string;
  field_key: string;
}

export interface ISpreadsheetTableBinding {
  id: string;
  name: string;
  variable_key: string;
  sheet: string;
  start_row: number;
  end_row: number;
  subsection_template_row?: number | null;
  data_template_row: number;
  columns: ISpreadsheetTableBindingColumn[];
}

export interface ISpreadsheetTableBindingsPanelProps {
  artifactConfig?: unknown;
  readOnly?: boolean;
  template_type?: string | null;
  onChange?: (config: unknown) => void;
}
