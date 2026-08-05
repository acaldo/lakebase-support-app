import { Filter, RefreshCw, Search, X } from 'lucide-react';
import type { TicketCatalogs } from '../../shared/types.js';
import { EMPTY_FILTERS, type TicketFilters } from '../filter-types.js';

interface FilterBarProps {
  filters: TicketFilters;
  catalogs: TicketCatalogs;
  onChange: (filters: TicketFilters) => void;
  resultCount: number;
  onRefresh: () => void;
  refreshing: boolean;
}

export function FilterBar({ filters, catalogs, onChange, resultCount, onRefresh, refreshing }: FilterBarProps) {
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
        <button
          className="refresh-icon-button"
          type="button"
          aria-label="Refresh tickets"
          title="Refresh tickets"
          onClick={onRefresh}
          disabled={refreshing}
        >
          <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
        </button>
        <Filter size={17} aria-hidden="true" />
        <label>
          <span className="sr-only">Filter by priority</span>
          <select value={filters.priority} onChange={(event) => update('priority', event.target.value as TicketFilters['priority'])}>
            <option value="all">All priorities</option>
            {catalogs.priorities.map((priority) => <option key={priority.code} value={priority.code}>{priority.label}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter by category</span>
          <select value={filters.category} onChange={(event) => update('category', event.target.value as TicketFilters['category'])}>
            <option value="all">All categories</option>
            {catalogs.categories.map((category) => <option key={category.code} value={category.code}>{category.label}</option>)}
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
