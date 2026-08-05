import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CalendarDays, ChevronDown, GripVertical, MessageCircle, Trash2 } from 'lucide-react';
import { TICKET_STATUSES, type Ticket, type TicketStatus } from '../../shared/types.js';
import { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS, formatDate, initials } from '../format.js';

interface KanbanBoardProps {
  tickets: Ticket[];
  onSelect: (ticketId: string) => void;
  onStatusChange: (ticketId: string, status: TicketStatus) => void;
  onDeleteRequest: (ticket: Ticket) => void;
  statusChangePending: boolean;
}

interface TicketCardProps {
  ticket: Ticket;
  onSelect?: (ticketId: string) => void;
  overlay?: boolean;
  disabled?: boolean;
  onDeleteRequest?: (ticket: Ticket) => void;
}

const STATUS_PROGRESS: Record<TicketStatus, number> = {
  open: 28,
  in_progress: 64,
  resolved: 100,
  archived: 100,
};

function TicketCard({ ticket, onSelect, onDeleteRequest, overlay = false, disabled = false }: TicketCardProps) {
  const sortable = useSortable({
    id: `ticket:${ticket.ticket_id}`,
    data: { type: 'ticket', ticket, status: ticket.status },
    disabled: overlay || disabled,
  });
  const style = overlay
    ? undefined
    : { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };

  return (
    <article
      ref={sortable.setNodeRef}
      style={style}
      className={`ticket-card ${overlay ? 'ticket-card--overlay' : ''} ${sortable.isDragging ? 'ticket-card--dragging' : ''}`}
      onClick={() => onSelect?.(ticket.ticket_id)}
      data-testid={`ticket-card-${ticket.ticket_id}`}
    >
      <div className="ticket-card__topline">
        <span className={`priority-badge priority-badge--${ticket.priority}`}>{PRIORITY_LABELS[ticket.priority]}</span>
        {!overlay && (
          <div className="ticket-card__actions">
            {ticket.status === 'archived' && onDeleteRequest && (
              <button
                className="delete-ticket-button"
                type="button"
                aria-label={`Delete ${ticket.title}`}
                title="Delete archived ticket"
                onClick={(event) => { event.stopPropagation(); onDeleteRequest(ticket); }}
              >
                <Trash2 size={16} />
              </button>
            )}
            <button
              className="drag-handle"
              type="button"
              aria-label={`Move ${ticket.title}`}
              onClick={(event) => event.stopPropagation()}
              {...sortable.attributes}
              {...sortable.listeners}
            >
              <GripVertical size={18} />
            </button>
          </div>
        )}
      </div>
      <h3>{ticket.title}</h3>
      {ticket.description && <p>{ticket.description}</p>}
      <span className="category-label">{CATEGORY_LABELS[ticket.category]}</span>
      <div className="ticket-card__meta">
        <span><CalendarDays size={14} /> {formatDate(ticket.created_at)}</span>
        <span><MessageCircle size={14} /> {ticket.message_count}</span>
      </div>
      <div className="ticket-card__author">
        <span className="avatar" aria-hidden="true">{initials(ticket.created_by)}</span>
        <span>{ticket.created_by}</span>
      </div>
      <div
        className={`ticket-card__progress ticket-card__progress--${ticket.status}`}
        role="progressbar"
        aria-label={`${STATUS_PROGRESS[ticket.status]}% complete`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={STATUS_PROGRESS[ticket.status]}
      >
        <span style={{ width: `${STATUS_PROGRESS[ticket.status]}%` }} />
      </div>
    </article>
  );
}

interface KanbanColumnProps {
  status: TicketStatus;
  tickets: Ticket[];
  children: React.ReactNode;
  collapsed: boolean;
  onToggle: () => void;
}

function KanbanColumn({ status, tickets, children, collapsed, onToggle }: KanbanColumnProps) {
  const droppable = useDroppable({ id: `column:${status}`, data: { type: 'column', status } });
  return (
    <section className={`kanban-column kanban-column--${status} ${collapsed ? 'is-collapsed' : ''}`} aria-labelledby={`heading-${status}`}>
      <header>
        <button
          className="column-toggle"
          type="button"
          aria-expanded={!collapsed}
          aria-controls={`column-body-${status}`}
          onClick={onToggle}
        >
          <span className="status-dot" aria-hidden="true" />
          <h2 id={`heading-${status}`}>{STATUS_LABELS[status]}</h2>
          <span className="column-count">{tickets.length}</span>
          <ChevronDown className="column-toggle__icon" size={17} aria-hidden="true" />
        </button>
      </header>
      <div
        id={`column-body-${status}`}
        ref={droppable.setNodeRef}
        className={`kanban-column__body ${droppable.isOver ? 'is-over' : ''}`}
        hidden={collapsed}
      >
        {!collapsed && (
          <>
            <SortableContext items={tickets.map((ticket) => `ticket:${ticket.ticket_id}`)} strategy={verticalListSortingStrategy}>
              {children}
            </SortableContext>
            {tickets.length === 0 && <div className="empty-column">Drop tickets here</div>}
          </>
        )}
      </div>
    </section>
  );
}

export function KanbanBoard({ tickets, onSelect, onStatusChange, onDeleteRequest, statusChangePending }: KanbanBoardProps) {
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [collapsedColumns, setCollapsedColumns] = useState<Record<TicketStatus, boolean>>({
    open: false,
    in_progress: false,
    resolved: false,
    archived: false,
  });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const grouped = useMemo(() => Object.fromEntries(
    TICKET_STATUSES.map((status) => [status, tickets.filter((ticket) => ticket.status === status)]),
  ) as Record<TicketStatus, Ticket[]>, [tickets]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTicket((event.active.data.current?.ticket as Ticket | undefined) ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const ticket = event.active.data.current?.ticket as Ticket | undefined;
    const destination = event.over?.data.current?.status as TicketStatus | undefined;
    setActiveTicket(null);
    if (ticket && destination && destination !== ticket.status) {
      onStatusChange(ticket.ticket_id, destination);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragCancel={() => setActiveTicket(null)}
      onDragEnd={handleDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable: 'To pick up a draggable ticket, press the space bar. While dragging, use the arrow keys to move it. Press space again to drop it, or press escape to cancel.',
        },
      }}
    >
      <section className="kanban-board" aria-label="Support ticket board">
        {TICKET_STATUSES.map((status) => (
          <KanbanColumn
            status={status}
            tickets={grouped[status]}
            key={status}
            collapsed={collapsedColumns[status]}
            onToggle={() => setCollapsedColumns((current) => ({ ...current, [status]: !current[status] }))}
          >
            {grouped[status].map((ticket) => (
              <TicketCard
                ticket={ticket}
                key={ticket.ticket_id}
                onSelect={onSelect}
                onDeleteRequest={onDeleteRequest}
                disabled={statusChangePending}
              />
            ))}
          </KanbanColumn>
        ))}
      </section>
      <DragOverlay>{activeTicket ? <TicketCard ticket={activeTicket} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}
