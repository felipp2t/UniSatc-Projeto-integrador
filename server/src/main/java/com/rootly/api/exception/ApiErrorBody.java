package com.rootly.api.exception;

import java.time.OffsetDateTime;

public record ApiErrorBody(
        OffsetDateTime timestamp,

        int status,

        String error,

        String message,

        String path) {

    public static ApiErrorBody of(int status, String error, String message, String path) {
        return new ApiErrorBody(OffsetDateTime.now(), status, error, message, path);
    }
}
