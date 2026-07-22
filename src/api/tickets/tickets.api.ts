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

export const listTicketsAPI = async (): Promise<ITicketAPIListResponse['data']> => {
  const res = await API.get<unknown>(`/api/method/${API_COMMON}.ticket.get_tickets`);
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

export const createTicketAPI = async (payload: ICreateTicketPayload): Promise<ITicketAPICreateResponse['data']> => {
  const formData = new URLSearchParams();
  (Object.keys(payload) as Array<keyof ICreateTicketPayload>).forEach((key) => {
    const value = payload[key];
    if (value !== undefined && value !== null) {
      formData.append(key, String(value));
    }
  });

  if (import.meta.env.DEV) {
    console.log('[createTicketAPI] sending payload:', Object.fromEntries(formData.entries()));
  }

  try {
    const res = await API.post<unknown>(
      `/api/method/${API_COMMON}.ticket.create_ticket`,
      formData,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
    const body = res.data as Record<string, unknown>;

    const fromMessage = body?.message as Record<string, unknown> | undefined;
    if (fromMessage?.name) {
      return fromMessage as unknown as ITicketAPICreateResponse['data'];
    }

    const fromData = body?.data as Record<string, unknown> | undefined;
    if (fromData?.name) {
      return fromData as unknown as ITicketAPICreateResponse['data'];
    }

    return { name: '', ticket_type: '', status: 'New' };
  } catch (error: any) {
    const is404 =
      error?.status === 404 ||
      error?.response?.status === 404 ||
      (typeof error?.message === 'string' && (error.message.includes('404') || error.message.includes('Request failed with status code 404')));

    // If backend endpoint is missing (404), fallback to mock behavior in DEV mode
    if (import.meta.env.DEV && is404) {
      console.warn('[createTicketAPI] Backend endpoint /api/method/drive_edms.api.ticket.create_ticket returned 404. Falling back to mock /api/v1/tickets');
      try {
        const mockRes = await API.post<unknown>('/api/v1/tickets', {
          title: payload.title,
          content: payload.description,
          type: payload.ticket_type,
          hasFee: payload.has_fee === 1,
          feeAmount: payload.fee_amount,
          source: payload.source,
        });
        return (mockRes.data as any)?.data || { name: 'TC-MOCK', ticket_type: payload.ticket_type, status: 'Chờ xử lý' };
      } catch {
        // Fallback to local fake response if mock server also fails
        return { name: `TC-${Math.floor(100 + Math.random() * 900)}`, ticket_type: payload.ticket_type, status: 'Chờ xử lý' };
      }
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
