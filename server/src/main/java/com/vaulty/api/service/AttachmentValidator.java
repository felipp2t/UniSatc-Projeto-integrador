package com.vaulty.api.service;

import com.vaulty.api.exception.ValidationException;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipInputStream;
import javax.imageio.ImageIO;
import javax.imageio.stream.ImageInputStream;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

@Component
public class AttachmentValidator {
    public static final long MAX_BYTES = 20_000_000;
    private static final Map<String, String> MIME = Map.of(
            "pdf", "application/pdf", "txt", "text/plain", "md", "text/markdown",
            "docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "png", "image/png", "jpg", "image/jpeg", "jpeg", "image/jpeg");
    private static final Map<String, String> OFFICE_ENTRY = Map.of(
            "docx", "word/document.xml", "xlsx", "xl/workbook.xml", "pptx", "ppt/presentation.xml");

    public ValidatedAttachment validate(MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() > MAX_BYTES) {
            throw new ValidationException("Arquivo deve ter entre 1 e 20.000.000 bytes");
        }
        String supplied = file.getOriginalFilename();
        String name = supplied == null ? "" : supplied.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1);
        if (name.isBlank() || name.length() > 255 || name.contains("\r") || name.contains("\n")) {
            throw new ValidationException("Nome de arquivo inválido");
        }
        int dot = name.lastIndexOf('.');
        String extension = dot < 0 ? "" : name.substring(dot + 1).toLowerCase(Locale.ROOT);
        String mime = MIME.get(extension);
        if (mime == null) {
            throw new ValidationException("Formato de arquivo não permitido");
        }
        try {
            byte[] bytes = file.getBytes();
            if (bytes.length == 0 || bytes.length > MAX_BYTES) {
                throw new ValidationException("Arquivo deve ter entre 1 e 20.000.000 bytes");
            }
            int width = 0;
            int height = 0;
            if (Set.of("png", "jpg", "jpeg").contains(extension)) {
                try (ImageInputStream stream = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
                    var readers = ImageIO.getImageReaders(stream);
                    if (!readers.hasNext()) {
                        throw new ValidationException("Imagem inválida");
                    }
                    var reader = readers.next();
                    try {
                        reader.setInput(stream);
                        String detected = reader.getFormatName().toLowerCase(Locale.ROOT);
                        if (!("png".equals(extension) && "png".equals(detected))
                                && !(Set.of("jpg", "jpeg").contains(extension) && "jpeg".equals(detected))) {
                            throw new ValidationException("Formato da imagem não corresponde ao arquivo");
                        }
                        width = reader.getWidth(0);
                        height = reader.getHeight(0);
                    } finally {
                        reader.dispose();
                    }
                }
            } else if ("pdf".equals(extension)) {
                if (bytes.length < 5 || !new String(bytes, 0, 5, StandardCharsets.US_ASCII).equals("%PDF-")) {
                    throw new ValidationException("PDF inválido");
                }
            } else if (OFFICE_ENTRY.containsKey(extension)) {
                boolean found = false;
                try (var zip = new ZipInputStream(new ByteArrayInputStream(bytes))) {
                    for (var entry = zip.getNextEntry(); entry != null; entry = zip.getNextEntry()) {
                        if (OFFICE_ENTRY.get(extension).equals(entry.getName())) {
                            found = true;
                            break;
                        }
                    }
                }
                if (!found) {
                    throw new ValidationException("Documento de escritório inválido");
                }
            } else {
                for (byte value : bytes) {
                    if (value == 0) {
                        throw new ValidationException("Arquivo de texto inválido");
                    }
                }
                try {
                    StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(bytes));
                } catch (CharacterCodingException invalid) {
                    throw new ValidationException("Arquivo de texto deve usar UTF-8");
                }
            }
            return new ValidatedAttachment(name, mime, bytes, width, height,
                    Set.of("png", "jpg", "jpeg").contains(extension) ? "image" : "file",
                    "jpeg".equals(extension) ? "jpeg" : extension);
        } catch (IOException failure) {
            throw new ValidationException("Arquivo inválido ou ilegível");
        }
    }

    public record ValidatedAttachment(String name, String mime, byte[] bytes, int width, int height,
                                      String itemType, String format) {
    }
}
