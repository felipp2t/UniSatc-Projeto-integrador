CREATE TABLE notification (
    id UUID PRIMARY KEY,
    recipient_id UUID NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL,
    content VARCHAR(255) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_notification_recipient_created_at
    ON notification (recipient_id, created_at DESC);
