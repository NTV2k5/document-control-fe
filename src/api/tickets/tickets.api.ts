import { API } from 'reactjs-platform/utilities';

const API_COMMON = import.meta.env.VITE_API_COMMON || 'drive_edms.api';

/* ─── Raw API Response Types ─────────────────────────────── */

export interface ITicketAPIUserDisplay {
  email: string;
  full_name: string;
  user_image: string;
}

export interface ITicketAPIStep {
  name: string;
  step_order: number;
  step_name: string;
  step_status: 'Completed' | 'Pending' | 'In Progress';
  action_type: string;
  is_student_action: 0 | 1;
  assigned_to: string;
  assigned_role: string;
  completed_at: string | null;
  result_summary: string | null;
  step_data: Record<string, unknown> | null;
  comments: unknown[];
}

export interface ITicketAPIItem {
  name: string;
  title: string;
  ticket_type: string;
  status: string;
  source: string;
  student: string;
  student_name: string;
  student_code: string;
  faculty: string;
  faculty_name: string;
  created_by_user: string;
  request_date: string;
  document_form_code: string;
  processing_method: string;
  has_fee: 0 | 1;
  fee_amount: number;
  assignee: string;
  assignee_name: string;
  deadline: string;
  sla_percentage: number;
  sla_label: string | null;
  supporters_list: string[];
  created_by_display: ITicketAPIUserDisplay;
  assignee_display: ITicketAPIUserDisplay;
}

export interface ITicketAPIDetail extends ITicketAPIItem {
  description: string;
  payment_status: string;
  attachment: string | null;
  supporters: unknown[];
  notify_users: unknown[];
  steps: ITicketAPIStep[];
}

export interface ITicketAPIListResponse {
  message: string;
  data: {
    tickets: ITicketAPIItem[];
    total: number;
    page_size: number;
    start: number;
    stats: {
      total: number;
      need_action: number;
      processing: number;
      overdue: number;
      completed: number;
    };
  };
}

export interface ITicketAPIDetailResponse {
  message: string;
  data: ITicketAPIDetail;
}

export interface ITicketAPICreateResponse {
  message: string;
  data: {
    name: string;
    ticket_type: string;
    status: string;
  };
}

/* ─── Create Ticket Payload ──────────────────────────────── */

export interface ICreateTicketPayload {
  ticket_type: string;
  title: string;
  description: string;
  processing_method: string;
  student?: string;
  assignee?: string;
  has_fee: 0 | 1;
  fee_amount: number;
  deadline?: string;
  source: string;
}

/* ─── Update Ticket Payload ──────────────────────────────── */

export interface IUpdateTicketPayload {
  ticket_name: string;
  complete_step?: {
    step_name: string;
    result_summary?: string;
  };
}

/* ─── API Functions ──────────────────────────────────────── */

export const listTicketsAPI = async (params?: { start?: number; page_size?: number }): Promise<ITicketAPIListResponse['data']> => {
  const queryParams = params
    ? {
        start: params.start,
        page_size: params.page_size,
        limit: params.page_size,
        limit_start: params.start,
        limit_page_length: params.page_size,
      }
    : undefined;

  const res = await API.get<unknown>(
    `/api/method/${API_COMMON}.ticket.get_tickets`,
    { params: queryParams }
  );
  const body = res.data as Record<string, unknown>;

  // Debug: log actual response structure once
  if (import.meta.env.DEV) {
    console.log('[tickets API] raw response body:', JSON.stringify(body).slice(0, 300));
  }

  // Frappe standard: {"message": {"tickets": [...], "stats": {...}, ...}}
  const fromMessage = body?.message as Record<string, unknown> | undefined;
  if (fromMessage?.tickets) {
    return fromMessage as ITicketAPIListResponse['data'];
  }

  // Alternative: {"message": "...", "data": {"tickets": [...], ...}}
  const fromData = body?.data as Record<string, unknown> | undefined;
  if (fromData?.tickets) {
    return fromData as ITicketAPIListResponse['data'];
  }

  throw new Error(`Unexpected response structure from get_tickets: ${JSON.stringify(body).slice(0, 200)}`);
};

export const getTicketDetailAPI = async (ticketName: string): Promise<ITicketAPIDetail> => {
  const res = await API.get<unknown>(
    `/api/method/${API_COMMON}.ticket.get_ticket_detail`,
    { params: { ticket_name: ticketName } },
  );
  const body = res.data as Record<string, unknown>;

  // Frappe standard: {"message": { ...ticket detail... }}
  const fromMessage = body?.message as Record<string, unknown> | undefined;
  if (fromMessage?.name) {
    return fromMessage as unknown as ITicketAPIDetail;
  }

  // Alternative: {"message": "...", "data": { ...ticket detail... }}
  const fromData = body?.data as Record<string, unknown> | undefined;
  if (fromData?.name) {
    return fromData as unknown as ITicketAPIDetail;
  }

  throw new Error(`Unexpected response structure from get_ticket_detail: ${JSON.stringify(body).slice(0, 200)}`);
};

export const createTicketAPI = async (
  payload: ICreateTicketPayload
): Promise<ITicketAPICreateResponse['data']> => {
  if (import.meta.env.DEV) {
    console.log('[createTicketAPI] sending payload:', payload);
  }

  // Ép kiểu dữ liệu chuẩn giống hệt Postman
  const body = {
    ticket_type: payload.ticket_type,
    title: payload.title,
    description: payload.description,
    processing_method: payload.processing_method,
    assignee: payload.assignee,
    student: payload.student, // Thêm student vào body nếu có
    has_fee: payload.has_fee ? 1 : 0,
    fee_amount: Number(payload.fee_amount || 0),
    deadline: payload.deadline,
    source: payload.source || 'Tạo thủ công',
  };

  try {
    const res = await API.post<{
      message: string;
      data: ITicketAPICreateResponse['data'];
    }>(
      `/api/method/${API_COMMON}.ticket.create_ticket`,
      body,
      {
        headers: {
          'Content-Type': 'application/json',
          'clean-request': 'no-clean', // 👈 BẮT BUỘC: Bỏ qua interceptor làm biến dạng body
        },
      }
    );

    const resData = res.data as any;

    // Xử lý linh hoạt 2 dạng Response của Frappe
    if (resData?.data?.name) {
      return resData.data;
    }
    if (resData?.message?.name) {
      return resData.message;
    }

    return resData?.data || resData;
  } catch (error: any) {
    if (import.meta.env.DEV) {
      console.error('[createTicketAPI] Error response data:', error?.response?.data);
      console.error('[createTicketAPI] Error message:', error?.message);
    }
    throw error;
  }
};

export const updateTicketAPI = async (payload: IUpdateTicketPayload): Promise<unknown> => {
  const formData = new URLSearchParams();
  (Object.keys(payload) as Array<keyof IUpdateTicketPayload>).forEach((key) => {
    const value = payload[key];
    if (value !== undefined && value !== null) {
      formData.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }
  });

  const res = await API.post<unknown>(
    `/api/method/${API_COMMON}.ticket.update_ticket`,
    formData,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  );
  return res.data;
};
