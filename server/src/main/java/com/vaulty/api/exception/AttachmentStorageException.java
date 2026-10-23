package com.vaulty.api.exception;

import org.springframework.http.HttpStatus;

public class AttachmentStorageException extends ApiException {
    public AttachmentStorageException() {
        super("Anexo indisponível; tente novamente", HttpStatus.SERVICE_UNAVAILABLE);
    }
}
