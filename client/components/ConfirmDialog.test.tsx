import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog.js';

describe('ConfirmDialog', () => {
  it('names the ticket and requires an explicit destructive confirmation', async () => {
    const user = userEvent.setup();
    const cancel = vi.fn();
    const confirm = vi.fn();
    render(
      <ConfirmDialog
        open
        ticketTitle="VPN access request"
        pending={false}
        onCancel={cancel}
        onConfirm={confirm}
      />,
    );

    expect(screen.getByRole('alertdialog')).toHaveTextContent('VPN access request');
    expect(screen.getByRole('alertdialog')).toHaveTextContent('all of its messages');
    await user.click(screen.getByRole('button', { name: 'Delete ticket' }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(cancel).not.toHaveBeenCalled();
  });

  it('disables confirmation while deletion is pending', () => {
    render(
      <ConfirmDialog
        open
        ticketTitle="Example"
        pending
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Deleting...' })).toBeDisabled();
  });
});
