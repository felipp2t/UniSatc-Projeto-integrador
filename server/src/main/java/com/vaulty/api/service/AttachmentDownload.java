package com.vaulty.api.service;

public record AttachmentDownload(byte[] content, String fileName, String mimeType, boolean previewable) {
}
