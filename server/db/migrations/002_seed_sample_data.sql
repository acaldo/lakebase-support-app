WITH inserted_tickets AS (
  INSERT INTO {{schema}}.tickets
    (title, description, status, priority, category, created_by, created_at, updated_at)
  VALUES
    ('VPN access request', 'A new teammate needs VPN access before onboarding.', 'open', 'high', 'access', 'alex.morgan@example.com', CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '2 days'),
    ('Analytics dashboard is slow', 'The operations dashboard takes over 30 seconds to load.', 'in_progress', 'urgent', 'software', 'jamie.lee@example.com', CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '1 day'),
    ('Replace damaged laptop', 'The screen flickers and the USB-C port no longer charges reliably.', 'resolved', 'medium', 'hardware', 'sam.taylor@example.com', CURRENT_TIMESTAMP - INTERVAL '8 days', CURRENT_TIMESTAMP - INTERVAL '2 days')
  RETURNING ticket_id, title
)
INSERT INTO {{schema}}.ticket_messages (ticket_id, message_text, author, created_at)
SELECT ticket_id, message_text, author, created_at
FROM inserted_tickets
CROSS JOIN LATERAL (
  VALUES
    (
      CASE title
        WHEN 'VPN access request' THEN 'The access form has been submitted to Security.'
        WHEN 'Analytics dashboard is slow' THEN 'We reproduced the delay during peak traffic.'
        ELSE 'A replacement device has been reserved.'
      END,
      'support.agent@example.com',
      CURRENT_TIMESTAMP - INTERVAL '2 days'
    ),
    (
      CASE title
        WHEN 'VPN access request' THEN 'Thanks. The teammate starts on Monday.'
        WHEN 'Analytics dashboard is slow' THEN 'Query profiling points to the ticket summary view.'
        ELSE 'The replacement was delivered and setup is complete.'
      END,
      CASE title
        WHEN 'VPN access request' THEN 'alex.morgan@example.com'
        WHEN 'Analytics dashboard is slow' THEN 'jamie.lee@example.com'
        ELSE 'sam.taylor@example.com'
      END,
      CURRENT_TIMESTAMP - INTERVAL '1 day'
    )
) AS messages(message_text, author, created_at);
