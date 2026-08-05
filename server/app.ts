import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import { ZodError, type ZodType } from 'zod';
import {
  createMessageSchema,
  createTicketSchema,
  updateStatusSchema,
} from '../shared/schemas.js';
import { CatalogValidationError, type TicketRepository } from './ticket-repository.js';

interface AppDependencies {
  repository: TicketRepository;
  provider: 'local' | 'lakebase';
  localDevUser: string;
  serveClient?: boolean;
}

interface ApiError extends Error {
  status?: number;
  code?: string;
}

function asyncRoute(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<void>,
) {
  return (request: Request, response: Response, next: NextFunction) => {
    void handler(request, response, next).catch(next);
  };
}

function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  return schema.parse(body);
}

function notFound(message: string): ApiError {
  const error = new Error(message) as ApiError;
  error.status = 404;
  error.code = 'NOT_FOUND';
  return error;
}

function conflict(message: string): ApiError {
  const error = new Error(message) as ApiError;
  error.status = 409;
  error.code = 'INVALID_STATE';
  return error;
}

function getAuthor(request: Request, dependencies: AppDependencies): string {
  if (dependencies.provider === 'lakebase') {
    return request.header('x-forwarded-email')?.trim() || 'unknown@databricks.local';
  }
  return dependencies.localDevUser;
}

export function createApp(dependencies: AppDependencies) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', asyncRoute(async (_request, response) => {
    await dependencies.repository.health();
    response.json({ status: 'ok', database: dependencies.provider });
  }));

  app.get('/api/tickets', asyncRoute(async (_request, response) => {
    response.json({ tickets: await dependencies.repository.listTickets() });
  }));

  app.get('/api/ticket-catalogs', asyncRoute(async (_request, response) => {
    response.json({ catalogs: await dependencies.repository.getTicketCatalogs() });
  }));

  app.get('/api/tickets/:ticketId', asyncRoute(async (request, response) => {
    const ticket = await dependencies.repository.getTicket(String(request.params.ticketId));
    if (!ticket) throw notFound('Ticket not found.');
    response.json({ ticket });
  }));

  app.post('/api/tickets', asyncRoute(async (request, response) => {
    const input = parseBody(createTicketSchema, request.body);
    const ticket = await dependencies.repository.createTicket(
      input,
      getAuthor(request, dependencies),
    );
    response.status(201).json({ ticket });
  }));

  app.post('/api/tickets/:ticketId/messages', asyncRoute(async (request, response) => {
    const input = parseBody(createMessageSchema, request.body);
    const message = await dependencies.repository.addMessage(
      String(request.params.ticketId),
      input,
      getAuthor(request, dependencies),
    );
    if (!message) throw notFound('Ticket not found.');
    response.status(201).json({ message });
  }));

  app.patch('/api/tickets/:ticketId/status', asyncRoute(async (request, response) => {
    const input = parseBody(updateStatusSchema, request.body);
    const ticket = await dependencies.repository.updateStatus(String(request.params.ticketId), input);
    if (!ticket) throw notFound('Ticket not found.');
    response.json({ ticket });
  }));

  app.delete('/api/tickets/:ticketId', asyncRoute(async (request, response) => {
    const result = await dependencies.repository.deleteTicket(String(request.params.ticketId));
    if (result === 'not_found') throw notFound('Ticket not found.');
    if (result === 'not_deletable') throw conflict('The current ticket status does not allow deletion.');
    response.status(204).send();
  }));

  app.use('/api', (_request, response) => {
    response.status(404).json({ error: { code: 'NOT_FOUND', message: 'API route not found.' } });
  });

  if (dependencies.serveClient) {
    const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
    const clientDirectory = path.resolve(currentDirectory, '../../client');
    app.use(express.static(clientDirectory));
    app.use((request, response, next) => {
      if (request.method !== 'GET') return next();
      response.sendFile(path.join(clientDirectory, 'index.html'));
    });
  }

  app.use((error: ApiError | ZodError, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof CatalogValidationError) {
      response.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          fieldErrors: error.fieldErrors,
        },
      });
      return;
    }

    if (error instanceof ZodError) {
      response.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please check the submitted values.',
          fieldErrors: error.flatten().fieldErrors,
        },
      });
      return;
    }

    const status = error.status ?? 500;
    if (status >= 500) console.error('Unhandled API error:', error.message);
    response.status(status).json({
      error: {
        code: error.code ?? 'INTERNAL_ERROR',
        message: status >= 500 ? 'The server could not complete the request.' : error.message,
      },
    });
  });

  return app;
}
