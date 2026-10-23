ALTER TABLE item
    ADD COLUMN description TEXT,
    ADD CONSTRAINT ck_item_description_length
        CHECK (description IS NULL OR char_length(description) <= 2000);
