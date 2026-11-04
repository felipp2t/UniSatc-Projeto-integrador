package com.vaulty.api.dto.sharing;

import com.vaulty.api.dto.accessgroup.AccessGroupResponse;
import java.util.List;

public record CollectionSharingConfiguration(
        boolean inheritAccess,
        boolean publicGrant,
        List<AccessGroupResponse> groups,
        List<AccessGroupResponse> grantedGroups) {}
