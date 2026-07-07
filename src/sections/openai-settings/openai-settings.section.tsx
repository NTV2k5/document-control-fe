import { Bot, Eye, EyeOff, KeyRound, Loader2, RefreshCcw, Save } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'reactjs-platform/ui';
import {
  DOCUMENT_INPUT_AGENT_SETTINGS_UPDATED_EVENT,
  getDocumentInputAgentSettingsAPI,
  updateDocumentInputAgentSettingsAPI,
  type IDocumentInputAgentSettings,
  type IUpdateDocumentInputAgentSettingsPayload,
  type TDocumentInputAgentReasoningEffort,
} from 'api';
import { canAccessTechRoot, profileStore } from 'reactjs-platform/utilities';
import { useTranslation } from '../../i18n';

const MASKED_API_KEY_VALUE = '********';
const DEFAULT_LLM_MODELS = [
  'gpt-5.5',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4',
  'openrouter/openai/gpt-5.4',
  'openrouter/openai/gpt-5.3-codex',
  'openrouter/qwen/qwen3.5-27b',
  'openrouter/qwen/qwen3.5-flash-02-23',
  'openrouter/qwen/qwen3.6-27b',
  'openrouter/qwen/qwen3.6-flash',
] as const;
const DEFAULT_LLM_MODEL = DEFAULT_LLM_MODELS[0];
const DEFAULT_REASONING_EFFORT: TDocumentInputAgentReasoningEffort = 'medium';
type TOpenAiSettingsDraft = {
  document_input_agent_enabled: boolean;
  document_input_agent_widget_enabled: boolean;
  template_agent_enabled: boolean;
  use_global_llm_config: boolean;
  model: string;
  reasoning_effort: TDocumentInputAgentReasoningEffort;
  open_ai_api_key: string;
  proxy_url_llm: string;
};

const formatLlmModelLabel = (model: string) => {
  if (model === 'gpt-5.5') return 'GPT-5.5';
  if (model === 'gpt-4.1') return 'GPT-4.1';
  if (model === 'gpt-4.1-mini') return 'GPT-4.1 Mini';
  if (model === 'gpt-4o') return 'GPT-4o';
  if (model === 'gpt-4o-mini') return 'GPT-4o Mini';
  if (model === 'gpt-4') return 'GPT-4';
  if (model === 'openrouter/openai/gpt-5.4') return 'GPT-5.4 (OpenRouter)';
  if (model === 'openrouter/openai/gpt-5.3-codex') return 'GPT-5.3 Codex (OpenRouter)';
  if (model === 'openrouter/qwen/qwen3.5-27b') return 'Qwen 3.5 27B';
  if (model === 'openrouter/qwen/qwen3.5-flash-02-23') return 'Qwen 3.5 Flash';
  if (model === 'openrouter/qwen/qwen3.6-27b') return 'Qwen 3.6 27B';
  if (model === 'openrouter/qwen/qwen3.6-flash') return 'Qwen 3.6 Flash';
  return model.split('/').at(-1) || model;
};

const formatErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return String(error);
};

export const OpenAiSettingsSection = () => {
  const { t } = useTranslation();
  const profile = profileStore((state) => state.profile);
  const hasTechRootAccess = canAccessTechRoot(profile);
  const [settings, setSettings] = useState<IDocumentInputAgentSettings | null>(null);
  const [draft, setDraft] = useState<TOpenAiSettingsDraft>({
    document_input_agent_enabled: true,
    document_input_agent_widget_enabled: true,
    template_agent_enabled: true,
    use_global_llm_config: true,
    model: DEFAULT_LLM_MODEL,
    reasoning_effort: DEFAULT_REASONING_EFFORT,
    open_ai_api_key: '',
    proxy_url_llm: '',
  });
  const [hasApiKeyDraftChanged, setHasApiKeyDraftChanged] = useState(false);
  const [showApiKeyDraft, setShowApiKeyDraft] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadSettings = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const nextSettings = await getDocumentInputAgentSettingsAPI();
      setSettings(nextSettings);
      setDraft({
        document_input_agent_enabled: nextSettings.document_input_agent_enabled,
        document_input_agent_widget_enabled: nextSettings.document_input_agent_widget_enabled,
        template_agent_enabled: nextSettings.template_agent_enabled,
        use_global_llm_config: nextSettings.use_global_llm_config,
        model: nextSettings.model,
        reasoning_effort: nextSettings.reasoning_effort,
        open_ai_api_key: nextSettings.open_ai_api_key.is_configured ? MASKED_API_KEY_VALUE : '',
        proxy_url_llm: nextSettings.proxy_url_llm.value,
      });
      setHasApiKeyDraftChanged(false);
      setShowApiKeyDraft(false);
    } catch (loadError) {
      setError(formatErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  const saveSettings = async () => {
    setError('');
    setSaving(true);
    try {
      const canManageGlobalSettings = Boolean(settings?.can_manage_global_settings ?? hasTechRootAccess);
      const canUpdateUserLlmConfig = Boolean(settings?.can_update_user_llm_config);
      const llmConfigScope = canManageGlobalSettings && draft.use_global_llm_config ? 'global' : 'user';
      const payload: IUpdateDocumentInputAgentSettingsPayload = canManageGlobalSettings
        ? {
            llm_config_scope: llmConfigScope,
            document_input_agent_enabled: draft.document_input_agent_enabled,
            document_input_agent_widget_enabled: draft.document_input_agent_widget_enabled,
            template_agent_enabled: draft.template_agent_enabled,
            use_global_llm_config: draft.use_global_llm_config,
            model: draft.model,
            reasoning_effort: draft.reasoning_effort,
            proxy_url_llm: draft.proxy_url_llm.trim(),
          }
        : {
            llm_config_scope: 'user',
            model: draft.model,
            reasoning_effort: draft.reasoning_effort,
            proxy_url_llm: draft.proxy_url_llm.trim(),
          };

      if (!canManageGlobalSettings && !canUpdateUserLlmConfig) {
        throw new Error(t('openAiSettings.errors.personalLlmNotAllowed'));
      }

      if (hasApiKeyDraftChanged) {
        payload.open_ai_api_key = draft.open_ai_api_key.trim();
      }

      const nextSettings = await updateDocumentInputAgentSettingsAPI(payload);
      setSettings(nextSettings);
      setDraft({
        document_input_agent_enabled: nextSettings.document_input_agent_enabled,
        document_input_agent_widget_enabled: nextSettings.document_input_agent_widget_enabled,
        template_agent_enabled: nextSettings.template_agent_enabled,
        use_global_llm_config: nextSettings.use_global_llm_config,
        model: nextSettings.model,
        reasoning_effort: nextSettings.reasoning_effort,
        open_ai_api_key: nextSettings.open_ai_api_key.is_configured ? MASKED_API_KEY_VALUE : '',
        proxy_url_llm: nextSettings.proxy_url_llm.value,
      });
      setHasApiKeyDraftChanged(false);
      setShowApiKeyDraft(false);
      window.dispatchEvent(
        new CustomEvent(DOCUMENT_INPUT_AGENT_SETTINGS_UPDATED_EVENT, {
          detail: nextSettings,
        }),
      );
    } catch (saveError) {
      setError(formatErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const canManageGlobalSettings = Boolean(settings?.can_manage_global_settings ?? hasTechRootAccess);
  const canUpdateUserLlmConfig = Boolean(settings?.can_update_user_llm_config);
  const canEditLlmConfig = canManageGlobalSettings || canUpdateUserLlmConfig;
  const credentialScope = canManageGlobalSettings && draft.use_global_llm_config ? 'global' : 'user';
  const credentialTitle =
    credentialScope === 'global'
      ? t('openAiSettings.credentialTitle.global')
      : t('openAiSettings.credentialTitle.user');
  const panelTitle = canManageGlobalSettings
    ? t('openAiSettings.panelTitle.manage')
    : canUpdateUserLlmConfig
      ? t('openAiSettings.panelTitle.userLlm')
      : t('openAiSettings.panelTitle.default');
  const readOnlyMessage = settings?.use_global_llm_config
    ? t('openAiSettings.readOnly.globalMode')
    : t('openAiSettings.readOnly.noPermission');
  const modelOptions = Array.from(
    new Set([draft.model, ...(settings?.model_options ?? []), ...DEFAULT_LLM_MODELS]),
  ).filter(Boolean);
  const reasoningEffortOptions = settings?.reasoning_effort_options.length
    ? settings.reasoning_effort_options
    : [DEFAULT_REASONING_EFFORT];
  const reasoningEffortLabels: Record<TDocumentInputAgentReasoningEffort, string> = {
    none: t('openAiSettings.reasoningEfforts.none'),
    minimal: t('openAiSettings.reasoningEfforts.minimal'),
    low: t('openAiSettings.reasoningEfforts.low'),
    medium: t('openAiSettings.reasoningEfforts.medium'),
    high: t('openAiSettings.reasoningEfforts.high'),
    xhigh: t('openAiSettings.reasoningEfforts.xhigh'),
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#0B2559]">{t('openAiSettings.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{panelTitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void loadSettings()} disabled={loading || saving}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
            {t('openAiSettings.actions.reload')}
          </Button>
          {canEditLlmConfig ? (
            <Button type="button" onClick={() => void saveSettings()} disabled={loading || saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {t('openAiSettings.actions.save')}
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <Tabs defaultValue="llm" className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6">
          <TabsList className="h-auto gap-1 bg-transparent p-0">
            <TabsTrigger
              value="llm"
              className="gap-2 rounded-none border-b-2 border-transparent bg-transparent px-4 py-4 text-sm font-medium text-slate-500 shadow-none data-[state=active]:border-[#002147] data-[state=active]:bg-transparent data-[state=active]:text-[#002147] data-[state=active]:shadow-none">
              <KeyRound className="size-4" />
              {t('openAiSettings.tabs.llm')}
            </TabsTrigger>
            {canManageGlobalSettings ? (
              <TabsTrigger
                value="agents"
                className="gap-2 rounded-none border-b-2 border-transparent bg-transparent px-4 py-4 text-sm font-medium text-slate-500 shadow-none data-[state=active]:border-[#002147] data-[state=active]:bg-transparent data-[state=active]:text-[#002147] data-[state=active]:shadow-none">
                <Bot className="size-4" />
                {t('openAiSettings.tabs.agents')}
              </TabsTrigger>
            ) : null}
          </TabsList>
        </div>

        <TabsContent value="llm" className="m-0 p-6">
          <section className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">{credentialTitle}</h2>
              {!canEditLlmConfig ? <p className="mt-1 text-sm leading-6 text-slate-500">{readOnlyMessage}</p> : null}
            </div>

            {canEditLlmConfig ? (
              <>
                {!canManageGlobalSettings ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    {canUpdateUserLlmConfig
                      ? t('openAiSettings.status.canConfigurePersonalLlm')
                      : t('openAiSettings.status.noEditableConfig')}
                  </div>
                ) : null}

                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="space-y-2">
                    <label
                      htmlFor="document-input-agent-open-ai-api-key"
                      className="text-sm font-semibold text-slate-900">
                      {t('openAiSettings.fields.apiKey')}
                    </label>
                    <div className="relative">
                      <Input
                        id="document-input-agent-open-ai-api-key"
                        type={showApiKeyDraft ? 'text' : 'password'}
                        value={draft.open_ai_api_key}
                        disabled={loading || saving || !canEditLlmConfig}
                        onChange={(event) => {
                          setHasApiKeyDraftChanged(true);
                          setDraft((current) => ({
                            ...current,
                            open_ai_api_key: event.target.value,
                          }));
                        }}
                        placeholder={t('openAiSettings.placeholders.apiKey')}
                        className="h-11 bg-white pr-11"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        onClick={() => setShowApiKeyDraft((current) => !current)}
                        disabled={loading || saving || !canEditLlmConfig}
                        title={
                          showApiKeyDraft
                            ? t('openAiSettings.actions.hideApiKey')
                            : t('openAiSettings.actions.showApiKey')
                        }>
                        {showApiKeyDraft ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    <div className="text-xs leading-5 text-slate-500">
                      {t('openAiSettings.help.maskedApiKey', { mask: MASKED_API_KEY_VALUE })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="document-input-agent-proxy-url-llm"
                      className="text-sm font-semibold text-slate-900">
                      {t('openAiSettings.fields.llmServerUrl')}
                    </label>
                    <Input
                      id="document-input-agent-proxy-url-llm"
                      value={draft.proxy_url_llm}
                      disabled={loading || saving || !canEditLlmConfig}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          proxy_url_llm: event.target.value,
                        }))
                      }
                      placeholder="https://llm.example.com/v1"
                      className="h-11 bg-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="document-input-agent-default-model"
                      className="text-sm font-semibold text-slate-900">
                      {t('openAiSettings.fields.defaultModel')}
                    </label>
                    <Select
                      value={draft.model}
                      onValueChange={(model) =>
                        setDraft((current) => ({
                          ...current,
                          model,
                        }))
                      }
                      disabled={loading || saving || !canEditLlmConfig}>
                      <SelectTrigger id="document-input-agent-default-model" className="h-11 w-full bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {modelOptions.map((model) => (
                          <SelectItem key={model} value={model} title={model}>
                            {formatLlmModelLabel(model)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs leading-5 text-slate-500">{t('openAiSettings.help.defaultModel')}</p>
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="document-input-agent-reasoning-effort"
                      className="text-sm font-semibold text-slate-900">
                      {t('openAiSettings.fields.reasoningEffort')}
                    </label>
                    <Select
                      value={draft.reasoning_effort}
                      onValueChange={(reasoningEffort: TDocumentInputAgentReasoningEffort) =>
                        setDraft((current) => ({
                          ...current,
                          reasoning_effort: reasoningEffort,
                        }))
                      }
                      disabled={loading || saving || !canEditLlmConfig}>
                      <SelectTrigger id="document-input-agent-reasoning-effort" className="h-11 w-full bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {reasoningEffortOptions.map((effort) => (
                          <SelectItem key={effort} value={effort}>
                            {reasoningEffortLabels[effort]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs leading-5 text-slate-500">{t('openAiSettings.help.reasoningEffort')}</p>
                  </div>
                </div>
              </>
            ) : null}
          </section>
        </TabsContent>

        {canManageGlobalSettings ? (
          <TabsContent value="agents" className="m-0 p-6">
            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="flex min-h-14 items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-sm font-semibold text-slate-900">
                  {t('openAiSettings.toggles.documentInputAgent')}
                </div>
                <Switch
                  checked={draft.document_input_agent_enabled}
                  disabled={loading || saving}
                  onCheckedChange={(checked) =>
                    setDraft((current) => ({
                      ...current,
                      document_input_agent_enabled: checked,
                    }))
                  }
                  aria-label={t('openAiSettings.aria.toggleDocumentInputAgent')}
                />
              </div>

              <div className="flex min-h-14 items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-sm font-semibold text-slate-900">
                  {t('openAiSettings.toggles.documentInputAgentWidget')}
                </div>
                <Switch
                  checked={draft.document_input_agent_widget_enabled}
                  disabled={loading || saving}
                  onCheckedChange={(checked) =>
                    setDraft((current) => ({
                      ...current,
                      document_input_agent_widget_enabled: checked,
                    }))
                  }
                  aria-label={t('openAiSettings.aria.toggleDocumentInputAgentWidget')}
                />
              </div>

              <div className="flex min-h-14 items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-sm font-semibold text-slate-900">{t('openAiSettings.toggles.templateAgent')}</div>
                <Switch
                  checked={draft.template_agent_enabled}
                  disabled={loading || saving}
                  onCheckedChange={(checked) =>
                    setDraft((current) => ({
                      ...current,
                      template_agent_enabled: checked,
                    }))
                  }
                  aria-label={t('openAiSettings.aria.toggleTemplateAgent')}
                />
              </div>

              <div className="flex min-h-14 items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-sm font-semibold text-slate-900">{t('openAiSettings.toggles.globalLlm')}</div>
                <Switch
                  checked={draft.use_global_llm_config}
                  disabled={loading || saving}
                  onCheckedChange={(checked) =>
                    setDraft((current) => ({
                      ...current,
                      use_global_llm_config: checked,
                    }))
                  }
                  aria-label={t('openAiSettings.aria.toggleGlobalLlm')}
                />
              </div>
            </section>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
};
