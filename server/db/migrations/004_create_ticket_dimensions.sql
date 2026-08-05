CREATE TABLE {{schema}}.dim_ticket_status (
  status_id SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  label VARCHAR(80) NOT NULL,
  sort_order SMALLINT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  progress_percent SMALLINT NOT NULL DEFAULT 0,
  allows_deletion BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX dim_ticket_status_one_default_idx
  ON {{schema}}.dim_ticket_status (is_default)
  WHERE is_default;

CREATE TABLE {{schema}}.dim_ticket_priority (
  priority_id SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  label VARCHAR(80) NOT NULL,
  sort_order SMALLINT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX dim_ticket_priority_one_default_idx
  ON {{schema}}.dim_ticket_priority (is_default)
  WHERE is_default;

CREATE TABLE {{schema}}.dim_ticket_category (
  category_id SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  label VARCHAR(80) NOT NULL,
  sort_order SMALLINT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX dim_ticket_category_one_default_idx
  ON {{schema}}.dim_ticket_category (is_default)
  WHERE is_default;

INSERT INTO {{schema}}.dim_ticket_status
  (code, label, sort_order, is_default, progress_percent, allows_deletion)
VALUES
  ('open', 'Open', 10, TRUE, 28, FALSE),
  ('in_progress', 'In progress', 20, FALSE, 64, FALSE),
  ('resolved', 'Resolved', 30, FALSE, 100, FALSE),
  ('archived', 'Archived', 40, FALSE, 100, TRUE);

INSERT INTO {{schema}}.dim_ticket_priority
  (code, label, sort_order, is_default)
VALUES
  ('urgent', 'Urgent', 10, FALSE),
  ('high', 'High', 20, FALSE),
  ('medium', 'Medium', 30, TRUE),
  ('low', 'Low', 40, FALSE);

INSERT INTO {{schema}}.dim_ticket_category
  (code, label, sort_order, is_default)
VALUES
  ('access', 'Access', 10, FALSE),
  ('software', 'Software', 20, FALSE),
  ('hardware', 'Hardware', 30, FALSE),
  ('other', 'Other', 40, TRUE);

ALTER TABLE {{schema}}.tickets
  ADD COLUMN status_id SMALLINT,
  ADD COLUMN priority_id SMALLINT,
  ADD COLUMN category_id SMALLINT;

UPDATE {{schema}}.tickets AS ticket
SET
  status_id = status.status_id,
  priority_id = priority.priority_id,
  category_id = category.category_id
FROM
  {{schema}}.dim_ticket_status AS status,
  {{schema}}.dim_ticket_priority AS priority,
  {{schema}}.dim_ticket_category AS category
WHERE
  status.code = ticket.status
  AND priority.code = ticket.priority
  AND category.code = ticket.category;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM {{schema}}.tickets
    WHERE status_id IS NULL OR priority_id IS NULL OR category_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot migrate tickets because one or more catalog values have no matching dimension row.';
  END IF;
END
$$;

DROP INDEX IF EXISTS {{schema}}.tickets_status_idx;
DROP INDEX IF EXISTS {{schema}}.tickets_priority_idx;

ALTER TABLE {{schema}}.tickets
  ALTER COLUMN status_id SET NOT NULL,
  ALTER COLUMN priority_id SET NOT NULL,
  ALTER COLUMN category_id SET NOT NULL,
  ADD CONSTRAINT tickets_status_fk
    FOREIGN KEY (status_id) REFERENCES {{schema}}.dim_ticket_status(status_id) ON DELETE RESTRICT,
  ADD CONSTRAINT tickets_priority_fk
    FOREIGN KEY (priority_id) REFERENCES {{schema}}.dim_ticket_priority(priority_id) ON DELETE RESTRICT,
  ADD CONSTRAINT tickets_category_fk
    FOREIGN KEY (category_id) REFERENCES {{schema}}.dim_ticket_category(category_id) ON DELETE RESTRICT,
  DROP COLUMN status,
  DROP COLUMN priority,
  DROP COLUMN category;

CREATE INDEX tickets_status_idx ON {{schema}}.tickets(status_id);
CREATE INDEX tickets_priority_idx ON {{schema}}.tickets(priority_id);
CREATE INDEX tickets_category_idx ON {{schema}}.tickets(category_id);
