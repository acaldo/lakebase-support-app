ALTER TABLE {{schema}}.tickets DROP CONSTRAINT IF EXISTS tickets_status_check;

ALTER TABLE {{schema}}.tickets
  ADD CONSTRAINT tickets_status_check
  CHECK (status IN ('open', 'in_progress', 'resolved', 'archived'));

WITH inserted_ticket AS (
  INSERT INTO {{schema}}.tickets
    (title, description, status, priority, category, created_by)
  SELECT
    'Legacy account cleanup',
    'An old vendor account is no longer needed.',
    'archived',
    'low',
    'access',
    'casey.roberts@example.com'
  WHERE NOT EXISTS (
    SELECT 1 FROM {{schema}}.tickets WHERE title = 'Legacy account cleanup'
  )
  RETURNING ticket_id
)
INSERT INTO {{schema}}.ticket_messages (ticket_id, message_text, author)
SELECT ticket_id, message_text, author
FROM inserted_ticket
CROSS JOIN (VALUES
  ('The vendor confirmed that the account can be closed.', 'support.agent@example.com'),
  ('The account was archived after the retention check.', 'casey.roberts@example.com')
) AS messages(message_text, author);
