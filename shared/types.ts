export const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'archived'] as const;
export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export const TICKET_CATEGORIES = ['access', 'software', 'hardware', 'other'] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export interface Ticket {
  ticket_id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  created_by: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface TicketMessage {
  message_id: string;
  ticket_id: string;
  message_text: string;
  author: string;
  created_at: string;
}

export interface TicketDetail extends Ticket {
  messages: TicketMessage[];
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
}
