package com.vaulty.api.dto.workspace;

import com.vaulty.api.enums.GlobalRole;

public record ChangeMemberRoleRequest(GlobalRole globalRole) {}
