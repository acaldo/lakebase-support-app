import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { createTicketSchema, type CreateTicketInput } from '../../shared/schemas.js';
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from '../../shared/types.js';
import { CATEGORY_LABELS, PRIORITY_LABELS } from '../format.js';

interface NewTicketModalProps {
  open: boolean;
  pending: boolean;
  onClose: () => void;
  onCreate: (input: CreateTicketInput) => void;
}

const EMPTY_TICKET: CreateTicketInput = {
  title: '',
  description: '',
  status: 'open',
  priority: 'medium',
  category: 'other',
};

export function NewTicketModal({ open, pending, onClose, onCreate }: NewTicketModalProps) {
  const [form, setForm] = useState<CreateTicketInput>(EMPTY_TICKET);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!open) return;
    const listener = (event: KeyboardEvent) => event.key === 'Escape' && !pending && onClose();
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [open, pending, onClose]);

  if (!open) return null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = createTicketSchema.safeParse(form);
    if (!result.success) {
      setErrors(result.error.flatten().fieldErrors);
      return;
    }
    setErrors({});
    onCreate(result.data);
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !pending && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="new-ticket-title">
        <header className="modal__header">
          <div>
            <span className="eyebrow">New request</span>
            <h2 id="new-ticket-title">Create support ticket</h2>
          </div>
          <button className="icon-button" onClick={onClose} disabled={pending} aria-label="Close"><X /></button>
        </header>
        <form onSubmit={submit} className="form-stack" noValidate>
          <label className="form-field">
            <span>Title</span>
            <input autoFocus value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="What do you need help with?" />
            {errors.title?.[0] && <small className="field-error">{errors.title[0]}</small>}
          </label>
          <label className="form-field">
            <span>Description <em>optional</em></span>
            <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} placeholder="Add context that will help the support team..." />
            {errors.description?.[0] && <small className="field-error">{errors.description[0]}</small>}
          </label>
          <div className="form-row">
            <label className="form-field">
              <span>Priority</span>
              <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as CreateTicketInput['priority'] })}>
                {TICKET_PRIORITIES.map((priority) => <option key={priority} value={priority}>{PRIORITY_LABELS[priority]}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span>Category</span>
              <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as CreateTicketInput['category'] })}>
                {TICKET_CATEGORIES.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}
              </select>
            </label>
          </div>
          <footer className="modal__actions">
            <button className="button button--secondary" type="button" onClick={onClose} disabled={pending}>Cancel</button>
            <button className="button button--primary" type="submit" disabled={pending}>{pending ? 'Creating...' : 'Create ticket'}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
