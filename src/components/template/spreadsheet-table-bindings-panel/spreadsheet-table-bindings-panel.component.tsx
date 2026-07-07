'use client';

import { Plus, Rows3, Table2, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { Button, Input, SearchableSelect } from 'reactjs-platform/ui';
import {
  getTemplateVariableDefinitions,
  getTemplateVariableTableTemplateByKey,
  templateVariableMatchesTemplateType,
  type TableTemplate,
} from '../../../lib';
import type {
  ISpreadsheetTableBinding,
  ISpreadsheetTableBindingColumn,
  ISpreadsheetTableBindingsPanelProps,
} from './spreadsheet-table-bindings-panel.type';

const COLUMN_NAME_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const createLocalId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const normalizePositiveInteger = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
};

const normalizeColumnName = (value: unknown) =>
  String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 3);

const getLeafHeaderOptions = (tableTemplate?: TableTemplate) =>
  (tableTemplate?.structure?.headers ?? [])
    .filter((header) => !header.is_parent_header && typeof header.key === 'string' && header.key.trim())
    .map((header) => ({
      value: header.key,
      label: header.label?.trim() ? `${header.label} (${header.key})` : header.key,
    }));

const buildDefaultColumns = (variableKey: string, template_type?: string | null): ISpreadsheetTableBindingColumn[] => {
  const tableTemplate = getTemplateVariableTableTemplateByKey(variableKey, template_type);
  const leafHeaders = getLeafHeaderOptions(tableTemplate);

  return leafHeaders.slice(0, COLUMN_NAME_ALPHABET.length).map((header, index) => ({
    id: createLocalId('spreadsheet-column'),
    column: COLUMN_NAME_ALPHABET[index],
    field_key: header.value,
  }));
};

const createBinding = (template_type?: string | null): ISpreadsheetTableBinding => ({
  id: createLocalId('spreadsheet-binding'),
  name: '',
  variable_key: '',
  sheet: '',
  start_row: 1,
  end_row: 1,
  subsection_template_row: null,
  data_template_row: 1,
  columns: buildDefaultColumns('', template_type),
});

const normalizeBindingColumn = (value: unknown): ISpreadsheetTableBindingColumn => {
  const record = asRecord(value);

  return {
    id: typeof record.id === 'string' && record.id.trim() ? record.id : createLocalId('spreadsheet-column'),
    column: normalizeColumnName(record.column),
    field_key: typeof record.field_key === 'string' ? record.field_key : '',
  };
};

const normalizeBinding = (value: unknown): ISpreadsheetTableBinding => {
  const record = asRecord(value);

  return {
    id: typeof record.id === 'string' && record.id.trim() ? record.id : createLocalId('spreadsheet-binding'),
    name: typeof record.name === 'string' ? record.name : '',
    variable_key: typeof record.variable_key === 'string' ? record.variable_key : '',
    sheet: typeof record.sheet === 'string' ? record.sheet : '',
    start_row: normalizePositiveInteger(record.start_row, 1),
    end_row: normalizePositiveInteger(record.end_row, 1),
    subsection_template_row:
      record.subsection_template_row === null || record.subsection_template_row === undefined
        ? null
        : normalizePositiveInteger(record.subsection_template_row, 1),
    data_template_row: normalizePositiveInteger(record.data_template_row, 1),
    columns: Array.isArray(record.columns) ? record.columns.map(normalizeBindingColumn) : [],
  };
};

const getSpreadsheetTableBindings = (artifactConfig?: unknown) => {
  const record = asRecord(artifactConfig);
  return Array.isArray(record.spreadsheet_table_bindings)
    ? record.spreadsheet_table_bindings.map(normalizeBinding)
    : [];
};

const updateSpreadsheetTableBindings = (
  artifactConfig: unknown,
  bindings: ISpreadsheetTableBinding[],
): Record<string, unknown> => {
  const record = asRecord(artifactConfig);
  return {
    ...record,
    spreadsheet_table_bindings: bindings,
  };
};

export const SpreadsheetTableBindingsPanel = ({
  artifactConfig,
  readOnly = false,
  template_type,
  onChange,
}: ISpreadsheetTableBindingsPanelProps) => {
  const bindings = useMemo(() => getSpreadsheetTableBindings(artifactConfig), [artifactConfig]);
  const tableVariableOptions = useMemo(
    () =>
      getTemplateVariableDefinitions()
        .filter(
          (definition) =>
            definition.variableType === 'TABLE_VARIABLE' &&
            definition.is_active &&
            templateVariableMatchesTemplateType(definition, template_type),
        )
        .map((definition) => ({
          value: definition.key,
          label: `${definition.label} (${definition.key})`,
        }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [template_type],
  );

  const commitBindings = (nextBindings: ISpreadsheetTableBinding[]) => {
    onChange?.(updateSpreadsheetTableBindings(artifactConfig, nextBindings));
  };

  const updateBinding = (bindingId: string, patch: Partial<ISpreadsheetTableBinding>) => {
    commitBindings(bindings.map((binding) => (binding.id === bindingId ? { ...binding, ...patch } : binding)));
  };

  const updateBindingColumn = (bindingId: string, columnId: string, patch: Partial<ISpreadsheetTableBindingColumn>) => {
    commitBindings(
      bindings.map((binding) =>
        binding.id === bindingId
          ? {
              ...binding,
              columns: binding.columns.map((column) =>
                column.id === columnId
                  ? {
                      ...column,
                      ...patch,
                      ...(patch.column !== undefined ? { column: normalizeColumnName(patch.column) } : {}),
                    }
                  : column,
              ),
            }
          : binding,
      ),
    );
  };

  const addBinding = () => {
    commitBindings([...bindings, createBinding(template_type)]);
  };

  const removeBinding = (bindingId: string) => {
    commitBindings(bindings.filter((binding) => binding.id !== bindingId));
  };

  const addBindingColumn = (bindingId: string) => {
    commitBindings(
      bindings.map((binding) =>
        binding.id === bindingId
          ? {
              ...binding,
              columns: [
                ...binding.columns,
                {
                  id: createLocalId('spreadsheet-column'),
                  column: '',
                  field_key: '',
                },
              ],
            }
          : binding,
      ),
    );
  };

  const removeBindingColumn = (bindingId: string, columnId: string) => {
    commitBindings(
      bindings.map((binding) =>
        binding.id === bindingId
          ? {
              ...binding,
              columns: binding.columns.filter((column) => column.id !== columnId),
            }
          : binding,
      ),
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900">
        <div className="flex items-start gap-2">
          <Table2 className="mt-0.5 size-4 shrink-0 text-emerald-700" />
          <div>
            <div className="font-semibold">Spreadsheet table bindings</div>
            <p className="mt-1 text-[13px] leading-5 text-emerald-800/80">
              Mỗi binding thay cả một dải row trong sheet Excel bằng dữ liệu của một `table_template.*`. Các biến lẻ
              ngoài bảng vẫn dùng cách cũ.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-slate-500">
          {bindings.length > 0 ? `${bindings.length} table binding` : 'Chưa có table binding nào'}
        </div>
        <Button type="button" size="sm" onClick={addBinding} disabled={readOnly}>
          <Plus className="size-4" />
          Add binding
        </Button>
      </div>

      {bindings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
          Dùng khi một vùng row trong file Excel cần render từ bảng động thay vì gán từng placeholder riêng.
        </div>
      ) : null}

      {bindings.map((binding, bindingIndex) => {
        const selectedTableTemplate = getTemplateVariableTableTemplateByKey(binding.variable_key, template_type);
        const tableFieldOptions = getLeafHeaderOptions(selectedTableTemplate);

        return (
          <div key={binding.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Rows3 className="size-4 text-emerald-600" />
                  Table binding {bindingIndex + 1}
                </div>
                <p className="mt-1 text-[13px] text-slate-500">
                  Rows {binding.start_row} - {binding.end_row} trong sheet sẽ bị thay bằng các row flatten từ bảng đã
                  chọn.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={readOnly}
                onClick={() => removeBinding(binding.id)}
                className="text-red-600 hover:bg-red-50">
                <Trash2 className="size-4" />
              </Button>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Tên binding</span>
                <Input
                  value={binding.name}
                  disabled={readOnly}
                  placeholder="Bảng học phần HK3"
                  onChange={(event) => updateBinding(binding.id, { name: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Biến bảng</span>
                <SearchableSelect
                  value={binding.variable_key}
                  options={tableVariableOptions}
                  clearable
                  placeholder="Chọn table_template.*"
                  searchPlaceholder="Tìm biến bảng"
                  emptyMessage="Không có biến bảng phù hợp"
                  onValueChange={(value) => {
                    const nextVariableKey = value ?? '';
                    const variableOption = tableVariableOptions.find((option) => option.value === nextVariableKey);
                    updateBinding(binding.id, {
                      variable_key: nextVariableKey,
                      name: binding.name.trim() ? binding.name : (variableOption?.label.split(' (')[0] ?? ''),
                      columns: nextVariableKey ? buildDefaultColumns(nextVariableKey, template_type) : [],
                    });
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Sheet</span>
                <Input
                  value={binding.sheet}
                  disabled={readOnly}
                  placeholder="ATTT_Cô Nga"
                  onChange={(event) => updateBinding(binding.id, { sheet: event.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">Start row</span>
                  <Input
                    type="number"
                    min={1}
                    value={binding.start_row}
                    disabled={readOnly}
                    onChange={(event) =>
                      updateBinding(binding.id, { start_row: normalizePositiveInteger(event.target.value, 1) })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">End row</span>
                  <Input
                    type="number"
                    min={1}
                    value={binding.end_row}
                    disabled={readOnly}
                    onChange={(event) =>
                      updateBinding(binding.id, { end_row: normalizePositiveInteger(event.target.value, 1) })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">Subsection row</span>
                  <Input
                    type="number"
                    min={1}
                    value={binding.subsection_template_row ?? ''}
                    disabled={readOnly}
                    placeholder="10"
                    onChange={(event) =>
                      updateBinding(binding.id, {
                        subsection_template_row: event.target.value
                          ? normalizePositiveInteger(event.target.value, 1)
                          : null,
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">Data row</span>
                  <Input
                    type="number"
                    min={1}
                    value={binding.data_template_row}
                    disabled={readOnly}
                    onChange={(event) =>
                      updateBinding(binding.id, { data_template_row: normalizePositiveInteger(event.target.value, 1) })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 border-t border-slate-100 pt-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Map cột Excel</div>
                  <div className="mt-1 text-[13px] text-slate-500">
                    Mỗi cột Excel lấy giá trị từ một field trong `table_template`.
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={readOnly}
                  onClick={() => addBindingColumn(binding.id)}>
                  <Plus className="size-4" />
                  Add column
                </Button>
              </div>

              <div className="space-y-3">
                {binding.columns.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                    Chọn biến bảng trước để hệ thống gợi ý map cột, hoặc thêm tay.
                  </div>
                ) : null}

                {binding.columns.map((column) => (
                  <div key={column.id} className="grid gap-3 lg:grid-cols-[120px_minmax(0,1fr)_auto]">
                    <Input
                      value={column.column}
                      disabled={readOnly}
                      placeholder="A"
                      onChange={(event) => updateBindingColumn(binding.id, column.id, { column: event.target.value })}
                    />
                    <SearchableSelect
                      value={column.field_key}
                      options={tableFieldOptions}
                      clearable
                      placeholder="Chọn field của bảng"
                      searchPlaceholder="Tìm field"
                      emptyMessage="Không có field để map"
                      onValueChange={(value) => updateBindingColumn(binding.id, column.id, { field_key: value ?? '' })}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={readOnly}
                      onClick={() => removeBindingColumn(binding.id, column.id)}
                      className="text-red-600 hover:bg-red-50">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
