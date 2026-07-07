'use client';

import { Building2, GitBranch, Shield, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { searchTemplateShareTargetUsersAPI, type ITemplateShareRule, type ITemplateShareTargetUser } from 'api';
import { Badge, Button, SearchableMultiSelect } from 'reactjs-platform/ui';
import type { SearchableMultiSelectOption } from 'reactjs-platform/ui';
import type { ITemplateShareRulesProps } from './template-share-rules.type';

const buildShareRule = (
  subject_type: ITemplateShareRule['subject_type'],
  subject_id: string,
  label: string,
): ITemplateShareRule => ({
  subject_type,
  subject_id,
  label,
});

const getRuleKey = (rule: Pick<ITemplateShareRule, 'subject_type' | 'subject_id'>) =>
  `${rule.subject_type}:${rule.subject_id}`;

const USER_SEARCH_DEBOUNCE_MS = 250;

export const TemplateShareRules = ({
  share_rules,
  onShareRulesChange,
  organizationUnitOptions,
  disabled = false,
}: ITemplateShareRulesProps) => {
  const [userSearchValue, setUserSearchValue] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<ITemplateShareTargetUser[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);

  const onlyUnitIds = useMemo(
    () => share_rules.filter((rule) => rule.subject_type === 'ORG_UNIT').map((rule) => rule.subject_id),
    [share_rules],
  );
  const unitTreeIds = useMemo(
    () => share_rules.filter((rule) => rule.subject_type === 'ORG_UNIT_TREE').map((rule) => rule.subject_id),
    [share_rules],
  );
  const userIds = useMemo(
    () => share_rules.filter((rule) => rule.subject_type === 'USER').map((rule) => rule.subject_id),
    [share_rules],
  );

  const userOptions = useMemo<SearchableMultiSelectOption[]>(() => {
    const selectedOptions = share_rules
      .filter((rule) => rule.subject_type === 'USER')
      .map((rule) => ({
        value: rule.subject_id,
        label: rule.label || rule.subject_id,
      }));
    const searchedOptions = userSearchResults.map((user) => ({
      value: user.id,
      label: `${user.display_name} (${user.email})`,
    }));

    return [
      ...new Map(
        [...selectedOptions, ...searchedOptions].map((option): [string, SearchableMultiSelectOption] => [
          option.value,
          option,
        ]),
      ).values(),
    ];
  }, [share_rules, userSearchResults]);

  useEffect(() => {
    const normalizedSearch = userSearchValue.trim();

    if (!normalizedSearch) {
      setUserSearchResults([]);
      setUserSearchLoading(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setUserSearchLoading(true);
      void searchTemplateShareTargetUsersAPI(normalizedSearch)
        .then((results) => {
          setUserSearchResults(results);
        })
        .finally(() => {
          setUserSearchLoading(false);
        });
    }, USER_SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [userSearchValue]);

  const updateShareRules = (nextOnlyUnitIds: string[], nextUnitTreeIds: string[], nextUserIds: string[]) => {
    const unitLabelMap = new Map(
      organizationUnitOptions.map((option): [string, string] => [option.value, option.label]),
    );
    const userLabelMap = new Map(userOptions.map((option): [string, string] => [option.value, option.label]));
    const preservedRules = share_rules.filter(
      (rule) => !['ORG_UNIT', 'ORG_UNIT_TREE', 'USER'].includes(rule.subject_type),
    );

    onShareRulesChange([
      ...preservedRules,
      ...nextOnlyUnitIds.map((subject_id) =>
        buildShareRule('ORG_UNIT', subject_id, unitLabelMap.get(subject_id) || subject_id),
      ),
      ...nextUnitTreeIds.map((subject_id) =>
        buildShareRule(
          'ORG_UNIT_TREE',
          subject_id,
          `${unitLabelMap.get(subject_id) || subject_id} (toàn bộ đơn vị con)`,
        ),
      ),
      ...nextUserIds.map((subject_id) =>
        buildShareRule('USER', subject_id, userLabelMap.get(subject_id) || subject_id),
      ),
    ]);
  };

  const removeRule = (ruleKey: string) => {
    onShareRulesChange(share_rules.filter((rule) => getRuleKey(rule) !== ruleKey));
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="grid gap-3 2xl:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Building2 className="size-4 text-slate-500" />
            Đơn vị cụ thể
          </div>
          <SearchableMultiSelect
            disabled={disabled}
            value={onlyUnitIds}
            onValueChange={(values) => updateShareRules(values, unitTreeIds, userIds)}
            options={organizationUnitOptions}
            placeholder="Chọn khoa, viện, phòng ban..."
            searchPlaceholder="Tìm đơn vị cụ thể"
            emptyMessage="Không tìm thấy đơn vị"
            maxDisplay={1}
            triggerClassName="min-h-11 rounded-xl border-slate-200 bg-white text-left"
            contentClassName="rounded-xl border-slate-200"
          />
          <p className="text-[13px] text-slate-500">Chỉ đơn vị được chọn có thể xem mẫu này.</p>
        </div>

        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <GitBranch className="size-4 text-slate-500" />
            Đơn vị kèm đơn vị con
          </div>
          <SearchableMultiSelect
            disabled={disabled}
            value={unitTreeIds}
            onValueChange={(values) => updateShareRules(onlyUnitIds, values, userIds)}
            options={organizationUnitOptions}
            placeholder="Chọn đơn vị cha..."
            searchPlaceholder="Tìm đơn vị cha"
            emptyMessage="Không tìm thấy đơn vị"
            maxDisplay={1}
            triggerClassName="min-h-11 rounded-xl border-slate-200 bg-white text-left"
            contentClassName="rounded-xl border-slate-200"
          />
          <p className="text-[13px] text-slate-500">
            Đơn vị được chọn và toàn bộ đơn vị con bên dưới có thể xem mẫu này.
          </p>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Users className="size-4 text-slate-500" />
          Người dùng cụ thể
        </div>
        <SearchableMultiSelect
          disabled={disabled}
          value={userIds}
          onValueChange={(values) => updateShareRules(onlyUnitIds, unitTreeIds, values)}
          options={userOptions}
          onSearchChange={setUserSearchValue}
          placeholder="Chọn người dùng theo email hoặc tên..."
          searchPlaceholder="Tìm email hoặc họ tên"
          emptyMessage={userSearchLoading ? 'Đang tìm người dùng...' : 'Không tìm thấy người dùng'}
          loading={userSearchLoading}
          maxDisplay={1}
          triggerClassName="min-h-11 rounded-xl border-slate-200 bg-white text-left"
          contentClassName="rounded-xl border-slate-200"
        />
        <p className="text-[13px] text-slate-500">
          Dùng cho trường hợp ngoại lệ hoặc chia sẻ trực tiếp cho từng cá nhân.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Shield className="size-4 text-slate-500" />
          Quy tắc chia sẻ đang áp dụng
        </div>
        {share_rules.length > 0 ? (
          <div className="flex max-h-56 flex-wrap gap-2 overflow-auto pr-1">
            {share_rules.map((rule) => {
              const ruleKey = getRuleKey(rule);
              const toneClassName =
                rule.subject_type === 'USER'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : rule.subject_type === 'ORG_UNIT_TREE'
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : 'border-sky-200 bg-sky-50 text-sky-800';

              return (
                <Badge
                  key={ruleKey}
                  variant="outline"
                  className={`flex max-w-full items-center gap-2 rounded-full px-3 py-1 text-[13px] font-medium ${toneClassName}`}>
                  <span className="truncate">{rule.label || rule.subject_id}</span>
                  {!disabled ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRule(ruleKey)}
                      className="h-auto min-h-0 rounded-full p-0 text-inherit hover:bg-transparent">
                      <X className="size-3" />
                    </Button>
                  ) : null}
                </Badge>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500">
            Chưa chọn quy tắc chia sẻ.
          </div>
        )}
      </div>
    </div>
  );
};
