ALTER TABLE item ADD COLUMN description VARCHAR(2000);

CREATE TABLE item_file (
    item_id UUID PRIMARY KEY REFERENCES item (id) ON DELETE CASCADE,
    storage_key VARCHAR(1024) NOT NULL UNIQUE,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 20000000)
);

CREATE TABLE item_media (
    item_id UUID PRIMARY KEY REFERENCES item_file (item_id) ON DELETE CASCADE,
    width_px INTEGER NOT NULL CHECK (width_px > 0),
    height_px INTEGER NOT NULL CHECK (height_px > 0),
    format VARCHAR(10) NOT NULL
);

CREATE TABLE attachment_cleanup (
    storage_key VARCHAR(1024) PRIMARY KEY,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_attachment_cleanup_retry ON attachment_cleanup (next_retry_at);
