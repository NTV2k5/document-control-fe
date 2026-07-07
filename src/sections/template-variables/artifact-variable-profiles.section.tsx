import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FileImage,
  FileSpreadsheet,
  Image,
  Layers3,
  Loader2,
  Pencil,
  Plus,
  Presentation,
  RefreshCcw,
  Save,
  Table2,
  Trash2,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  SearchableMultiSelect,
  SearchableSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from 'reactjs-platform/ui';
import {
  createArtifactVariableProfileAPI,
  deleteArtifactVariableProfileAPI,
  listArtifactVariableProfilesAPI,
  listTemplateVariablesAPI,
  updateArtifactVariableProfileAPI,
  type IArtifactVariableBinding,
  type IArtifactVariableBindingColumn,
  type IArtifactVariableProfile,
  type TArtifactBindingKind,
  type TArtifactVariableProfileType,
} from 'api';
import { useTranslation } from '../../i18n';
import type {
  IArtifactVariableProfileFormState,
  IArtifactVariableProfilesSectionProps,
} from './template-variables.type';

type TProfileModalMode = 'create' | 'edit' | null;

const BINDING_KINDS: Record<TArtifactVariableProfileType, Array<{ value: TArtifactBindingKind; labelKey: string }>> = {
  spreadsheet: [
    { value: 'cell', labelKey: 'variables.management.artifactProfiles.kinds.cell' },
    { value: 'range', labelKey: 'variables.management.artifactProfiles.kinds.range' },
    { value: 'repeat_table', labelKey: 'variables.management.artifactProfiles.kinds.repeatTable' },
  ],
  presentation: [
    { value: 'slide_text', labelKey: 'variables.management.artifactProfiles.kinds.slideText' },
    { value: 'slide_image', labelKey: 'variables.management.artifactProfiles.kinds.slideImage' },
    { value: 'repeat_slide', labelKey: 'variables.management.artifactProfiles.kinds.repeatSlide' },
  ],
  image_form: [
    { value: 'overlay_text', labelKey: 'variables.management.artifactProfiles.kinds.overlayText' },
    { value: 'overlay_image', labelKey: 'variables.management.artifactProfiles.kinds.overlayImage' },
    { value: 'signature', labelKey: 'variables.management.artifactProfiles.kinds.signature' },
  ],
};

const createLocalId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const createBindingColumn = (): IArtifactVariableBindingColumn => ({
  id: createLocalId('column'),
  label: '',
  target: '',
  variable_key: '',
});

const createBinding = (artifactType: TArtifactVariableProfileType): IArtifactVariableBinding => {
  if (artifactType === 'spreadsheet') {
    return {
      id: createLocalId('binding'),
      name: '',
      kind: 'cell',
      sheet: 'Sheet1',
      target: 'A1',
      variable_key: '',
    };
  }

  if (artifactType === 'presentation') {
    return {
      id: createLocalId('binding'),
      name: '',
      kind: 'slide_text',
      slide: '1',
      target: '',
      variable_key: '',
    };
  }

  return {
    id: createLocalId('binding'),
    name: '',
    kind: 'overlay_text',
    page: '1',
    target: '',
    variable_key: '',
    x: 0,
    y: 0,
    width: 240,
    height: 40,
  };
};

const createEmptyForm = (artifactType: TArtifactVariableProfileType): IArtifactVariableProfileFormState => ({
  artifact_type: artifactType,
  name: '',
  description: '',
  template_types: [],
  config: {
    bindings: [createBinding(artifactType)],
  },
  is_active: true,
});

const normalizeProfileForm = (profile: IArtifactVariableProfile): IArtifactVariableProfileFormState => ({
  id: profile.id,
  artifact_type: profile.artifact_type,
  name: profile.name,
  description: profile.description ?? '',
  template_types: profile.template_types ?? [],
  config: {
    bindings: Array.isArray(profile.config?.bindings)
      ? profile.config.bindings.map((binding) => ({
          ...binding,
          id: binding.id || createLocalId('binding'),
          columns: binding.columns?.map((column) => ({
            ...column,
            id: column.id || createLocalId('column'),
          })),
        }))
      : [],
  },
  is_active: profile.is_active,
});

const isRepeatBinding = (kind: TArtifactBindingKind) => kind === 'repeat_table' || kind === 'repeat_slide';

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const ArtifactVariableProfilesSection = ({
  artifactType,
  schemaCatalog,
  templateTypeOptions,
}: IArtifactVariableProfilesSectionProps) => {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<IArtifactVariableProfile[]>([]);
  const [fieldVariableOptions, setFieldVariableOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<TProfileModalMode>(null);
  const [form, setForm] = useState<IArtifactVariableProfileFormState>(() => createEmptyForm(artifactType));
  const [deleteTarget, setDeleteTarget] = useState<IArtifactVariableProfile | null>(null);

  const artifactLabel = t(`variables.management.variableTypes.${artifactType}`);
  const bindingKinds = useMemo(
    () =>
      BINDING_KINDS[artifactType].map((option) => ({
        ...option,
        label: t(option.labelKey),
      })),
    [artifactType, t],
  );
  const sourceTableOptions = useMemo(
    () =>
      Object.keys(schemaCatalog)
        .sort((left, right) => left.localeCompare(right))
        .map((table) => ({ value: table, label: table })),
    [schemaCatalog],
  );
  const templateTypeLabelMap = useMemo(
    () => new Map(templateTypeOptions.map((option) => [option.value, option.label])),
    [templateTypeOptions],
  );

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextProfiles, fieldVariables] = await Promise.all([
        listArtifactVariableProfilesAPI({ artifact_type: artifactType }),
        listTemplateVariablesAPI({
          variable_type: 'FIELD_VARIABLE',
          is_active: true,
          page: 1,
          page_size: 1000,
        }),
      ]);
      setProfiles(nextProfiles);
      setFieldVariableOptions(
        fieldVariables.data.map((definition) => ({
          value: definition.key,
          label: `${definition.label} · {{${definition.key}}}`,
        })),
      );
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [artifactType]);

  useEffect(() => {
    setForm(createEmptyForm(artifactType));
    setModalMode(null);
    void loadProfiles();
  }, [artifactType, loadProfiles]);

  const openCreateModal = () => {
    setForm(createEmptyForm(artifactType));
    setModalMode('create');
  };

  const openEditModal = (profile: IArtifactVariableProfile) => {
    setForm(normalizeProfileForm(profile));
    setModalMode('edit');
  };

  const closeModal = () => {
    setModalMode(null);
    setForm(createEmptyForm(artifactType));
  };

  const updateBinding = (bindingId: string, patch: Partial<IArtifactVariableBinding>) => {
    setForm((current) => ({
      ...current,
      config: {
        bindings: current.config.bindings.map((binding) =>
          binding.id === bindingId ? { ...binding, ...patch } : binding,
        ),
      },
    }));
  };

  const changeBindingKind = (binding: IArtifactVariableBinding, kind: TArtifactBindingKind) => {
    const base = createBinding(artifactType);
    updateBinding(binding.id, {
      ...base,
      id: binding.id,
      name: binding.name,
      kind,
      columns:
        kind === 'repeat_table' ? (binding.columns?.length ? binding.columns : [createBindingColumn()]) : undefined,
    });
  };

  const removeBinding = (bindingId: string) => {
    setForm((current) => ({
      ...current,
      config: {
        bindings: current.config.bindings.filter((binding) => binding.id !== bindingId),
      },
    }));
  };

  const updateBindingColumn = (bindingId: string, columnId: string, patch: Partial<IArtifactVariableBindingColumn>) => {
    setForm((current) => ({
      ...current,
      config: {
        bindings: current.config.bindings.map((binding) =>
          binding.id === bindingId
            ? {
                ...binding,
                columns: (binding.columns ?? []).map((column) =>
                  column.id === columnId ? { ...column, ...patch } : column,
                ),
              }
            : binding,
        ),
      },
    }));
  };

  const addBindingColumn = (bindingId: string) => {
    setForm((current) => ({
      ...current,
      config: {
        bindings: current.config.bindings.map((binding) =>
          binding.id === bindingId
            ? { ...binding, columns: [...(binding.columns ?? []), createBindingColumn()] }
            : binding,
        ),
      },
    }));
  };

  const removeBindingColumn = (bindingId: string, columnId: string) => {
    setForm((current) => ({
      ...current,
      config: {
        bindings: current.config.bindings.map((binding) =>
          binding.id === bindingId
            ? { ...binding, columns: (binding.columns ?? []).filter((column) => column.id !== columnId) }
            : binding,
        ),
      },
    }));
  };

  const validateForm = () => {
    if (!form.name.trim()) {
      return t('variables.management.artifactProfiles.errors.missingName');
    }
    if (form.template_types.length === 0) {
      return t('variables.management.errors.missingTemplateType');
    }
    if (form.config.bindings.length === 0) {
      return t('variables.management.artifactProfiles.errors.missingBinding');
    }

    for (const binding of form.config.bindings) {
      if (!binding.name.trim()) {
        return t('variables.management.artifactProfiles.errors.missingBindingName');
      }
      if (isRepeatBinding(binding.kind)) {
        if (!binding.source_table) {
          return t('variables.management.artifactProfiles.errors.missingSourceTable');
        }
        if (
          binding.kind === 'repeat_table' &&
          (!binding.columns?.length ||
            binding.columns.some((column) => !column.target.trim() || !column.variable_key.trim()))
        ) {
          return t('variables.management.artifactProfiles.errors.invalidColumns');
        }
      } else if (!binding.variable_key) {
        return t('variables.management.artifactProfiles.errors.missingVariable');
      }
    }

    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        artifact_type: artifactType,
        name: form.name.trim(),
        description: form.description?.trim() || null,
        template_types: form.template_types,
        config: form.config,
        is_active: form.is_active,
      };

      if (form.id) {
        await updateArtifactVariableProfileAPI(form.id, payload);
      } else {
        await createArtifactVariableProfileAPI(payload);
      }
      closeModal();
      await loadProfiles();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setSaving(true);
    setError(null);
    try {
      await deleteArtifactVariableProfileAPI(deleteTarget.id);
      setDeleteTarget(null);
      await loadProfiles();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setSaving(false);
    }
  };

  const renderArtifactIcon = () => {
    if (artifactType === 'spreadsheet') return <FileSpreadsheet className="size-5 text-emerald-600" />;
    if (artifactType === 'presentation') return <Presentation className="size-5 text-orange-600" />;
    return <FileImage className="size-5 text-sky-600" />;
  };

  return (
    <>
      <div className="space-y-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-md border border-slate-200 bg-white">
              {renderArtifactIcon()}
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {t('variables.management.artifactProfiles.title', { type: artifactLabel })}
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                {t('variables.management.artifactProfiles.description')}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => void loadProfiles()} disabled={loading || saving}>
              <RefreshCcw className="size-4" />
              {t('variables.management.reload')}
            </Button>
            <Button type="button" onClick={openCreateModal} disabled={saving}>
              <Plus className="size-4" />
              {t('variables.management.artifactProfiles.addProfile')}
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <div className="rounded-md border border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
            {t('variables.management.artifactProfiles.loading')}
          </div>
        ) : profiles.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 px-6 py-12 text-center">
            <Layers3 className="mx-auto size-8 text-slate-400" />
            <div className="mt-3 text-sm font-semibold text-slate-800">
              {t('variables.management.artifactProfiles.emptyTitle')}
            </div>
            <div className="mt-1 text-sm text-slate-500">
              {t('variables.management.artifactProfiles.emptyDescription')}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
            {profiles.map((profile) => (
              <div key={profile.id} className="flex flex-wrap items-start justify-between gap-4 px-4 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{profile.name}</span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        profile.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                      {profile.is_active
                        ? t('variables.management.status.active')
                        : t('variables.management.status.inactive')}
                    </span>
                    <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {t('variables.management.artifactProfiles.bindingCount', {
                        count: profile.config.bindings?.length ?? 0,
                      })}
                    </span>
                  </div>
                  {profile.description && <p className="mt-1 text-sm text-slate-500">{profile.description}</p>}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {profile.template_types.map((templateType) => (
                      <span key={templateType} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">
                        {templateTypeLabelMap.get(templateType) ?? templateType}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label={t('variables.management.artifactProfiles.editProfile')}
                    title={t('variables.management.artifactProfiles.editProfile')}
                    onClick={() => openEditModal(profile)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!profile.is_active || saving}
                    aria-label={t('variables.management.artifactProfiles.deleteProfile')}
                    title={t('variables.management.artifactProfiles.deleteProfile')}
                    onClick={() => setDeleteTarget(profile)}
                    className="text-red-600 hover:bg-red-50">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={modalMode !== null}
        onOpenChange={(open) => {
          if (!open) closeModal();
        }}>
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {modalMode === 'edit'
                ? t('variables.management.artifactProfiles.editProfile')
                : t('variables.management.artifactProfiles.addProfile')}
            </DialogTitle>
            <DialogDescription>{t('variables.management.artifactProfiles.modalDescription')}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">
                {t('variables.management.artifactProfiles.profileName')}
              </span>
              <Input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder={t('variables.management.artifactProfiles.profileNamePlaceholder')}
              />
            </div>
            <div className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">{t('variables.management.form.templateTypes')}</span>
              <SearchableMultiSelect
                value={form.template_types}
                options={templateTypeOptions}
                placeholder={t('variables.management.form.chooseTemplateTypes')}
                searchPlaceholder={t('variables.management.form.searchTemplateTypes')}
                emptyMessage={t('variables.management.form.noTemplateTypes')}
                enableSelectAll
                selectAllLabel={t('variables.management.allTemplateTypes')}
                maxHeight="280px"
                maxDisplay={3}
                onValueChange={(values) => setForm((current) => ({ ...current, template_types: values }))}
              />
            </div>
            <div className="space-y-1.5 lg:col-span-2">
              <span className="text-sm font-medium text-slate-700">{t('variables.management.form.description')}</span>
              <Textarea
                rows={2}
                value={form.description ?? ''}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder={t('variables.management.artifactProfiles.descriptionPlaceholder')}
              />
            </div>
            <label className="flex items-center gap-3 text-sm font-medium text-slate-700 lg:col-span-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, is_active: checked }))}
              />
              {t('variables.management.artifactProfiles.activeProfile')}
            </label>
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-5">
            <div>
              <div className="text-sm font-semibold text-slate-900">
                {t('variables.management.artifactProfiles.bindings')}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {t('variables.management.artifactProfiles.bindingsDescription')}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  config: { bindings: [...current.config.bindings, createBinding(artifactType)] },
                }))
              }>
              <Plus className="size-4" />
              {t('variables.management.artifactProfiles.addBinding')}
            </Button>
          </div>

          <div className="space-y-4">
            {form.config.bindings.map((binding, bindingIndex) => (
              <div key={binding.id} className="rounded-md border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    {binding.kind === 'repeat_table' ? (
                      <Table2 className="size-4 text-emerald-600" />
                    ) : binding.kind === 'slide_image' || binding.kind === 'overlay_image' ? (
                      <Image className="size-4 text-sky-600" />
                    ) : (
                      <Layers3 className="size-4 text-[#174A86]" />
                    )}
                    {t('variables.management.artifactProfiles.bindingNumber', { index: bindingIndex + 1 })}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={form.config.bindings.length === 1}
                    onClick={() => removeBinding(binding.id)}
                    className="text-red-600 hover:bg-red-50">
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <div className="grid gap-4 p-4 lg:grid-cols-3">
                  <div className="space-y-1.5 lg:col-span-2">
                    <span className="text-sm font-medium text-slate-700">
                      {t('variables.management.artifactProfiles.bindingName')}
                    </span>
                    <Input
                      value={binding.name}
                      onChange={(event) => updateBinding(binding.id, { name: event.target.value })}
                      placeholder={t('variables.management.artifactProfiles.bindingNamePlaceholder')}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      {t('variables.management.artifactProfiles.bindingKind')}
                    </span>
                    <Select
                      value={binding.kind}
                      onValueChange={(value) => changeBindingKind(binding, value as TArtifactBindingKind)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {bindingKinds.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {artifactType === 'spreadsheet' && (
                    <div className="space-y-1.5">
                      <span className="text-sm font-medium text-slate-700">
                        {t('variables.management.artifactProfiles.sheet')}
                      </span>
                      <Input
                        value={binding.sheet ?? ''}
                        onChange={(event) => updateBinding(binding.id, { sheet: event.target.value })}
                        placeholder="Sheet1"
                      />
                    </div>
                  )}
                  {artifactType === 'presentation' && (
                    <div className="space-y-1.5">
                      <span className="text-sm font-medium text-slate-700">
                        {t('variables.management.artifactProfiles.slide')}
                      </span>
                      <Input
                        value={binding.slide ?? ''}
                        onChange={(event) => updateBinding(binding.id, { slide: event.target.value })}
                        placeholder="1"
                      />
                    </div>
                  )}
                  {artifactType === 'image_form' && (
                    <div className="space-y-1.5">
                      <span className="text-sm font-medium text-slate-700">
                        {t('variables.management.artifactProfiles.page')}
                      </span>
                      <Input
                        value={binding.page ?? ''}
                        onChange={(event) => updateBinding(binding.id, { page: event.target.value })}
                        placeholder="1"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      {t('variables.management.artifactProfiles.target')}
                    </span>
                    <Input
                      value={binding.target ?? ''}
                      onChange={(event) => updateBinding(binding.id, { target: event.target.value })}
                      placeholder={
                        artifactType === 'spreadsheet'
                          ? 'A1 / A2:H2'
                          : artifactType === 'presentation'
                            ? 'Shape name'
                            : 'Field name'
                      }
                    />
                  </div>

                  {isRepeatBinding(binding.kind) ? (
                    <div className="space-y-1.5">
                      <span className="text-sm font-medium text-slate-700">
                        {t('variables.management.artifactProfiles.sourceTable')}
                      </span>
                      <SearchableSelect
                        value={binding.source_table ?? ''}
                        options={sourceTableOptions}
                        clearable
                        placeholder={t('variables.management.artifactProfiles.chooseSourceTable')}
                        searchPlaceholder={t('variables.management.searchSourceTables')}
                        emptyMessage={t('variables.management.noSourceTables')}
                        onValueChange={(value) => updateBinding(binding.id, { source_table: value })}
                      />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <span className="text-sm font-medium text-slate-700">
                        {t('variables.management.artifactProfiles.variable')}
                      </span>
                      <SearchableSelect
                        value={binding.variable_key ?? ''}
                        options={fieldVariableOptions}
                        clearable
                        placeholder={t('variables.management.artifactProfiles.chooseVariable')}
                        searchPlaceholder={t('variables.management.artifactProfiles.searchVariable')}
                        emptyMessage={t('variables.management.artifactProfiles.noVariables')}
                        onValueChange={(value) => updateBinding(binding.id, { variable_key: value })}
                      />
                    </div>
                  )}

                  {artifactType === 'image_form' && (
                    <>
                      {(
                        [
                          ['x', 'X'],
                          ['y', 'Y'],
                          ['width', t('variables.management.artifactProfiles.width')],
                          ['height', t('variables.management.artifactProfiles.height')],
                        ] as const
                      ).map(([field, label]) => (
                        <div key={field} className="space-y-1.5">
                          <span className="text-sm font-medium text-slate-700">{label}</span>
                          <Input
                            type="number"
                            value={binding[field] ?? 0}
                            onChange={(event) => updateBinding(binding.id, { [field]: Number(event.target.value) })}
                          />
                        </div>
                      ))}
                    </>
                  )}
                </div>

                {binding.kind === 'repeat_table' && (
                  <div className="border-t border-slate-100 px-4 py-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">
                          {t('variables.management.artifactProfiles.columns')}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {t('variables.management.artifactProfiles.columnsDescription')}
                        </div>
                      </div>
                      <Button type="button" size="sm" variant="outline" onClick={() => addBindingColumn(binding.id)}>
                        <Plus className="size-4" />
                        {t('variables.management.artifactProfiles.addColumn')}
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {(binding.columns ?? []).map((column) => (
                        <div key={column.id} className="grid gap-3 lg:grid-cols-[1fr_160px_2fr_auto]">
                          <Input
                            value={column.label}
                            onChange={(event) =>
                              updateBindingColumn(binding.id, column.id, { label: event.target.value })
                            }
                            placeholder={t('variables.management.artifactProfiles.columnLabel')}
                          />
                          <Input
                            value={column.target}
                            onChange={(event) =>
                              updateBindingColumn(binding.id, column.id, { target: event.target.value })
                            }
                            placeholder="A"
                          />
                          <SearchableSelect
                            value={column.variable_key}
                            options={fieldVariableOptions}
                            clearable
                            placeholder={t('variables.management.artifactProfiles.chooseVariable')}
                            searchPlaceholder={t('variables.management.artifactProfiles.searchVariable')}
                            emptyMessage={t('variables.management.artifactProfiles.noVariables')}
                            onValueChange={(value) =>
                              updateBindingColumn(binding.id, column.id, { variable_key: value })
                            }
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={(binding.columns?.length ?? 0) <= 1}
                            onClick={() => removeBindingColumn(binding.id, column.id)}
                            className="text-red-600 hover:bg-red-50">
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeModal} disabled={saving}>
              {t('variables.management.cancel')}
            </Button>
            <Button type="button" onClick={() => void handleSubmit()} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {saving ? t('variables.management.saving') : t('variables.management.saveConfig')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('variables.management.artifactProfiles.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('variables.management.artifactProfiles.deleteDescription', { name: deleteTarget?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>{t('variables.management.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              className="bg-red-600 text-white hover:bg-red-700">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {saving ? t('variables.management.deleting') : t('variables.management.confirmSoftDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
