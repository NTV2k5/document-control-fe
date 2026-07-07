import type { ITemplate, ITemplateListItem } from 'api';

export interface INewDocumentSectionProps {}

export interface IMetadataItemProps {
  label: string;
  value: string;
}

export type TApprovedTemplate = ITemplateListItem;
export type TApprovedTemplateDetail = ITemplate;
