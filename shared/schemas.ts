import { z } from 'zod';
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from './types.js';

export const createTicketSchema = z.object({
  title: z.string().trim().min(3, 'Title must contain at least 3 characters.').max(120),
  description: z.string().trim().max(2000).default(''),
  status: z.enum(TICKET_STATUSES).default('open'),
  priority: z.enum(TICKET_PRIORITIES).default('medium'),
  category: z.enum(TICKET_CATEGORIES).default('other'),
});

export const createMessageSchema = z.object({
  message_text: z.string().trim().min(1, 'Message cannot be empty.').max(4000),
});

export const updateStatusSchema = z.object({
  status: z.enum(TICKET_STATUSES),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
