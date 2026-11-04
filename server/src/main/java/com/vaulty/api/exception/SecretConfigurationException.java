package com.vaulty.api.exception;

import org.springframework.http.HttpStatus;

public class SecretConfigurationException extends ApiException {

    public SecretConfigurationException(String message) {
        super(message, HttpStatus.SERVICE_UNAVAILABLE);
    }
}
