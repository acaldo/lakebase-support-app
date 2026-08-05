import { Filter, Search, X } from 'lucide-react';
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from '../../shared/types.js';
import { EMPTY_FILTERS, type TicketFilters } from '../filter-types.js';
import { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS } from '../format.js';

interface FilterBarProps {
  filters: TicketFilters;
  onChange: (filters: TicketFilters) => void;
  resultCount: number;
}

export function FilterBar({ filters, onChange, resultCount }: FilterBarProps) {
  const isFiltered = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);
  const update = <K extends keyof TicketFilters>(key: K, value: TicketFilters[K]) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <section className="filter-bar" aria-label="Ticket filters">
      <label className="search-field">
        <Search size={18} aria-hidden="true" />
        <span className="sr-only">Search tickets</span>
        <input
          value={filters.search}
          onChange={(event) => update('search', event.target.value)}
          placeholder="Search tickets..."
        />
      </label>
      <div className="filter-selects">
        <Filter size={17} aria-hidden="true" />
        <label>
          <span className="sr-only">Filter by status</span>
          <select value={filters.status} onChange={(event) => update('status', event.target.value as TicketFilters['status'])}>
            <option value="all">All statuses</option>
            {TICKET_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter by priority</span>
          <select value={filters.priority} onChange={(event) => update('priority', event.target.value as TicketFilters['priority'])}>
            <option value="all">All priorities</option>
            {TICKET_PRIORITIES.map((priority) => <option key={priority} value={priority}>{PRIORITY_LABELS[priority]}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter by category</span>
          <select value={filters.category} onChange={(event) => update('category', event.target.value as TicketFilters['category'])}>
            <option value="all">All categories</option>
            {TICKET_CATEGORIES.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}
          </select>
        </label>
      </div>
      <span className="result-count">{resultCount} result{resultCount === 1 ? '' : 's'}</span>
      {isFiltered && (
        <button className="button button--ghost button--small" onClick={() => onChange(EMPTY_FILTERS)}>
          <X size={15} /> Clear
        </button>
      )}
    </section>
  );
}
