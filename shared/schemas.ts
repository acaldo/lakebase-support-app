import { z } from 'zod';

export const ticketCatalogCodeSchema = z.string()
  .trim()
  .min(1, 'A catalog code is required.')
  .max(40, 'Catalog codes cannot exceed 40 characters.')
  .regex(/^[a-z][a-z0-9_]*$/, 'Catalog codes must use lowercase letters, numbers, and underscores.');

export const createTicketSchema = z.object({
  title: z.string().trim().min(3, 'Title must contain at least 3 characters.').max(120),
  description: z.string().trim().max(2000).default(''),
  status: ticketCatalogCodeSchema.optional(),
  priority: ticketCatalogCodeSchema.optional(),
  category: ticketCatalogCodeSchema.optional(),
});

export const createMessageSchema = z.object({
  message_text: z.string().trim().min(1, 'Message cannot be empty.').max(4000),
});

export const updateStatusSchema = z.object({
  status: ticketCatalogCodeSchema,
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
