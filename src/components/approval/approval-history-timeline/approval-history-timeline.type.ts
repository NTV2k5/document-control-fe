export interface IAuditLog {
  _id: string;
  template_id?: string;
  document_id?: string;
  action: string;
  performed_by: string;
  previous_status?: string;
  new_status?: string;
  details?: Record<string, any>;
  timestamp: number;
}

export interface IApprovalHistoryTimelineProps {
  logs?: IAuditLog[];
  isLoading?: boolean;
}
