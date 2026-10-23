package com.vaulty.api.dto.item;

import java.util.UUID;

public record AttachmentResponse(UUID itemId, String fileName, String mimeType, long size,
                                 String format, Integer width, Integer height) {
}
