ALTER TABLE collection ADD COLUMN inherit_access BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE item ADD CONSTRAINT uq_item_id_workspace UNIQUE (id, workspace_id);

CREATE TABLE collection_access_grant (
    collection_id UUID NOT NULL,
    group_id UUID NOT NULL,
    workspace_id UUID NOT NULL,
    PRIMARY KEY (collection_id, group_id),
    FOREIGN KEY (collection_id, workspace_id) REFERENCES collection (id, workspace_id) ON DELETE CASCADE,
    CONSTRAINT fk_collection_access_grant_group_workspace
        FOREIGN KEY (group_id, workspace_id) REFERENCES access_group (id, workspace_id) ON DELETE RESTRICT
);

CREATE TABLE collection_public_grant (
    collection_id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL,
    FOREIGN KEY (collection_id, workspace_id) REFERENCES collection (id, workspace_id) ON DELETE CASCADE
);

CREATE TABLE item_member_grant (
    item_id UUID NOT NULL,
    workspace_member_id UUID NOT NULL,
    workspace_id UUID NOT NULL,
    PRIMARY KEY (item_id, workspace_member_id),
    FOREIGN KEY (item_id, workspace_id) REFERENCES item (id, workspace_id) ON DELETE CASCADE,
    FOREIGN KEY (workspace_member_id, workspace_id)
        REFERENCES workspace_member (id, workspace_id) ON DELETE CASCADE
);

CREATE INDEX ix_collection_access_grant_group ON collection_access_grant (group_id);
CREATE INDEX ix_item_member_grant_member ON item_member_grant (workspace_member_id);

ALTER TABLE role_permission
    DROP CONSTRAINT role_permission_resource_check,
    ADD CONSTRAINT role_permission_resource_check
        CHECK (resource IN ('workspace', 'collection', 'item', 'secret', 'member', 'role', 'activity', 'group', 'sharing'));
