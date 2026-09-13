CREATE TABLE email_outbox (
    id UUID PRIMARY KEY,
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    status VARCHAR(20) NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    locked_at TIMESTAMPTZ,
    last_error VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_email_outbox_status CHECK (status IN ('PENDING', 'PROCESSING', 'FAILED')),
    CONSTRAINT ck_email_outbox_attempts CHECK (attempts >= 0)
);

CREATE INDEX ix_email_outbox_pending ON email_outbox (status, next_attempt_at);
CREATE INDEX ix_refresh_token_expires_at ON refresh_token (expires_at);
CREATE INDEX ix_user_invite_expires_at ON user_invite (expires_at);
CREATE INDEX ix_password_reset_token_expires_at ON password_reset_token (expires_at);
