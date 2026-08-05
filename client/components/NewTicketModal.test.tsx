import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NewTicketModal } from './NewTicketModal.js';

const catalogs = {
  statuses: [
    { code: 'queued', label: 'Queued', sort_order: 10, is_default: true, progress_percent: 5, allows_deletion: false },
  ],
  priorities: [
    { code: 'normal', label: 'Normal', sort_order: 10, is_default: true },
    { code: 'high', label: 'High', sort_order: 20, is_default: false },
  ],
  categories: [
    { code: 'general', label: 'General', sort_order: 10, is_default: true },
    { code: 'hardware', label: 'Hardware', sort_order: 20, is_default: false },
  ],
};

describe('NewTicketModal', () => {
  it('validates required fields before creating a ticket', async () => {
    const user = userEvent.setup();
    const create = vi.fn();
    render(<NewTicketModal open pending={false} catalogs={catalogs} onClose={vi.fn()} onCreate={create} />);

    await user.click(screen.getByRole('button', { name: 'Create ticket' }));
    expect(await screen.findByText('Title must contain at least 3 characters.')).toBeVisible();
    expect(create).not.toHaveBeenCalled();

    await user.type(screen.getByPlaceholderText('What do you need help with?'), 'Printer needs toner');
    await user.selectOptions(screen.getByLabelText('Priority'), 'high');
    await user.selectOptions(screen.getByLabelText('Category'), 'hardware');
    await user.click(screen.getByRole('button', { name: 'Create ticket' }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Printer needs toner',
      priority: 'high',
      category: 'hardware',
      status: 'queued',
    }));
  });
});
