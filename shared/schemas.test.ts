import { describe, expect, it } from 'vitest';
import { createMessageSchema, createTicketSchema, updateStatusSchema } from './schemas.js';

describe('shared validation schemas', () => {
  it('normalizes valid ticket input while leaving catalog defaults to the database', () => {
    expect(createTicketSchema.parse({ title: '  Printer is offline  ' })).toEqual({
      title: 'Printer is offline',
      description: '',
    });
  });

  it('accepts structural catalog codes and rejects malformed input', () => {
    expect(updateStatusSchema.safeParse({ status: 'waiting_for_customer' }).success).toBe(true);
    expect(createTicketSchema.safeParse({ title: 'x' }).success).toBe(false);
    expect(createMessageSchema.safeParse({ message_text: '   ' }).success).toBe(false);
    expect(updateStatusSchema.safeParse({ status: 'Waiting-for-customer' }).success).toBe(false);
  });
});
