package com.rootly.api.dto;

import com.rootly.api.entity.User;

public record UserResponse(
        String id,

        String name,

        String email) {

    public static UserResponse from(User user) {
        return new UserResponse(user.getId().toString(), user.getName(), user.getEmail());
    }
}
