export type TicketStatus = string;
export type TicketPriority = string;
export type TicketCategory = string;

export interface TicketCatalogItem {
  code: string;
  label: string;
  sort_order: number;
  is_default: boolean;
}

export interface TicketStatusCatalogItem extends TicketCatalogItem {
  progress_percent: number;
  allows_deletion: boolean;
}

export interface TicketCatalogs {
  statuses: TicketStatusCatalogItem[];
  priorities: TicketCatalogItem[];
  categories: TicketCatalogItem[];
}

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
