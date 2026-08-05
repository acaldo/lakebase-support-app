import type pg from 'pg';
import type {
  CreateMessageInput,
  CreateTicketInput,
  UpdateStatusInput,
} from '../shared/schemas.js';
import type { Ticket, TicketDetail, TicketMessage } from '../shared/types.js';

const SCHEMA_PATTERN = /^[a-z_][a-z0-9_]*$/;

function quoteSchema(schema: string): string {
  if (!SCHEMA_PATTERN.test(schema)) throw new Error('Invalid database schema.');
  return `"${schema}"`;
}

function serializeTicket(row: Record<string, any>): Ticket {
  return {
    ...row,
    ticket_id: String(row.ticket_id),
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
    message_count: Number(row.message_count ?? 0),
  } as Ticket;
}

function serializeMessage(row: Record<string, any>): TicketMessage {
  return {
    ...row,
    message_id: String(row.message_id),
    ticket_id: String(row.ticket_id),
    created_at: new Date(row.created_at).toISOString(),
  } as TicketMessage;
}

export class TicketRepository {
  private readonly schema: string;

  constructor(private readonly pool: pg.Pool, schemaName: string) {
    this.schema = quoteSchema(schemaName);
  }

  async health(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async listTickets(): Promise<Ticket[]> {
    const result = await this.pool.query(`
      SELECT t.*,
        (SELECT COUNT(*)::int FROM ${this.schema}.ticket_messages m WHERE m.ticket_id = t.ticket_id) AS message_count
      FROM ${this.schema}.tickets t
      ORDER BY
        CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        t.updated_at DESC,
        t.ticket_id DESC
    `);
    return result.rows.map(serializeTicket);
  }

  async getTicket(ticketId: string): Promise<TicketDetail | null> {
    const ticketResult = await this.pool.query(
      `SELECT t.*,
        (SELECT COUNT(*)::int FROM ${this.schema}.ticket_messages m WHERE m.ticket_id = t.ticket_id) AS message_count
       FROM ${this.schema}.tickets t WHERE t.ticket_id = $1`,
      [ticketId],
    );
    if (!ticketResult.rowCount) return null;

    const messagesResult = await this.pool.query(
      `SELECT * FROM ${this.schema}.ticket_messages
       WHERE ticket_id = $1 ORDER BY created_at ASC, message_id ASC`,
      [ticketId],
    );
    return {
      ...serializeTicket(ticketResult.rows[0]),
      messages: messagesResult.rows.map(serializeMessage),
    };
  }

  async createTicket(input: CreateTicketInput, author: string): Promise<Ticket> {
    const result = await this.pool.query(
      `INSERT INTO ${this.schema}.tickets
        (title, description, status, priority, category, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *, 0::int AS message_count`,
      [input.title, input.description, input.status, input.priority, input.category, author],
    );
    return serializeTicket(result.rows[0]);
  }

  async addMessage(ticketId: string, input: CreateMessageInput, author: string): Promise<TicketMessage | null> {
    const result = await this.pool.query(
      `INSERT INTO ${this.schema}.ticket_messages (ticket_id, message_text, author)
       SELECT ticket_id, $2, $3 FROM ${this.schema}.tickets WHERE ticket_id = $1
       RETURNING *`,
      [ticketId, input.message_text, author],
    );
    if (!result.rowCount) return null;

    await this.pool.query(
      `UPDATE ${this.schema}.tickets SET updated_at = CURRENT_TIMESTAMP WHERE ticket_id = $1`,
      [ticketId],
    );
    return serializeMessage(result.rows[0]);
  }

  async updateStatus(ticketId: string, input: UpdateStatusInput): Promise<Ticket | null> {
    const result = await this.pool.query(
      `UPDATE ${this.schema}.tickets
       SET status = $2, updated_at = CURRENT_TIMESTAMP
       WHERE ticket_id = $1
       RETURNING *,
         (SELECT COUNT(*)::int FROM ${this.schema}.ticket_messages m WHERE m.ticket_id = $1) AS message_count`,
      [ticketId, input.status],
    );
    return result.rowCount ? serializeTicket(result.rows[0]) : null;
  }

  async deleteTicket(ticketId: string): Promise<'deleted' | 'not_found' | 'not_archived'> {
    const result = await this.pool.query(
      `DELETE FROM ${this.schema}.tickets
       WHERE ticket_id = $1 AND status = 'archived'
       RETURNING ticket_id`,
      [ticketId],
    );
    if (result.rowCount) return 'deleted';

    const existing = await this.pool.query(
      `SELECT 1 FROM ${this.schema}.tickets WHERE ticket_id = $1`,
      [ticketId],
    );
    return existing.rowCount ? 'not_archived' : 'not_found';
  }
}
