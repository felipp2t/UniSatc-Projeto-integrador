package com.rootly.api.dto.auth;

public record TokenPair(
        String accessToken,

        String refreshToken) {}
