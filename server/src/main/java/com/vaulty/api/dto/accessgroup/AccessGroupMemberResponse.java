package com.vaulty.api.dto.accessgroup;

import java.util.UUID;

public record AccessGroupMemberResponse(UUID workspaceMemberId, UUID userId, String name, String email) { }
