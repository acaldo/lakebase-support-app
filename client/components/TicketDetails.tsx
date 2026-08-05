import { useEffect, useState, type FormEvent } from 'react';
import { CalendarDays, MessageSquarePlus, Trash2, UserRound, X } from 'lucide-react';
import { createMessageSchema } from '../../shared/schemas.js';
import type { TicketCatalogs, TicketDetail, TicketStatus } from '../../shared/types.js';
import { catalogLabel, catalogStyleModifier, formatDateTime, initials } from '../format.js';
import { ConfirmDialog } from './ConfirmDialog.js';

interface TicketDetailsProps {
  ticket?: TicketDetail;
  catalogs: TicketCatalogs;
  loading: boolean;
  statusPending: boolean;
  messagePending: boolean;
  deletePending: boolean;
  onClose: () => void;
  onStatusChange: (status: TicketStatus) => void;
  onAddMessage: (message: string, onSuccess: () => void) => void;
  onDelete: () => void;
}

export function TicketDetails({
  ticket,
  catalogs,
  loading,
  statusPending,
  messagePending,
  deletePending,
  onClose,
  onStatusChange,
  onAddMessage,
  onDelete,
}: TicketDetailsProps) {
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const statusCatalog = ticket
    ? catalogs.statuses.find((status) => status.code === ticket.status)
    : undefined;

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (confirmingDelete && !deletePending) setConfirmingDelete(false);
      else onClose();
    };
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [confirmingDelete, deletePending, onClose]);

  const submitMessage = (event: FormEvent) => {
    event.preventDefault();
    const result = createMessageSchema.safeParse({ message_text: message });
    if (!result.success) {
      setMessageError(result.error.issues[0]?.message ?? 'Please enter a message.');
      return;
    }
    setMessageError('');
    onAddMessage(result.data.message_text, () => setMessage(''));
  };

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="ticket-drawer" role="dialog" aria-modal="true" aria-labelledby="ticket-detail-title">
        <button className="icon-button drawer-close" onClick={onClose} aria-label="Close ticket details"><X /></button>
        {loading || !ticket ? (
          <div className="drawer-loading"><span className="spinner" /> Loading ticket...</div>
        ) : (
          <>
            <header className="ticket-drawer__header">
              <div className="ticket-number">Ticket #{ticket.ticket_id}</div>
              <h2 id="ticket-detail-title">{ticket.title}</h2>
              <div className="badge-row">
                <span className={`priority-badge priority-badge--${catalogStyleModifier(ticket.priority, ['low', 'medium', 'high', 'urgent'])}`}>
                  {catalogLabel(catalogs.priorities, ticket.priority)}
                </span>
                <span className="category-label">{catalogLabel(catalogs.categories, ticket.category)}</span>
              </div>
              {ticket.description && <p className="ticket-description">{ticket.description}</p>}
              <div className="detail-meta">
                <span><UserRound size={16} /> {ticket.created_by}</span>
                <span><CalendarDays size={16} /> {formatDateTime(ticket.created_at)}</span>
              </div>
            </header>

            <section className="status-control" aria-labelledby="status-label">
              <div>
                <span className="eyebrow" id="status-label">Current status</span>
                <strong>{catalogLabel(catalogs.statuses, ticket.status)}</strong>
              </div>
              <label>
                <span className="sr-only">Update ticket status</span>
                <select value={ticket.status} disabled={statusPending} onChange={(event) => onStatusChange(event.target.value as TicketStatus)}>
                  {catalogs.statuses.map((status) => <option key={status.code} value={status.code}>{status.label}</option>)}
                </select>
              </label>
            </section>

            <section className="conversation" aria-labelledby="conversation-title">
              <div className="section-heading">
                <h3 id="conversation-title">Conversation</h3>
                <span>{ticket.messages.length} message{ticket.messages.length === 1 ? '' : 's'}</span>
              </div>
              <div className="message-list">
                {ticket.messages.map((item) => (
                  <article className="message" key={item.message_id}>
                    <span className="avatar" aria-hidden="true">{initials(item.author)}</span>
                    <div>
                      <header><strong>{item.author}</strong><time dateTime={item.created_at}>{formatDateTime(item.created_at)}</time></header>
                      <p>{item.message_text}</p>
                    </div>
                  </article>
                ))}
                {ticket.messages.length === 0 && <p className="empty-messages">No messages yet. Start the conversation below.</p>}
              </div>
              <form className="message-composer" onSubmit={submitMessage} noValidate>
                <label>
                  <span className="sr-only">Add a message</span>
                  <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} placeholder="Write a reply..." />
                </label>
                {messageError && <small className="field-error">{messageError}</small>}
                <button className="button button--primary" type="submit" disabled={messagePending}>
                  <MessageSquarePlus size={17} /> {messagePending ? 'Sending...' : 'Add message'}
                </button>
              </form>
            </section>

            {statusCatalog?.allows_deletion && (
              <section className="danger-zone">
                <div>
                  <strong>Delete ticket</strong>
                  <p>Permanently remove this ticket and its conversation.</p>
                </div>
                <button className="button button--danger-outline" onClick={() => setConfirmingDelete(true)}>
                  <Trash2 size={17} /> Delete ticket
                </button>
              </section>
            )}
            <ConfirmDialog
              open={confirmingDelete}
              ticketTitle={ticket.title}
              pending={deletePending}
              onCancel={() => setConfirmingDelete(false)}
              onConfirm={onDelete}
            />
          </>
        )}
      </aside>
    </div>
  );
}
