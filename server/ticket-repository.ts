import type pg from 'pg';
import type {
  CreateMessageInput,
  CreateTicketInput,
  UpdateStatusInput,
} from '../shared/schemas.js';
import type {
  Ticket,
  TicketCatalogItem,
  TicketCatalogs,
  TicketDetail,
  TicketMessage,
  TicketStatusCatalogItem,
} from '../shared/types.js';

const SCHEMA_PATTERN = /^[a-z_][a-z0-9_]*$/;

function quoteSchema(schema: string): string {
  if (!SCHEMA_PATTERN.test(schema)) throw new Error('Invalid database schema.');
  return `"${schema}"`;
}

function ticketColumns(ticket = 'ticket', status = 'status', priority = 'priority', category = 'category'): string {
  return `
    ${ticket}.ticket_id,
    ${ticket}.title,
    ${ticket}.description,
    ${status}.code AS status,
    ${priority}.code AS priority,
    ${category}.code AS category,
    ${ticket}.created_by,
    ${ticket}.created_at,
    ${ticket}.updated_at`;
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

function serializeCatalogItem(row: Record<string, any>): TicketCatalogItem {
  return {
    code: String(row.code),
    label: String(row.label),
    sort_order: Number(row.sort_order),
    is_default: Boolean(row.is_default),
  };
}

function serializeStatusCatalogItem(row: Record<string, any>): TicketStatusCatalogItem {
  return {
    ...serializeCatalogItem(row),
    progress_percent: Number(row.progress_percent),
    allows_deletion: Boolean(row.allows_deletion),
  };
}

export class CatalogValidationError extends Error {
  constructor(readonly fieldErrors: Record<string, string[]>) {
    super('Please check the submitted catalog values.');
    this.name = 'CatalogValidationError';
  }
}

interface CatalogIds {
  statusId: number;
  priorityId: number;
  categoryId: number;
}

export class TicketRepository {
  private readonly schema: string;

  constructor(private readonly pool: pg.Pool, schemaName: string) {
    this.schema = quoteSchema(schemaName);
  }

  async health(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async getTicketCatalogs(): Promise<TicketCatalogs> {
    const [statuses, priorities, categories] = await Promise.all([
      this.pool.query(`
        SELECT code, label, sort_order, is_default, progress_percent, allows_deletion
        FROM ${this.schema}.dim_ticket_status
        ORDER BY sort_order, code
      `),
      this.pool.query(`
        SELECT code, label, sort_order, is_default
        FROM ${this.schema}.dim_ticket_priority
        ORDER BY sort_order, code
      `),
      this.pool.query(`
        SELECT code, label, sort_order, is_default
        FROM ${this.schema}.dim_ticket_category
        ORDER BY sort_order, code
      `),
    ]);

    return {
      statuses: statuses.rows.map(serializeStatusCatalogItem),
      priorities: priorities.rows.map(serializeCatalogItem),
      categories: categories.rows.map(serializeCatalogItem),
    };
  }

  async listTickets(): Promise<Ticket[]> {
    const result = await this.pool.query(`
      SELECT ${ticketColumns()},
        (SELECT COUNT(*)::int FROM ${this.schema}.ticket_messages message WHERE message.ticket_id = ticket.ticket_id) AS message_count
      FROM ${this.schema}.tickets ticket
      JOIN ${this.schema}.dim_ticket_status status ON status.status_id = ticket.status_id
      JOIN ${this.schema}.dim_ticket_priority priority ON priority.priority_id = ticket.priority_id
      JOIN ${this.schema}.dim_ticket_category category ON category.category_id = ticket.category_id
      ORDER BY priority.sort_order, ticket.updated_at DESC, ticket.ticket_id DESC
    `);
    return result.rows.map(serializeTicket);
  }

  async getTicket(ticketId: string): Promise<TicketDetail | null> {
    const ticketResult = await this.pool.query(
      `SELECT ${ticketColumns()},
        (SELECT COUNT(*)::int FROM ${this.schema}.ticket_messages message WHERE message.ticket_id = ticket.ticket_id) AS message_count
       FROM ${this.schema}.tickets ticket
       JOIN ${this.schema}.dim_ticket_status status ON status.status_id = ticket.status_id
       JOIN ${this.schema}.dim_ticket_priority priority ON priority.priority_id = ticket.priority_id
       JOIN ${this.schema}.dim_ticket_category category ON category.category_id = ticket.category_id
       WHERE ticket.ticket_id = $1`,
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

  private async resolveCatalogIds(input: Pick<CreateTicketInput, 'status' | 'priority' | 'category'>): Promise<CatalogIds> {
    const result = await this.pool.query(`
      SELECT
        CASE WHEN $1::text IS NULL
          THEN (SELECT status_id FROM ${this.schema}.dim_ticket_status WHERE is_default)
          ELSE (SELECT status_id FROM ${this.schema}.dim_ticket_status WHERE code = $1)
        END AS status_id,
        CASE WHEN $2::text IS NULL
          THEN (SELECT priority_id FROM ${this.schema}.dim_ticket_priority WHERE is_default)
          ELSE (SELECT priority_id FROM ${this.schema}.dim_ticket_priority WHERE code = $2)
        END AS priority_id,
        CASE WHEN $3::text IS NULL
          THEN (SELECT category_id FROM ${this.schema}.dim_ticket_category WHERE is_default)
          ELSE (SELECT category_id FROM ${this.schema}.dim_ticket_category WHERE code = $3)
        END AS category_id
    `, [input.status ?? null, input.priority ?? null, input.category ?? null]);

    const row = result.rows[0] as Record<string, number | null>;
    const fieldErrors: Record<string, string[]> = {};
    const resolved = [
      ['status', input.status, row.status_id],
      ['priority', input.priority, row.priority_id],
      ['category', input.category, row.category_id],
    ] as const;

    for (const [field, code, id] of resolved) {
      if (id !== null) continue;
      if (code === undefined) {
        throw new Error(`Ticket ${field} catalog has no default configured.`);
      }
      fieldErrors[field] = [`Unknown ticket ${field} code: ${code}.`];
    }
    if (Object.keys(fieldErrors).length) throw new CatalogValidationError(fieldErrors);

    return {
      statusId: Number(row.status_id),
      priorityId: Number(row.priority_id),
      categoryId: Number(row.category_id),
    };
  }

  private async resolveStatusId(statusCode: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT status_id FROM ${this.schema}.dim_ticket_status WHERE code = $1`,
      [statusCode],
    );
    if (!result.rowCount) {
      throw new CatalogValidationError({ status: [`Unknown ticket status code: ${statusCode}.`] });
    }
    return Number(result.rows[0].status_id);
  }

  async createTicket(input: CreateTicketInput, author: string): Promise<Ticket> {
    const catalogIds = await this.resolveCatalogIds(input);
    const result = await this.pool.query(
      `WITH inserted AS (
        INSERT INTO ${this.schema}.tickets
          (title, description, status_id, priority_id, category_id, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      )
      SELECT ${ticketColumns()}, 0::int AS message_count
      FROM inserted ticket
      JOIN ${this.schema}.dim_ticket_status status ON status.status_id = ticket.status_id
      JOIN ${this.schema}.dim_ticket_priority priority ON priority.priority_id = ticket.priority_id
      JOIN ${this.schema}.dim_ticket_category category ON category.category_id = ticket.category_id`,
      [
        input.title,
        input.description,
        catalogIds.statusId,
        catalogIds.priorityId,
        catalogIds.categoryId,
        author,
      ],
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
    const statusId = await this.resolveStatusId(input.status);
    const result = await this.pool.query(
      `WITH updated AS (
        UPDATE ${this.schema}.tickets
        SET status_id = $2, updated_at = CURRENT_TIMESTAMP
        WHERE ticket_id = $1
        RETURNING *
      )
      SELECT ${ticketColumns()},
        (SELECT COUNT(*)::int FROM ${this.schema}.ticket_messages message WHERE message.ticket_id = ticket.ticket_id) AS message_count
      FROM updated ticket
      JOIN ${this.schema}.dim_ticket_status status ON status.status_id = ticket.status_id
      JOIN ${this.schema}.dim_ticket_priority priority ON priority.priority_id = ticket.priority_id
      JOIN ${this.schema}.dim_ticket_category category ON category.category_id = ticket.category_id`,
      [ticketId, statusId],
    );
    return result.rowCount ? serializeTicket(result.rows[0]) : null;
  }

  async deleteTicket(ticketId: string): Promise<'deleted' | 'not_found' | 'not_deletable'> {
    const result = await this.pool.query(
      `DELETE FROM ${this.schema}.tickets ticket
       USING ${this.schema}.dim_ticket_status status
       WHERE ticket.ticket_id = $1
         AND status.status_id = ticket.status_id
         AND status.allows_deletion
       RETURNING ticket.ticket_id`,
      [ticketId],
    );
    if (result.rowCount) return 'deleted';

    const existing = await this.pool.query(
      `SELECT 1 FROM ${this.schema}.tickets WHERE ticket_id = $1`,
      [ticketId],
    );
    return existing.rowCount ? 'not_deletable' : 'not_found';
  }
}
