CREATE TABLE item_file (
    item_id UUID PRIMARY KEY REFERENCES item (id) ON DELETE CASCADE,
    storage_key VARCHAR(1024) NOT NULL UNIQUE,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(127) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes BETWEEN 1 AND 20000000)
);

CREATE TABLE item_media (
    item_id UUID PRIMARY KEY REFERENCES item_file (item_id) ON DELETE CASCADE,
    format VARCHAR(10) NOT NULL CHECK (format IN ('png', 'jpg', 'jpeg')),
    width INTEGER NOT NULL CHECK (width > 0),
    height INTEGER NOT NULL CHECK (height > 0)
);
