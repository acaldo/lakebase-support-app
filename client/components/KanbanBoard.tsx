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
import type {
  Ticket,
  TicketCatalogs,
  TicketStatus,
  TicketStatusCatalogItem,
} from '../../shared/types.js';
import {
  catalogLabel,
  catalogStyleModifier,
  domToken,
  formatDate,
  initials,
} from '../format.js';

interface KanbanBoardProps {
  tickets: Ticket[];
  catalogs: TicketCatalogs;
  onSelect: (ticketId: string) => void;
  onStatusChange: (ticketId: string, status: TicketStatus) => void;
  onDeleteRequest: (ticket: Ticket) => void;
  statusChangePending: boolean;
}

interface TicketCardProps {
  ticket: Ticket;
  catalogs: TicketCatalogs;
  onSelect?: (ticketId: string) => void;
  overlay?: boolean;
  disabled?: boolean;
  onDeleteRequest?: (ticket: Ticket) => void;
}

const STYLED_STATUSES = ['open', 'in_progress', 'resolved', 'archived'] as const;
const STYLED_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

function TicketCard({
  ticket,
  catalogs,
  onSelect,
  onDeleteRequest,
  overlay = false,
  disabled = false,
}: TicketCardProps) {
  const sortable = useSortable({
    id: `ticket:${ticket.ticket_id}`,
    data: { type: 'ticket', ticket, status: ticket.status },
    disabled: overlay || disabled,
  });
  const statusCatalog = catalogs.statuses.find((status) => status.code === ticket.status);
  const progressPercent = statusCatalog?.progress_percent ?? 0;
  const statusStyle = catalogStyleModifier(ticket.status, STYLED_STATUSES);
  const priorityStyle = catalogStyleModifier(ticket.priority, STYLED_PRIORITIES);
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
        <span className={`priority-badge priority-badge--${priorityStyle}`}>
          {catalogLabel(catalogs.priorities, ticket.priority)}
        </span>
        {!overlay && (
          <div className="ticket-card__actions">
            {statusCatalog?.allows_deletion && onDeleteRequest && (
              <button
                className="delete-ticket-button"
                type="button"
                aria-label={`Delete ${ticket.title}`}
                title="Delete ticket"
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
      <span className="category-label">{catalogLabel(catalogs.categories, ticket.category)}</span>
      <div className="ticket-card__meta">
        <span><CalendarDays size={14} /> {formatDate(ticket.created_at)}</span>
        <span><MessageCircle size={14} /> {ticket.message_count}</span>
      </div>
      <div className="ticket-card__author">
        <span className="avatar" aria-hidden="true">{initials(ticket.created_by)}</span>
        <span>{ticket.created_by}</span>
      </div>
      <div
        className={`ticket-card__progress ticket-card__progress--${statusStyle}`}
        role="progressbar"
        aria-label={`${progressPercent}% complete`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent}
      >
        <span style={{ width: `${progressPercent}%` }} />
      </div>
    </article>
  );
}

interface KanbanColumnProps {
  status: TicketStatusCatalogItem;
  tickets: Ticket[];
  children: React.ReactNode;
  collapsed: boolean;
  onToggle: () => void;
}

function KanbanColumn({ status, tickets, children, collapsed, onToggle }: KanbanColumnProps) {
  const droppable = useDroppable({
    id: `column:${status.code}`,
    data: { type: 'column', status: status.code },
  });
  const statusToken = domToken(status.code);
  const statusStyle = catalogStyleModifier(status.code, STYLED_STATUSES);
  return (
    <section
      className={`kanban-column kanban-column--${statusStyle} ${collapsed ? 'is-collapsed' : ''}`}
      aria-labelledby={`heading-${statusToken}`}
    >
      <header>
        <button
          className="column-toggle"
          type="button"
          aria-expanded={!collapsed}
          aria-controls={`column-body-${statusToken}`}
          onClick={onToggle}
        >
          <span className="status-dot" aria-hidden="true" />
          <h2 id={`heading-${statusToken}`}>{status.label}</h2>
          <span className="column-count">{tickets.length}</span>
          <ChevronDown className="column-toggle__icon" size={17} aria-hidden="true" />
        </button>
      </header>
      <div
        id={`column-body-${statusToken}`}
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

export function KanbanBoard({
  tickets,
  catalogs,
  onSelect,
  onStatusChange,
  onDeleteRequest,
  statusChangePending,
}: KanbanBoardProps) {
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>({});
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const grouped = useMemo(() => Object.fromEntries(
    catalogs.statuses.map((status) => [
      status.code,
      tickets.filter((ticket) => ticket.status === status.code),
    ]),
  ) as Record<string, Ticket[]>, [catalogs.statuses, tickets]);

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
        {catalogs.statuses.map((status) => (
          <KanbanColumn
            status={status}
            tickets={grouped[status.code] ?? []}
            key={status.code}
            collapsed={collapsedColumns[status.code] ?? false}
            onToggle={() => setCollapsedColumns((current) => ({
              ...current,
              [status.code]: !(current[status.code] ?? false),
            }))}
          >
            {(grouped[status.code] ?? []).map((ticket) => (
              <TicketCard
                ticket={ticket}
                catalogs={catalogs}
                key={ticket.ticket_id}
                onSelect={onSelect}
                onDeleteRequest={onDeleteRequest}
                disabled={statusChangePending}
              />
            ))}
          </KanbanColumn>
        ))}
      </section>
      <DragOverlay>
        {activeTicket ? <TicketCard ticket={activeTicket} catalogs={catalogs} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
