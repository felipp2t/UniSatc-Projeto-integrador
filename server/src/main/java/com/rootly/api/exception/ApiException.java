package com.rootly.api.exception;

import org.springframework.http.HttpStatus;

// base para erros de dominio que carregam seu proprio HTTP status
public abstract class ApiException extends RuntimeException {

    private final HttpStatus status;

    protected ApiException(String message, HttpStatus status) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
