import { describe, expect, it } from 'vitest';
import { createMessageSchema, createTicketSchema, updateStatusSchema } from './schemas.js';

describe('shared validation schemas', () => {
  it('normalizes valid ticket input and applies defaults', () => {
    expect(createTicketSchema.parse({ title: '  Printer is offline  ' })).toEqual({
      title: 'Printer is offline',
      description: '',
      status: 'open',
      priority: 'medium',
      category: 'other',
    });
  });

  it('rejects invalid tickets, messages, and status values', () => {
    expect(createTicketSchema.safeParse({ title: 'x' }).success).toBe(false);
    expect(createMessageSchema.safeParse({ message_text: '   ' }).success).toBe(false);
    expect(updateStatusSchema.safeParse({ status: 'deleted' }).success).toBe(false);
  });
});
