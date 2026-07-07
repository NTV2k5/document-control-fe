import type { ITemplateShareRule, MetadataOption } from 'api';

export interface ITemplateShareRulesProps {
  share_rules: ITemplateShareRule[];
  onShareRulesChange: (share_rules: ITemplateShareRule[]) => void;
  organizationUnitOptions: MetadataOption[];
  disabled?: boolean;
}
