/* ─── Enums ──────────────────────────────────────────────── */

export enum ETicketType {
  CUNG_CAP_THONG_TIN = 'CUNG_CAP_THONG_TIN',
  DICH_VU_HANH_CHINH = 'DICH_VU_HANH_CHINH',
}

export enum ETicketStatus {
  MOI = 'MOI',
  DANG_XU_LY = 'DANG_XU_LY',
  CHO_SINH_VIEN = 'CHO_SINH_VIEN',
  DA_HOAN_TAT = 'DA_HOAN_TAT',
}

export enum ETicketSource {
  AI_CHATBOT = 'AI_CHATBOT',
  TAO_TICKET = 'TAO_TICKET',
}

export enum EPaymentStatus {
  CHUA_THANH_TOAN = 'CHUA_THANH_TOAN',
  DA_THANH_TOAN = 'DA_THANH_TOAN',
  KHONG_THU_PHI = 'KHONG_THU_PHI',
}

export enum EProcessingForm {
  ONLINE_KY_SO = 'ONLINE_KY_SO',
  ONLINE_BAN_SCAN = 'ONLINE_BAN_SCAN',
  OFFLINE_KY_TAY = 'OFFLINE_KY_TAY',
  GOI_DIEN_KHAC = 'GOI_DIEN_KHAC',
}

export enum EStepStatus {
  DA_XONG = 'DA_XONG',
  DANG_CHO = 'DANG_CHO',
  CHUA_TOI = 'CHUA_TOI',
}

/* ─── User / Person ──────────────────────────────────────── */

export interface IPerson {
  id: string;
  name: string;
  role?: string;
  avatar?: string;
  mssv?: string;
  department?: string;
}

/* ─── Ticket Comment ─────────────────────────────────────── */

export interface ITicketComment {
  id: string;
  stepId: string;
  author: IPerson;
  content: string;
  createdAt: string;
}

/* ─── Approval Level ─────────────────────────────────────── */

export interface IApprovalLevel {
  id: string;
  label: string;
  approver?: IPerson;
  status: 'approved' | 'pending' | 'waiting';
  approvedAt?: string;
}

/* ─── Ticket Step (Action Flow) ──────────────────────────── */

export interface ITicketStep {
  id: string;
  order: number;
  name: string;
  performer: string;
  performerType: 'system' | 'staff' | 'student';
  status: EStepStatus;
  completedAt?: string;
  description?: string;
  resultSummary?: string;
  icon: string;
  /** For approval step */
  approvalLevels?: IApprovalLevel[];
  /** For payment step */
  paymentInfo?: {
    amount: number;
    bank: string;
    accountNumber: string;
    accountHolder: string;
    transferContent: string;
    qrUrl?: string;
    proofAttached?: boolean;
    proofFile?: string;
  };
  /** For file sending step */
  uploadedFile?: string;
  /** For call step */
  callNote?: string;
  /** For result step */
  feedbackNote?: string;
  comments: ITicketComment[];
  /** Is this a student-facing action? */
  isStudentAction?: boolean;
}

/* ─── Main Ticket Model ──────────────────────────────────── */

export interface ITicket {
  id: string;
  code: string;
  title: string;
  content: string;
  student: IPerson;
  type: ETicketType;
  creator: IPerson;
  createdAt: string;
  source: ETicketSource;
  documentCode?: string;
  processingForm: EProcessingForm;
  hasFee: boolean;
  paymentStatus: EPaymentStatus;
  feeAmount?: number;
  assignee: IPerson;
  supporters: IPerson[];
  notifyRecipients: IPerson[];
  deadline: string;
  status: ETicketStatus;
  slaPercent: number;
  slaLabel: string;
  attachments: string[];
  steps: ITicketStep[];
}

/* ─── Stats Card ─────────────────────────────────────────── */

export interface ITicketStatsCard {
  key: string;
  label: string;
  value: number;
  subLabel?: string;
  color: 'blue' | 'yellow' | 'orange' | 'red' | 'green';
  icon: string;
}

/* ─── Filter State ───────────────────────────────────────── */

export interface ITicketFilter {
  search: string;
  type: ETicketType | '';
  status: ETicketStatus | '';
  source: ETicketSource | '';
  statsFilter: string;
}

/* ─── Create Ticket Form ─────────────────────────────────── */

export interface ICreateTicketForm {
  type: ETicketType;
  faculty: string;
  studentId: string;
  title: string;
  content: string;
  /** Only for Cung cấp thông tin */
  responseMethod?: string;
  slaOption?: string;
  /** Only for Dịch vụ hành chính */
  documentTemplateId?: string;
  deliveryForm?: EProcessingForm;
}

/* ─── Component Props ────────────────────────────────────── */

export interface ITicketsSectionProps {
  data?: unknown;
}

export interface ITicketStatsProps {
  stats: ITicketStatsCard[];
  activeFilter: string;
  onFilterClick: (key: string) => void;
}

export interface ITicketToolbarProps {
  filter: ITicketFilter;
  onFilterChange: (filter: Partial<ITicketFilter>) => void;
  onCreateClick: () => void;
}

export interface ITicketTableProps {
  tickets: ITicket[];
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onRowClick: (ticket: ITicket) => void;
  onSourceClick: (ticket: ITicket) => void;
  onDocumentCodeClick: (ticket: ITicket) => void;
}

export interface ITicketDetailModalProps {
  ticket: ITicket | null;
  open: boolean;
  onClose: () => void;
}

export interface ITicketStepCardProps {
  step: ITicketStep;
  isLast: boolean;
  viewRole?: 'staff' | 'student';
  onStepUpdate?: (stepId: string, updatedFields: Partial<ITicketStep>) => void;
}

export interface ICreateTicketModalProps {
  open: boolean;
  onClose: () => void;
  onTicketCreated?: () => void;
}

export interface ITicketSourceModalProps {
  ticket: ITicket | null;
  open: boolean;
  onClose: () => void;
}
