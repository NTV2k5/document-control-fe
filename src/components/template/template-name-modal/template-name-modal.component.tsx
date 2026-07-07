import { FolderPlus, Loader2 } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';

import { TemplateShareRules } from '../template-share-rules';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from 'reactjs-platform/ui';
import type { ITemplateShareRule, MetadataOption, TemplateVisibility } from 'api';
import { useTranslation } from '../../../i18n';

export interface ITemplateNameModalProps {
  open: boolean;
  onClose: () => void;
  value: string;
  onChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  templateTypeOptions?: MetadataOption[];
  templateTypeValue?: string;
  onTemplateTypeChange?: (value: string) => void;
  visibilityValue?: TemplateVisibility;
  onVisibilityChange?: (value: TemplateVisibility) => void;
  share_rules?: ITemplateShareRule[];
  onShareRulesChange?: (share_rules: ITemplateShareRule[]) => void;
  organizationUnitOptions?: MetadataOption[];
  onConfirm: () => void;
  isLoading: boolean;
}

export const TemplateNameModal = ({
  open,
  onClose,
  value,
  onChange,
  description,
  onDescriptionChange,
  templateTypeOptions = [],
  templateTypeValue = '',
  onTemplateTypeChange,
  visibilityValue = 'PRIVATE',
  onVisibilityChange,
  share_rules = [],
  onShareRulesChange,
  organizationUnitOptions = [],
  onConfirm,
  isLoading,
}: ITemplateNameModalProps) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const templateTypeFieldId = useId();
  const visibilityFieldId = useId();

  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 30);

    return () => {
      window.clearTimeout(timer);
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-xl">
        <DialogHeader className="border-b border-slate-200 bg-white px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-[#0B2559]">
              <FolderPlus className="size-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold text-slate-900">
                {t('templateForm.createTitle')}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-slate-500">
                {t('templateForm.createDescription')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 px-6 py-5">
          <div className="space-y-2">
            <label htmlFor="template-name" className="text-sm font-semibold text-slate-900">
              {t('templateForm.name')}
            </label>
            <Input
              ref={inputRef}
              id="template-name"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  onConfirm();
                }
              }}
              placeholder={t('templateForm.namePlaceholder')}
              className="h-12 rounded-xl border-slate-200 text-base"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="template-description" className="text-sm font-semibold text-slate-900">
              {t('templateForm.description')}
            </label>
            <Textarea
              id="template-description"
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              placeholder={t('templateForm.descriptionPlaceholder')}
              className="min-h-32 rounded-xl border-slate-200 text-sm"
            />
          </div>

          {templateTypeOptions.length > 0 && onTemplateTypeChange ? (
            <div className="space-y-2">
              <span className="text-sm font-semibold text-slate-900">{t('templateForm.type')}</span>
              <Select value={templateTypeValue || undefined} onValueChange={onTemplateTypeChange}>
                <SelectTrigger
                  id={templateTypeFieldId}
                  aria-label={t('templateForm.type')}
                  className="h-12 rounded-xl border-slate-200 text-base">
                  <SelectValue placeholder={t('templateForm.typePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {templateTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {onVisibilityChange ? (
            <div className="space-y-2">
              <span className="text-sm font-semibold text-slate-900">{t('templateForm.visibility')}</span>
              <Select
                value={visibilityValue}
                onValueChange={(value) => onVisibilityChange(value as TemplateVisibility)}>
                <SelectTrigger
                  id={visibilityFieldId}
                  aria-label={t('templateForm.visibility')}
                  className="h-12 rounded-xl border-slate-200 text-base">
                  <SelectValue placeholder={t('templateForm.visibilityPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIVATE">{t('templateForm.visibilityOptions.private')}</SelectItem>
                  <SelectItem value="RESTRICTED">{t('templateForm.visibilityOptions.restricted')}</SelectItem>
                  <SelectItem value="PUBLIC">{t('templateForm.visibilityOptions.public')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {visibilityValue === 'RESTRICTED' ? (
            <TemplateShareRules
              share_rules={share_rules}
              onShareRulesChange={(nextShareRules) => onShareRulesChange?.(nextShareRules)}
              organizationUnitOptions={organizationUnitOptions}
            />
          ) : null}
        </div>

        <DialogFooter className="border-t border-slate-200 bg-white px-6 py-4 sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={isLoading} className="h-11 rounded-xl px-5">
            {t('common.actions.cancel')}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="h-11 rounded-xl bg-[#0B2559] px-5 hover:bg-[#123C85]">
            {isLoading && <Loader2 className="size-4 animate-spin" />}
            {isLoading ? t('templateForm.creating') : t('templateForm.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
