import { CheckCircle2, CircleDot, Clock3, Layers3 } from 'lucide-react';
import type { Ticket } from '../../shared/types.js';

interface StatsBarProps {
  tickets: Ticket[];
}

export function StatsBar({ tickets }: StatsBarProps) {
  const stats = [
    { label: 'Total tickets', value: tickets.length, icon: Layers3, tone: 'neutral' },
    { label: 'Open', value: tickets.filter((ticket) => ticket.status === 'open').length, icon: CircleDot, tone: 'blue' },
    { label: 'In progress', value: tickets.filter((ticket) => ticket.status === 'in_progress').length, icon: Clock3, tone: 'amber' },
    { label: 'Resolved', value: tickets.filter((ticket) => ticket.status === 'resolved').length, icon: CheckCircle2, tone: 'green' },
  ];

  return (
    <section className="stats-grid" aria-label="Ticket statistics">
      {stats.map(({ label, value, icon: Icon, tone }) => (
        <article className={`stat-card stat-card--${tone}`} key={label}>
          <span className="stat-icon" aria-hidden="true"><Icon size={19} /></span>
          <div>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        </article>
      ))}
    </section>
  );
}
