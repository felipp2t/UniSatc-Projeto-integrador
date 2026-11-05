package com.vaulty.api.dto.team;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record ChangeTeamLeaderRequest(@NotNull UUID workspaceMemberId) {}
