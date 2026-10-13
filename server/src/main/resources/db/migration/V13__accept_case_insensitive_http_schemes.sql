-- O esquema de uma URI não distingue caixa; manter a regra do banco compatível com a API.
ALTER TABLE item DROP CONSTRAINT ck_item_inline_content;
ALTER TABLE item ADD CONSTRAINT ck_item_inline_content CHECK (
    (type = 'text' AND link_url IS NULL)
    OR (type = 'link' AND text_content IS NULL AND link_url IS NOT NULL AND link_url ~* '^https?://')
    OR (type IN ('file', 'image', 'video', 'secret') AND text_content IS NULL AND link_url IS NULL)
);
