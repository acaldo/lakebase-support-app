import type { TicketCategory, TicketPriority } from '../shared/types.js';

export interface TicketFilters {
  search: string;
  priority: TicketPriority | 'all';
  category: TicketCategory | 'all';
}

export const EMPTY_FILTERS: TicketFilters = {
  search: '',
  priority: 'all',
  category: 'all',
};
