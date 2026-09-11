package com.rootly.api.enums;

// espelha o enum workspace_invite_status do Postgres (database/sql.txt)
public enum WorkspaceInviteStatus {
    pending,
    accepted,
    declined,
    revoked
}
