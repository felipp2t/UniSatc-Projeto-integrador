-- Atende a listagem e a contagem de não lidas por destinatário, em ordem cronológica.
CREATE INDEX ix_notification_recipient_read_created
    ON notification (recipient_id, read_at, created_at DESC);
