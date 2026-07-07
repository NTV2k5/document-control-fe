import type { ColumnDef } from '@tanstack/react-table';
import type { useNavigate } from '@tanstack/react-router';
import type { DocumentStatus, IDocument } from 'api';

export interface IDocumentsSectionProps {}

export type TDocumentRow = IDocument;
export type TDocumentsNavigate = ReturnType<typeof useNavigate>;
export type TDocumentQuickFilterKey = 'ALL' | DocumentStatus;
export interface IDocumentQuickFilterOption {
  key: TDocumentQuickFilterKey;
  label: string;
}
export type TDocumentColumn = ColumnDef<TDocumentRow>;
