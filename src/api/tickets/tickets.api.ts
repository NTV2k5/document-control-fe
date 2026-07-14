import { API } from 'reactjs-platform/utilities';
import type { ITicket, ETicketType, EProcessingForm } from '../../sections/tickets/ticket.type';

export interface ICreateTicketPayload {
  title: string;
  content: string;
  type: ETicketType;
  documentCode?: string;
  processingForm: EProcessingForm;
  hasFee: boolean;
  feeAmount?: number;
  student?: {
    id: string;
    name: string;
    mssv: string;
    role: string;
    department: string;
  };
}

export const listTicketsAPI = async (): Promise<ITicket[]> => {
  return API.get<{ data: ITicket[] }>('/api/v1/tickets').then(
    (response) => response.data.data,
  );
};

export const createTicketAPI = async (payload: ICreateTicketPayload): Promise<ITicket> => {
  return API.post<{ data: ITicket }>('/api/v1/tickets', payload).then(
    (response) => response.data.data,
  );
};
