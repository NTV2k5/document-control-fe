import type { ColumnDef } from '@tanstack/react-table';
import type { useNavigate } from '@tanstack/react-router';
import type { ITemplateListItem, TemplateStatus } from 'api';

export interface ITemplatesSectionProps {}

export type TTemplateRow = ITemplateListItem;
export type TTemplatesNavigate = ReturnType<typeof useNavigate>;
export interface ITemplateStatusOption {
  value: 'ALL' | TemplateStatus;
  label: string;
}
export type TTemplateColumn = ColumnDef<TTemplateRow>;
