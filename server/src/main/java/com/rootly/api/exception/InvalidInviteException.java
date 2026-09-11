package com.rootly.api.exception;

import org.springframework.http.HttpStatus;

public class InvalidInviteException extends ApiException {

    public InvalidInviteException(String message) {
        super(message, HttpStatus.CONFLICT);
    }
}
