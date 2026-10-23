package com.vaulty.api.dto.user;

import com.vaulty.api.entity.User;
import java.time.OffsetDateTime;

public record UserResponse(
        String id,

        String name,

        String email,

        OffsetDateTime createdAt) {

    public static UserResponse from(User user) {
        return new UserResponse(user.getId().toString(), user.getName(), user.getEmail(), user.getCreatedAt());
    }
}
