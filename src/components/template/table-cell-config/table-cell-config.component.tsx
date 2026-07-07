'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button, Input, SearchableSelect } from 'reactjs-platform/ui';
import { getTemplateJoinedRowAPI, getTemplateTableOptionsAPI } from 'api';
import type { TableTemplate } from '../../../lib';
import { TableStructureEditor } from '../table-structure-editor';
import '../../../styles/TableCellConfig.css';

export interface ITableCellConfigProps {
  template: TableTemplate;
  varValues: Record<string, any>;
  onVarValuesChange: (updates: Record<string, any>) => void;
  onTemplateChange?: (template: TableTemplate) => void;
  inlineEdit?: boolean;
  hideLabelFieldSelector?: boolean;
}

/**
 * Component for configuring table cells
 * Two modes: Structure Editor (Excel-like) and Value Editor (variable mapping)
 */
export const TableCellConfig = ({
  template,
  varValues,
  onVarValuesChange,
  onTemplateChange,
  inlineEdit = false,
  hideLabelFieldSelector = false,
}: ITableCellConfigProps) => {
  const [activeCell, setActiveCell] = useState<any>(null);
  const [editingValue, setEditingValue] = useState('');
  const [dropdownState, setDropdownState] = useState<{
    options: any[];
    error: string | null;
    loading: boolean;
  }>({
    options: [],
    error: null,
    loading: false,
  });
  const [relatedRowData, setRelatedRowData] = useState<any>(null);
  const [activeBlock, setActiveBlock] = useState<string | null>(null);

  const handleCellClick = (
    rowIdx: number,
    key: string,
    _row: any,
    blockId: string | null = null,
    rowIdxInBlock: number | null = null,
  ) => {
    const cellKey = `${key}_${rowIdx + 1}`;
    const headers = template?.structure?.headers || [];
    const header = headers?.find((h) => h.key === key);
    const cellData = _row?.[key];
    const cellTableField =
      typeof cellData === 'object' && cellData !== null && 'table_field' in cellData ? cellData.table_field : null;
    const tableField = cellTableField || header?.table_field || null;
    const referenceTable =
      typeof cellData === 'object' && cellData !== null && 'reference_table' in cellData
        ? cellData.reference_table
        : header?.reference_table;
    const referenceField =
      typeof cellData === 'object' && cellData !== null && 'reference_field' in cellData
        ? cellData.reference_field
        : header?.reference_field;
    const cellLabelField =
      typeof cellData === 'object' && cellData !== null && 'label_field' in cellData ? cellData.label_field : null;
    const labelField =
      typeof cellLabelField === 'string' && cellLabelField.trim() ? cellLabelField : header?.label_field;
    const cellValue =
      typeof cellData === 'object' && cellData !== null && 'value' in cellData ? cellData.value : cellData;

    setActiveCell({
      rowIdx,
      key,
      cellKey,
      table_field: tableField,
      blockId,
      rowIdxInBlock,
      reference_table: referenceTable,
      reference_field: referenceField,
      label_field: labelField,
    });
    setActiveBlock(blockId);
    setEditingValue(varValues[`{{${cellKey}}}`] || (cellValue == null ? '' : String(cellValue)));
    setDropdownState({ options: [], error: null, loading: false });
    setRelatedRowData(null);
  };

  const headerReference = activeCell?.reference_table;
  const headerRefField = activeCell?.reference_field;

  let collectionName: string | null = null;
  let fieldName: string | null = null;

  if (headerReference && headerRefField) {
    collectionName = headerReference;
    fieldName = headerRefField;
  } else if (activeCell?.table_field) {
    collectionName = activeCell.table_field.split('.')[0] || null;
    fieldName = activeCell.table_field.split('.')[1] || 'name';
  }

  const isDropdown = activeCell?.table_field != null && activeCell?.table_field !== '';

  const fetch_config = activeBlock
    ? template?.structure?.blocks?.find((b: any) => b.id === activeBlock)?.row_fetch_config
    : null;

  const isTriggerField = fetch_config?.trigger_field === activeCell?.key;
  const triggerFieldName =
    typeof fetch_config?.trigger_value_field === 'string' && fetch_config.trigger_value_field.trim()
      ? fetch_config.trigger_value_field.trim()
      : activeCell?.table_field?.split('.')[1] || 'code';

  const toField = Array.isArray(fetch_config?.join_conditions) ? fetch_config.join_conditions[0]?.to_field : undefined;

  useEffect(() => {
    if (!isDropdown || !collectionName || !fieldName) {
      return;
    }
    let cancelled = false;
    setDropdownState({ options: [], error: null, loading: true });

    void getTemplateTableOptionsAPI({
      table: collectionName,
      field_name: fieldName,
      sort_order: 'asc',
      label_field: activeCell.label_field,
    })
      .then((items) => {
        if (cancelled) return;
        const options = items.filter((item) => item.value).sort((a, b) => (a.label || '').localeCompare(b.label || ''));
        setDropdownState({ options, error: null, loading: false });
      })
      .catch(() => {
        if (cancelled) return;
        setDropdownState({
          options: [],
          error: `Không tải được dữ liệu ${collectionName}`,
          loading: false,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [isDropdown, collectionName, fieldName, activeCell?.label_field]);

  useEffect(() => {
    if (
      !(
        isTriggerField &&
        editingValue &&
        fetch_config &&
        fetch_config.primary_table &&
        fetch_config.join_table &&
        toField
      )
    ) {
      return;
    }

    let cancelled = false;
    const joinConditions = Array.isArray(fetch_config.join_conditions) ? fetch_config.join_conditions : [];

    void getTemplateJoinedRowAPI({
      trigger_table: fetch_config.primary_table,
      trigger_field: triggerFieldName,
      trigger_value: editingValue,
      join_table: fetch_config.join_table,
      to_field: toField,
      join_conditions: joinConditions.length > 0 ? joinConditions : undefined,
    })
      .then((data) => {
        if (!cancelled) {
          setRelatedRowData(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRelatedRowData(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [editingValue, fetch_config, isTriggerField, toField, triggerFieldName]);

  const handleSaveCell = () => {
    if (activeCell) {
      const varKey = `{{${activeCell.cellKey}}}`;
      const updates: Record<string, any> = { [varKey]: editingValue };

      if (isTriggerField && relatedRowData && Array.isArray(fetch_config?.fields_to_fetch)) {
        fetch_config.fields_to_fetch.forEach((fieldConfig: any) => {
          let fieldValue = null;
          if (fieldConfig.table === fetch_config.primary_table) {
            fieldValue = relatedRowData.primary?.[fieldConfig.field];
          } else if (fieldConfig.table === fetch_config.join_table && relatedRowData?.joined?.length > 0) {
            fieldValue = relatedRowData.joined[0][fieldConfig.field];
          }

          if (fieldValue !== undefined && fieldValue !== null) {
            const targetCellKey = `{{${fieldConfig.key}_${activeCell.rowIdx + 1}}}`;
            updates[targetCellKey] = fieldValue;
          }
        });
      }

      onVarValuesChange(updates);
      setActiveCell(null);
      setRelatedRowData(null);
    }
  };

  const handleDeleteCell = () => {
    if (activeCell) {
      const varKey = `{{${activeCell.cellKey}}}`;
      onVarValuesChange({ [varKey]: '' }); // Treat clearing as empty update
      setActiveCell(null);
    }
  };

  const { headers } = template.structure;
  const leafHeaders = headers.filter((header: any) => !header.is_parent_header);
  const rows: any[] = [...(template.structure.rows || [])];
  const rowMetadata: Record<number, any> = {};

  if (rows.length === 0) {
    let flatIdx = 0;
    template.structure.blocks?.forEach((block: any) => {
      block.rows?.forEach((row: any, rowIdxInBlock: number) => {
        rows.push(row);
        rowMetadata[flatIdx] = { blockId: block.id, rowIdxInBlock };
        flatIdx++;
      });
    });
  }

  const parentHeaderMap = new Map();
  const midParentHeaderMap = new Map();
  headers.forEach((h: any) => {
    if (h.is_parent_header && !h.parent) parentHeaderMap.set(h.key, h);
    if (h.is_parent_header && h.parent) midParentHeaderMap.set(h.key, h);
  });
  const hasGrandchildren = midParentHeaderMap.size > 0;
  const headerDepth = hasGrandchildren ? 3 : parentHeaderMap.size > 0 ? 2 : 1;

  if (onTemplateChange) {
    return (
      <TableStructureEditor
        tableTemplate={template}
        onTableTemplateChange={onTemplateChange}
        inlineEditMode={inlineEdit}
        hideLabelFieldSelector={hideLabelFieldSelector}
      />
    );
  }

  return (
    <div className="table-cell-config">
      <div className="cell-config-header">
        <h4>🔧 Cấu hình ô trong bảng</h4>
        <p className="cell-config-hint">Bấm vào ô bất kỳ để chỉnh giá trị</p>
      </div>

      <div className="cell-config-table-wrapper">
        <table className="cell-config-table">
          <thead>
            {parentHeaderMap.size > 0 && (
              <tr className="parent-header-row">
                {headers.map((h: any) => {
                  if (h.is_parent_header && !h.parent) {
                    return (
                      <th
                        key={h.key}
                        colSpan={h.colspan || 1}
                        className="parent-header"
                        style={{
                          width: h.width,
                          backgroundColor: h.background_color,
                        }}>
                        {h.label}
                      </th>
                    );
                  } else if (!h.parent && !h.is_parent_header) {
                    return (
                      <th
                        key={h.key}
                        className="placeholder-header"
                        rowSpan={h.rowspan || headerDepth}
                        style={{
                          width: h.width,
                          backgroundColor: h.background_color,
                        }}>
                        {h.label}
                      </th>
                    );
                  }
                  return null;
                })}
              </tr>
            )}
            {hasGrandchildren && (
              <tr className="mid-header-row">
                {headers.map((h: any) => {
                  if (h.parent && !h.is_parent_header && parentHeaderMap.has(h.parent) && (h.rowspan || 0) >= 2) {
                    return (
                      <th
                        key={h.key}
                        rowSpan={h.rowspan || 1}
                        style={{
                          width: h.width,
                          backgroundColor: h.background_color,
                        }}>
                        {h.label}
                      </th>
                    );
                  }
                  if (h.is_parent_header && h.parent) {
                    return (
                      <th
                        key={h.key}
                        colSpan={h.colspan || 1}
                        className="parent-header"
                        style={{
                          width: h.width,
                          backgroundColor: h.background_color,
                        }}>
                        {h.label}
                      </th>
                    );
                  }
                  return null;
                })}
              </tr>
            )}
            <tr className="child-header-row">
              {headers.map((h: any) => {
                if (h.is_parent_header) return null;
                if (hasGrandchildren && h.rowspan && h.rowspan >= 2 && parentHeaderMap.has(h.parent)) {
                  return null;
                }
                if (!h.parent) {
                  if (parentHeaderMap.size > 0) return null;
                  return (
                    <th
                      key={h.key}
                      style={{
                        width: h.width,
                        backgroundColor: h.background_color,
                      }}>
                      {h.label}
                    </th>
                  );
                }
                return (
                  <th
                    key={h.key}
                    style={{
                      width: h.width,
                      backgroundColor: h.background_color,
                    }}>
                    {h.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 6).map((row, rowIdx) => {
              const metadata = rowMetadata[rowIdx];
              const blockId = metadata?.blockId || null;
              const rowIdxInBlock = metadata?.rowIdxInBlock || rowIdx;

              return (
                <tr key={rowIdx}>
                  {leafHeaders.map((h: any) => {
                    const cellKey = `{{${h.key}_${rowIdx + 1}}}`;
                    const cellValue = varValues[cellKey] || '';
                    const is_active = activeCell?.cellKey === `${h.key}_${rowIdx + 1}`;
                    const cellData = row?.[h.key];
                    const cellTableField =
                      typeof cellData === 'object' && cellData !== null && 'table_field' in cellData
                        ? cellData.table_field
                        : null;
                    const tableField = cellTableField || h.table_field || null;
                    const isReadOnly =
                      (typeof cellData === 'object' && cellData !== null && (cellData as any).is_read_only) ||
                      h.read_only;
                    const hasFetchField = tableField != null && tableField !== '';

                    if (inlineEdit && !hasFetchField && !isReadOnly) {
                      return (
                        <td key={h.key} className={`config-cell ${cellValue ? 'filled' : ''}`}>
                          <input
                            type="text"
                            value={cellValue}
                            onChange={(e) => onVarValuesChange({ [cellKey]: e.target.value })}
                            placeholder={h.key}
                            style={{
                              width: '100%',
                              border: 'none',
                              outline: 'none',
                              background: 'transparent',
                              fontSize: 'inherit',
                              padding: '2px 4px',
                            }}
                          />
                        </td>
                      );
                    }

                    return (
                      <td
                        key={h.key}
                        className={`config-cell ${is_active ? 'active' : ''} ${cellValue ? 'filled' : ''}`}
                        onClick={() => handleCellClick(rowIdx, h.key, row, blockId, rowIdxInBlock)}>
                        <div className="cell-content">
                          {cellValue || <span className="cell-placeholder">{h.key}</span>}
                        </div>
                        {is_active && <div className="cell-indicator">✎</div>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {activeCell && (
        <div className="cell-editor">
          <div className="cell-editor-header">
            <h5>
              Chỉnh sửa: <code>{headers.find((h: any) => h.key === activeCell.key)?.label}</code>
              <span className="cell-position"> (Dòng {activeCell.rowIdx + 1})</span>
            </h5>
            <Button variant="ghost" size="icon" onClick={() => setActiveCell(null)}>
              <X className="size-4" />
            </Button>
          </div>

          <div className="cell-editor-content">
            <div className="editor-input-group">
              {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
              <label>Giá trị ô</label>

              {dropdownState.error && <div className="dropdown-error">⚠️ {dropdownState.error}</div>}

              {isDropdown ? (
                <SearchableSelect
                  value={editingValue || undefined}
                  onValueChange={(val) => setEditingValue(val)}
                  options={dropdownState.options.map((o) => ({ value: o.value, label: o.label }))}
                  loading={dropdownState.loading}
                  placeholder={dropdownState.loading ? 'Đang tải lựa chọn...' : '-- Chọn giá trị --'}
                  clearable
                />
              ) : (
                <Input
                  type="text"
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  placeholder="Nhập giá trị..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveCell();
                    if (e.key === 'Escape') setActiveCell(null);
                  }}
                />
              )}
            </div>

            <div className="cell-editor-actions">
              <Button variant="outline" onClick={() => setActiveCell(null)}>
                Hủy
              </Button>
              <Button variant="destructive" onClick={handleDeleteCell} className="ml-auto">
                Xóa nội dung
              </Button>
              <Button onClick={handleSaveCell}>Lưu</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
