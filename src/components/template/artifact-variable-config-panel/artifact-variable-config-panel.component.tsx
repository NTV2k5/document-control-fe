'use client';

import { Braces, Copy, ExternalLink, Search, Settings2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, Input } from 'reactjs-platform/ui';
import { useTranslation } from '../../../i18n';
import { getVariablePickerItems, type IVariablePickerItem } from '../../../lib';
import { extractArtifactVariableKeys, getArtifactCatalogVariableKeys, getArtifactTypeLabel } from '../artifact-editor';
import type { IArtifactVariableConfigPanelProps } from './artifact-variable-config-panel.type';

type TArtifactVariableFilter = 'used' | 'all';

const normalizeVariableKey = (value: string) =>
  value
    .replace(/^\s*\{\{\s*/, '')
    .replace(/\s*\}\}\s*$/, '')
    .trim();

const uniqueSortedKeys = (keys: string[]) =>
  Array.from(new Set(keys.map(normalizeVariableKey).filter(Boolean))).sort((a, b) => a.localeCompare(b));

const buildFallbackPickerItem = (key: string): IVariablePickerItem => {
  const [tableName, ...fieldParts] = key.split('.');
  const fieldName = fieldParts.join('.') || key;

  return {
    key,
    token: `{{${key}}}`,
    label: fieldName,
    groupKey: tableName || 'custom',
    groupLabel: tableName || 'Custom',
    scope: 'field',
    variableType: 'FIELD_VARIABLE',
    sourceTable: tableName || null,
    sourceTableLabel: tableName || null,
    searchText: key,
    subtitle: tableName || '',
    insertMode: 'inline',
    dataKind: 'text',
    dataLabel: 'Text',
    renderLabel: 'Inline text',
    renderHint: '',
  };
};

export const ArtifactVariableConfigPanel = ({
  artifactType,
  artifactConfig,
  variableCatalog = {},
  varsInDoc = [],
  values = {},
  template_type,
  readOnly = false,
  showVariableBrowser = true,
  onInsertVariable,
  onOpenVariablesWorkspace,
}: IArtifactVariableConfigPanelProps) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<TArtifactVariableFilter>('used');
  const [query, setQuery] = useState('');

  const configuredKeys = useMemo(
    () => uniqueSortedKeys([...extractArtifactVariableKeys(artifactConfig), ...varsInDoc]),
    [artifactConfig, varsInDoc],
  );
  const catalogKeys = useMemo(
    () => uniqueSortedKeys(getArtifactCatalogVariableKeys(variableCatalog)),
    [variableCatalog],
  );
  const allKeys = useMemo(() => uniqueSortedKeys([...configuredKeys, ...catalogKeys]), [catalogKeys, configuredKeys]);
  const pickerItemByKey = useMemo(() => {
    return new Map(getVariablePickerItems('', variableCatalog, { template_type, t }).map((item) => [item.key, item]));
  }, [template_type, t, variableCatalog]);

  const listKeys = filter === 'used' ? configuredKeys : allKeys;
  const normalizedQuery = query.trim().toLowerCase();
  const filteredKeys = useMemo(() => {
    if (!normalizedQuery) return listKeys;

    return listKeys.filter((key) => {
      const item = pickerItemByKey.get(key);
      const haystack = [key, item?.label, item?.groupLabel, item?.subtitle, item?.searchText]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [listKeys, normalizedQuery, pickerItemByKey]);

  const getPickerItem = (key: string) => pickerItemByKey.get(key) ?? buildFallbackPickerItem(key);

  const handleCopy = (key: string) => {
    void navigator.clipboard?.writeText(`{{${key}}}`);
  };

  const canInsert = Boolean(onInsertVariable) && !readOnly;
  const emptyMessage = filter === 'used' ? t('artifactVariableConfig.emptyUsed') : t('artifactVariableConfig.emptyAll');

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Settings2 className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900">
              {t('artifactVariableConfig.format', { format: getArtifactTypeLabel(artifactType) })}
            </div>
            <p className="mt-1 text-[13px] leading-5 text-slate-500">{t('artifactVariableConfig.description')}</p>
          </div>
        </div>
        {showVariableBrowser ? (
          <div className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
            <div className="rounded-lg bg-white px-2.5 py-2">
              <div className="font-semibold text-slate-900">{configuredKeys.length}</div>
              <div className="text-slate-500">{t('artifactVariableConfig.usedShort')}</div>
            </div>
            <div className="rounded-lg bg-white px-2.5 py-2">
              <div className="font-semibold text-slate-900">{allKeys.length}</div>
              <div className="text-slate-500">{t('artifactVariableConfig.availableShort')}</div>
            </div>
          </div>
        ) : null}
      </div>

      {showVariableBrowser ? (
        <>
          <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-[13px] font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => setFilter('used')}
              className={`rounded-lg px-2 py-2 transition ${
                filter === 'used' ? 'bg-white text-slate-950 shadow-sm' : 'hover:text-slate-900'
              }`}>
              {t('artifactVariableConfig.used')}
            </button>
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`rounded-lg px-2 py-2 transition ${
                filter === 'all' ? 'bg-white text-slate-950 shadow-sm' : 'hover:text-slate-900'
              }`}>
              {t('artifactVariableConfig.all')}
            </button>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('artifactVariableConfig.searchPlaceholder')}
              className="h-9 rounded-xl pl-9 text-sm"
            />
          </div>

          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {filteredKeys.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-[13px] text-slate-500">
                {emptyMessage}
              </div>
            ) : (
              filteredKeys.map((key) => {
                const item = getPickerItem(key);
                const value = values[key] ?? '';
                const configured = configuredKeys.includes(key);

                return (
                  <div key={key} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{item.label}</div>
                        <div className="mt-1 truncate font-mono text-[13px] text-slate-500">{`{{${key}}}`}</div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          configured ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                        {configured ? t('artifactVariableConfig.configured') : t('artifactVariableConfig.available')}
                      </span>
                    </div>

                    {value.trim() ? (
                      <div className="mt-2 truncate rounded-lg bg-slate-50 px-2 py-1.5 text-[13px] text-slate-600">
                        {value}
                      </div>
                    ) : null}

                    <div className="mt-3 flex items-center gap-2">
                      {canInsert ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onInsertVariable?.(item)}
                          className="h-8 flex-1 rounded-lg text-[13px]">
                          <Braces className="size-3.5" />
                          {t('artifactVariableConfig.insert')}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopy(key)}
                        className="h-8 rounded-lg px-2 text-[13px] text-slate-500">
                        <Copy className="size-3.5" />
                        {t('artifactVariableConfig.copy')}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : null}

      {artifactType === 'image_form' ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] leading-5 text-amber-700">
          {t('artifactVariableConfig.imageFormHint')}
        </p>
      ) : null}

      {onOpenVariablesWorkspace ? (
        <Button
          type="button"
          variant="outline"
          onClick={onOpenVariablesWorkspace}
          className="h-9 w-full rounded-xl text-sm">
          <ExternalLink className="size-3.5" />
          {t('artifactVariableConfig.openWorkspace')}
        </Button>
      ) : null}
    </div>
  );
};
