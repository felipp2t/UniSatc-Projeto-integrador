package com.rootly.api.dto;

// par access/refresh token, usado internamente entre o AuthService e o controller (cookies, RNF01)
public record TokenPair(
        String accessToken,

        String refreshToken) {}
