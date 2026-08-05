// @vitest-environment node

import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { runMigrations } from './db/migrate.js';
import { TicketRepository } from './ticket-repository.js';

const connectionString = process.env.TEST_DATABASE_URL;
const integrationSuite = describe.skipIf(!connectionString);
const schema = `support_board_test_${Date.now()}`;
const { Pool } = pg;
let pool: pg.Pool;
let app: ReturnType<typeof createApp>;

integrationSuite('Support Board API with PostgreSQL 17', () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString });
    await runMigrations(pool, schema);
    app = createApp({
      repository: new TicketRepository(pool, schema),
      provider: 'local',
      localDevUser: 'integration.tester@example.com',
    });
  });

  afterAll(async () => {
    if (!pool) return;
    if (!/^support_board_test_\d+$/.test(schema)) throw new Error('Refusing to remove an unexpected test schema.');
    await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await pool.end();
  });

  it('loads the required idempotent sample data', async () => {
    await runMigrations(pool, schema);
    const [ticketsResponse, catalogsResponse] = await Promise.all([
      request(app).get('/api/tickets').expect(200),
      request(app).get('/api/ticket-catalogs').expect(200),
    ]);

    expect(ticketsResponse.body.tickets).toHaveLength(4);
    expect(new Set(ticketsResponse.body.tickets.map((ticket: any) => ticket.status)).size).toBeGreaterThanOrEqual(2);
    expect(ticketsResponse.body.tickets.every((ticket: any) => ticket.message_count >= 2)).toBe(true);
    expect(ticketsResponse.body.tickets.map((ticket: any) => ticket.priority)).toEqual([
      'urgent',
      'high',
      'medium',
      'low',
    ]);
    expect(catalogsResponse.body.catalogs.statuses.map((item: any) => item.code)).toEqual([
      'open',
      'in_progress',
      'resolved',
      'archived',
    ]);
    expect(catalogsResponse.body.catalogs.priorities.map((item: any) => item.code)).toEqual([
      'urgent',
      'high',
      'medium',
      'low',
    ]);
    expect(catalogsResponse.body.catalogs.statuses.find((item: any) => item.code === 'open')).toMatchObject({
      is_default: true,
      progress_percent: 28,
      allows_deletion: false,
    });
  });

  it('uses dimension foreign keys without catalog check constraints', async () => {
    const columns = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'tickets'`,
      [schema],
    );
    const columnNames = columns.rows.map((row) => row.column_name);
    expect(columnNames).toEqual(expect.arrayContaining(['status_id', 'priority_id', 'category_id']));
    expect(columnNames).not.toEqual(expect.arrayContaining(['status', 'priority', 'category']));

    const constraints = await pool.query(
      `SELECT contype, pg_get_constraintdef(oid) AS definition
       FROM pg_constraint
       WHERE conrelid = to_regclass($1)`,
      [`${schema}.tickets`],
    );
    expect(constraints.rows.filter((row) => row.contype === 'f')).toHaveLength(3);
    const ticketChecks = constraints.rows
      .filter((row) => row.contype === 'c')
      .map((row) => row.definition);
    expect(ticketChecks).toHaveLength(2);
    expect(ticketChecks.join(' ')).toContain('char_length');
    expect(ticketChecks.join(' ')).not.toContain('status');
    expect(ticketChecks.join(' ')).not.toContain('priority');
    expect(ticketChecks.join(' ')).not.toContain('category');

    const messageChecks = await pool.query(
      `SELECT pg_get_constraintdef(oid) AS definition
       FROM pg_constraint
       WHERE conrelid = to_regclass($1) AND contype = 'c'`,
      [`${schema}.ticket_messages`],
    );
    expect(messageChecks.rows.some((row) => row.definition.includes('char_length'))).toBe(true);
  });

  it('accepts a new database catalog value without application code changes', async () => {
    await pool.query(
      `INSERT INTO "${schema}".dim_ticket_status
        (code, label, sort_order, progress_percent, allows_deletion)
       VALUES ('waiting_for_customer', 'Waiting for customer', 25, 75, FALSE)`,
    );

    await request(app)
      .get('/api/ticket-catalogs')
      .expect(200)
      .expect((response) => {
        expect(response.body.catalogs.statuses).toContainEqual(expect.objectContaining({
          code: 'waiting_for_customer',
          label: 'Waiting for customer',
          progress_percent: 75,
        }));
      });

    const created = await request(app)
      .post('/api/tickets')
      .send({ title: 'Customer confirmation required' })
      .expect(201);
    expect(created.body.ticket).toMatchObject({
      status: 'open',
      priority: 'medium',
      category: 'other',
    });

    await request(app)
      .patch(`/api/tickets/${created.body.ticket.ticket_id}/status`)
      .send({ status: 'waiting_for_customer' })
      .expect(200)
      .expect((response) => expect(response.body.ticket.status).toBe('waiting_for_customer'));
  });

  it('creates, reads, updates, messages, and deletes a ticket with cascading messages', async () => {
    const created = await request(app)
      .post('/api/tickets')
      .send({
        title: 'Email client cannot connect',
        description: 'Connection fails after the latest update.',
        priority: 'high',
        category: 'software',
      })
      .expect(201);
    const ticketId = created.body.ticket.ticket_id as string;
    expect(created.body.ticket.created_by).toBe('integration.tester@example.com');

    const message = await request(app)
      .post(`/api/tickets/${ticketId}/messages`)
      .send({ message_text: 'I can provide the diagnostic logs.' })
      .expect(201);
    expect(message.body.message.author).toBe('integration.tester@example.com');

    await request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .send({ status: 'in_progress' })
      .expect(200)
      .expect((response) => expect(response.body.ticket.status).toBe('in_progress'));

    await request(app)
      .get(`/api/tickets/${ticketId}`)
      .expect(200)
      .expect((response) => expect(response.body.ticket.messages).toHaveLength(1));

    await request(app).delete(`/api/tickets/${ticketId}`).expect(409);
    await request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .send({ status: 'archived' })
      .expect(200);
    await request(app).delete(`/api/tickets/${ticketId}`).expect(204);
    await request(app).get(`/api/tickets/${ticketId}`).expect(404);

    const remainingMessages = await pool.query(
      `SELECT COUNT(*)::int AS count FROM "${schema}".ticket_messages WHERE ticket_id = $1`,
      [ticketId],
    );
    expect(remainingMessages.rows[0].count).toBe(0);
    await request(app).delete(`/api/tickets/${ticketId}`).expect(404);
  });

  it('returns helpful validation errors and does not expose a message delete route', async () => {
    await request(app)
      .post('/api/tickets')
      .send({ title: 'x', priority: 'impossible' })
      .expect(400)
      .expect((response) => {
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.fieldErrors.title).toBeDefined();
      });

    await request(app)
      .post('/api/tickets')
      .send({ title: 'Valid ticket title', priority: 'impossible' })
      .expect(400)
      .expect((response) => {
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.fieldErrors.priority).toBeDefined();
      });

    await request(app)
      .patch('/api/tickets/1/status')
      .send({ status: 'does_not_exist' })
      .expect(400)
      .expect((response) => expect(response.body.error.fieldErrors.status).toBeDefined());

    await request(app).post('/api/tickets/999999999/messages').send({ message_text: 'Hello' }).expect(404);
    await request(app).delete('/api/tickets/1/messages/1').expect(404);
  });
});
