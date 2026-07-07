'use client';

import { useState } from 'react';
import { useTranslation } from '../../../i18n';
import '../../../styles/FieldSelectorModal.css';

export interface IFieldSelectorModalProps {
  /** Whether modal is open */
  open: boolean;
  /** Schema catalog from the template-data API */
  catalog: Record<string, string[]>;
  /** Callback when a field is selected */
  onSelect?: (table: string, field: string) => void;
  /** Callback when modal is closed */
  onClose?: () => void;
}

/**
 * Modal to select table + field in a 2-level hierarchy
 */
export const FieldSelectorModal = ({ open, catalog = {}, onSelect, onClose }: IFieldSelectorModalProps) => {
  const { t } = useTranslation();
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const tables = Object.keys(catalog);

  const handleTableSelect = (table: string) => {
    setSelectedTable(table);
  };

  const handleFieldSelect = (field: string) => {
    if (!selectedTable) return;
    onSelect?.(selectedTable, field);
    setSelectedTable(null);
  };

  const handleClose = () => {
    setSelectedTable(null);
    onClose?.();
  };

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') handleClose();
      }}>
      <div className="field-selector-modal" role="dialog" aria-modal="true" tabIndex={-1}>
        <div className="modal-header">
          <h3>{t('fieldSelector.title')}</h3>
          <button type="button" className="modal-close-btn" onClick={handleClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="selector-column">
            <h4>{t('fieldSelector.tables')}</h4>
            <div className="selector-list">
              {tables.map((table) => (
                <button
                  type="button"
                  key={table}
                  className={`selector-item ${selectedTable === table ? 'active' : ''}`}
                  onClick={() => handleTableSelect(table)}>
                  {table}
                </button>
              ))}
            </div>
          </div>

          {selectedTable && (
            <div className="selector-column">
              <h4>{t('fieldSelector.fieldsOf', { table: selectedTable })}</h4>
              <div className="selector-list">
                {(catalog[selectedTable] || []).map((field) => (
                  <button type="button" key={field} className="selector-item" onClick={() => handleFieldSelect(field)}>
                    {field}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
