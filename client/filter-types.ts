import type { TicketCategory, TicketPriority, TicketStatus } from '../shared/types.js';

export interface TicketFilters {
  search: string;
  status: TicketStatus | 'all';
  priority: TicketPriority | 'all';
  category: TicketCategory | 'all';
}

export const EMPTY_FILTERS: TicketFilters = {
  search: '',
  status: 'all',
  priority: 'all',
  category: 'all',
};
