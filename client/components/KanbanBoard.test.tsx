import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Ticket, TicketCatalogs } from '../../shared/types.js';
import { KanbanBoard } from './KanbanBoard.js';

const catalogs: TicketCatalogs = {
  statuses: [
    {
      code: 'waiting_for_customer',
      label: 'Waiting for customer',
      sort_order: 10,
      is_default: true,
      progress_percent: 75,
      allows_deletion: true,
    },
  ],
  priorities: [
    { code: 'normal', label: 'Normal', sort_order: 10, is_default: true },
  ],
  categories: [
    { code: 'requests', label: 'Requests', sort_order: 10, is_default: true },
  ],
};

const ticket: Ticket = {
  ticket_id: '42',
  title: 'Confirm maintenance window',
  description: 'Waiting for the customer to confirm a time.',
  status: 'waiting_for_customer',
  priority: 'normal',
  category: 'requests',
  created_by: 'support@example.com',
  created_at: '2026-08-04T12:00:00.000Z',
  updated_at: '2026-08-04T12:00:00.000Z',
  message_count: 1,
};

describe('KanbanBoard database catalogs', () => {
  it('renders a new status and applies its progress and deletion behavior', async () => {
    const user = userEvent.setup();
    const deleteRequest = vi.fn();
    render(
      <KanbanBoard
        tickets={[ticket]}
        catalogs={catalogs}
        onSelect={vi.fn()}
        onStatusChange={vi.fn()}
        onDeleteRequest={deleteRequest}
        statusChangePending={false}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Waiting for customer' })).toBeVisible();
    expect(screen.getByText('Normal')).toBeVisible();
    expect(screen.getByText('Requests')).toBeVisible();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '75');

    await user.click(screen.getByRole('button', { name: 'Delete Confirm maintenance window' }));
    expect(deleteRequest).toHaveBeenCalledWith(ticket);
  });
});
