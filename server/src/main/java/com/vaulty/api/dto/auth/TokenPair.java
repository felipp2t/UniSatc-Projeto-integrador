package com.vaulty.api.dto.auth;

public record TokenPair(
        String accessToken,

        String refreshToken) {}
