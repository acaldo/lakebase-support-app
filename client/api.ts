import type {
  CreateMessageInput,
  CreateTicketInput,
  UpdateStatusInput,
} from '../shared/schemas.js';
import type { ApiErrorBody, Ticket, TicketDetail, TicketMessage } from '../shared/types.js';

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiClientError(
      body?.error.message ?? `Request failed with status ${response.status}.`,
      response.status,
      body?.error.fieldErrors,
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const ticketApi = {
  async list(): Promise<Ticket[]> {
    const response = await apiRequest<{ tickets: Ticket[] }>('/api/tickets');
    return response.tickets;
  },
  async detail(ticketId: string): Promise<TicketDetail> {
    const response = await apiRequest<{ ticket: TicketDetail }>(`/api/tickets/${ticketId}`);
    return response.ticket;
  },
  async create(input: CreateTicketInput): Promise<Ticket> {
    const response = await apiRequest<{ ticket: Ticket }>('/api/tickets', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return response.ticket;
  },
  async addMessage(ticketId: string, input: CreateMessageInput): Promise<TicketMessage> {
    const response = await apiRequest<{ message: TicketMessage }>(
      `/api/tickets/${ticketId}/messages`,
      { method: 'POST', body: JSON.stringify(input) },
    );
    return response.message;
  },
  async updateStatus(ticketId: string, input: UpdateStatusInput): Promise<Ticket> {
    const response = await apiRequest<{ ticket: Ticket }>(
      `/api/tickets/${ticketId}/status`,
      { method: 'PATCH', body: JSON.stringify(input) },
    );
    return response.ticket;
  },
  async delete(ticketId: string): Promise<void> {
    await apiRequest<void>(`/api/tickets/${ticketId}`, { method: 'DELETE' });
  },
};
