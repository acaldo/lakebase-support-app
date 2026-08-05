CREATE TABLE {{schema}}.tickets (
  ticket_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title VARCHAR(120) NOT NULL CHECK (char_length(btrim(title)) >= 3),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved')),
  priority VARCHAR(20) NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category VARCHAR(20) NOT NULL DEFAULT 'other'
    CHECK (category IN ('access', 'software', 'hardware', 'other')),
  created_by VARCHAR(320) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE {{schema}}.ticket_messages (
  message_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id BIGINT NOT NULL REFERENCES {{schema}}.tickets(ticket_id) ON DELETE CASCADE,
  message_text TEXT NOT NULL CHECK (char_length(btrim(message_text)) BETWEEN 1 AND 4000),
  author VARCHAR(320) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX tickets_status_idx ON {{schema}}.tickets(status);
CREATE INDEX tickets_priority_idx ON {{schema}}.tickets(priority);
CREATE INDEX ticket_messages_ticket_idx ON {{schema}}.ticket_messages(ticket_id, created_at);
