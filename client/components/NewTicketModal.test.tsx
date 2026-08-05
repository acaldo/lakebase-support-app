import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NewTicketModal } from './NewTicketModal.js';

describe('NewTicketModal', () => {
  it('validates required fields before creating a ticket', async () => {
    const user = userEvent.setup();
    const create = vi.fn();
    render(<NewTicketModal open pending={false} onClose={vi.fn()} onCreate={create} />);

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
      status: 'open',
    }));
  });
});
