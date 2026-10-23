package com.vaulty.api.exception;

import org.springframework.http.HttpStatus;

public class StorageUnavailableException extends ApiException {

    public StorageUnavailableException() {
        super("Storage de anexos não está configurado", HttpStatus.SERVICE_UNAVAILABLE);
    }
}
