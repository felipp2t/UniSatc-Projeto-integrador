package com.vaulty.api.dto.team;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record AddTeamMemberRequest(@NotNull UUID workspaceMemberId) {}
