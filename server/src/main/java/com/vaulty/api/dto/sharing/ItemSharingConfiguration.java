package com.vaulty.api.dto.sharing;

import java.util.List;
import java.util.UUID;

public record ItemSharingConfiguration(
        List<MemberGrant> eligibleMembers,
        List<MemberGrant> grantedMembers) {
    public record MemberGrant(UUID id, String name) {}
}
