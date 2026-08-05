import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  ticketTitle: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({ open, ticketTitle, pending, onCancel, onConfirm }: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="modal-backdrop modal-backdrop--nested" role="presentation">
      <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description">
        <button className="icon-button confirm-dialog__close" onClick={onCancel} disabled={pending} aria-label="Close"><X size={19} /></button>
        <span className="danger-icon" aria-hidden="true"><AlertTriangle /></span>
        <h2 id="delete-title">Delete this ticket?</h2>
        <p id="delete-description">
          <strong>“{ticketTitle}”</strong> and all of its messages will be permanently deleted. This action cannot be undone.
        </p>
        <div className="modal__actions">
          <button className="button button--secondary" onClick={onCancel} disabled={pending}>Cancel</button>
          <button className="button button--danger" onClick={onConfirm} disabled={pending}>{pending ? 'Deleting...' : 'Delete ticket'}</button>
        </div>
      </section>
    </div>
  );
}
