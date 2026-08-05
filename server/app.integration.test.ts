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
    const response = await request(app).get('/api/tickets').expect(200);

    expect(response.body.tickets).toHaveLength(4);
    expect(new Set(response.body.tickets.map((ticket: any) => ticket.status)).size).toBeGreaterThanOrEqual(2);
    expect(response.body.tickets.every((ticket: any) => ticket.message_count >= 2)).toBe(true);
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

    await request(app).post('/api/tickets/999999999/messages').send({ message_text: 'Hello' }).expect(404);
    await request(app).delete('/api/tickets/1/messages/1').expect(404);
  });
});
