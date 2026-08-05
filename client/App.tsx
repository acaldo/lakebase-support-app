import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Headphones, Plus, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import type { CreateTicketInput } from '../shared/schemas.js';
import type { Ticket, TicketStatus } from '../shared/types.js';
import { ticketApi } from './api.js';
import { FilterBar } from './components/FilterBar.js';
import { EMPTY_FILTERS, type TicketFilters } from './filter-types.js';
import { KanbanBoard } from './components/KanbanBoard.js';
import { NewTicketModal } from './components/NewTicketModal.js';
import { TicketDetails } from './components/TicketDetails.js';
import { ConfirmDialog } from './components/ConfirmDialog.js';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export default function App() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<TicketFilters>(EMPTY_FILTERS);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Ticket | null>(null);

  const ticketsQuery = useQuery({
    queryKey: ['tickets'],
    queryFn: ticketApi.list,
  });
  const detailQuery = useQuery({
    queryKey: ['ticket', selectedTicketId],
    queryFn: () => ticketApi.detail(selectedTicketId!),
    enabled: Boolean(selectedTicketId),
  });

  const createMutation = useMutation({
    mutationFn: ticketApi.create,
    onSuccess: (ticket) => {
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setNewTicketOpen(false);
      setSelectedTicketId(ticket.ticket_id);
      toast.success('Ticket created successfully.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const statusMutation = useMutation({
    mutationFn: ({ ticketId, status }: { ticketId: string; status: TicketStatus }) => ticketApi.updateStatus(ticketId, { status }),
    onMutate: async ({ ticketId, status }) => {
      await queryClient.cancelQueries({ queryKey: ['tickets'] });
      const previous = queryClient.getQueryData<Ticket[]>(['tickets']);
      queryClient.setQueryData<Ticket[]>(['tickets'], (current = []) => current.map((ticket) => (
        ticket.ticket_id === ticketId ? { ...ticket, status } : ticket
      )));
      queryClient.setQueryData(['ticket', ticketId], (current: any) => current ? { ...current, status } : current);
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(['tickets'], context.previous);
      if (selectedTicketId) void queryClient.invalidateQueries({ queryKey: ['ticket', selectedTicketId] });
      toast.error(`Status was not updated. ${errorMessage(error)}`);
    },
    onSuccess: (ticket) => {
      queryClient.setQueryData(['ticket', ticket.ticket_id], (current: any) => current ? { ...current, ...ticket } : current);
      toast.success('Ticket status updated.');
    },
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
      void queryClient.invalidateQueries({ queryKey: ['ticket', variables.ticketId] });
    },
  });

  const messageMutation = useMutation({
    mutationFn: ({ ticketId, message }: { ticketId: string; message: string; onSuccess: () => void }) => ticketApi.addMessage(ticketId, { message_text: message }),
    onSuccess: (_message, variables) => {
      variables.onSuccess();
      void queryClient.invalidateQueries({ queryKey: ['ticket', variables.ticketId] });
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast.success('Message added.');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: ticketApi.delete,
    onSuccess: () => {
      setDeleteTarget(null);
      setSelectedTicketId(null);
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast.success('Ticket deleted.');
    },
    onError: (error) => toast.error(`Ticket was not deleted. ${errorMessage(error)}`),
  });

  const tickets = useMemo(() => ticketsQuery.data ?? [], [ticketsQuery.data]);
  const filteredTickets = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const matchesSearch = !query || [ticket.title, ticket.description, ticket.created_by, ticket.category]
        .some((value) => value.toLowerCase().includes(query));
      return matchesSearch
        && (filters.priority === 'all' || ticket.priority === filters.priority)
        && (filters.category === 'all' || ticket.category === filters.category);
    });
  }, [tickets, filters]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark"><Headphones /></span>
          <div><strong>Support Board</strong><span>Lakebase operations</span></div>
        </div>
        <button className="button button--primary" onClick={() => setNewTicketOpen(true)}><Plus size={18} /> New ticket</button>
      </header>

      <main>
        <FilterBar
          filters={filters}
          onChange={setFilters}
          resultCount={filteredTickets.length}
          onRefresh={() => void ticketsQuery.refetch()}
          refreshing={ticketsQuery.isFetching}
        />

        {ticketsQuery.isLoading ? (
          <div className="board-state"><span className="spinner" /><strong>Loading your support board...</strong></div>
        ) : ticketsQuery.isError ? (
          <div className="board-state board-state--error">
            <WifiOff size={32} /><strong>We couldn't load the tickets.</strong><p>{errorMessage(ticketsQuery.error)}</p>
            <button className="button button--secondary" onClick={() => void ticketsQuery.refetch()}>Try again</button>
          </div>
        ) : (
          <KanbanBoard
            tickets={filteredTickets}
            onSelect={setSelectedTicketId}
            onStatusChange={(ticketId, status) => statusMutation.mutate({ ticketId, status })}
            onDeleteRequest={setDeleteTarget}
            statusChangePending={statusMutation.isPending}
          />
        )}
      </main>

      <NewTicketModal
        open={newTicketOpen}
        pending={createMutation.isPending}
        onClose={() => setNewTicketOpen(false)}
        onCreate={(input: CreateTicketInput) => createMutation.mutate(input)}
      />
      {selectedTicketId && (
        <TicketDetails
          ticket={detailQuery.data}
          loading={detailQuery.isLoading}
          statusPending={statusMutation.isPending}
          messagePending={messageMutation.isPending}
          deletePending={deleteMutation.isPending}
          onClose={() => setSelectedTicketId(null)}
          onStatusChange={(status) => statusMutation.mutate({ ticketId: selectedTicketId, status })}
          onAddMessage={(message, onSuccess) => messageMutation.mutate({ ticketId: selectedTicketId, message, onSuccess })}
          onDelete={() => deleteMutation.mutate(selectedTicketId)}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        ticketTitle={deleteTarget?.title ?? ''}
        pending={deleteMutation.isPending}
        onCancel={() => { if (!deleteMutation.isPending) setDeleteTarget(null); }}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.ticket_id); }}
      />
    </div>
  );
}
