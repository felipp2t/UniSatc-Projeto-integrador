package com.vaulty.api.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vaulty.api.exception.ValidationException;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Arrays;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class AttachmentValidatorTest {
    private final AttachmentValidator validator = new AttachmentValidator();

    @Test
    void acceptsPngAsImageAndReadsDimensions() throws Exception {
        var bytes = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(2, 3, BufferedImage.TYPE_INT_RGB), "png", bytes);
        var result = validator.validate(new MockMultipartFile("file", "foto.png", "text/plain", bytes.toByteArray()));
        assertThat(result.itemType()).isEqualTo("image");
        assertThat(result.mime()).isEqualTo("image/png");
        assertThat(result.width()).isEqualTo(2);
        assertThat(result.height()).isEqualTo(3);
    }

    @Test
    void rejectsWrongContentAndOversizedFiles() {
        assertThatThrownBy(() -> validator.validate(new MockMultipartFile("file", "foto.png", "image/png",
                "texto".getBytes()))).isInstanceOf(ValidationException.class);
        assertThatThrownBy(() -> validator.validate(new MockMultipartFile("file", "grande.txt", "text/plain",
                new byte[20_000_001]))).isInstanceOf(ValidationException.class);
    }

    @Test
    void acceptsExactDecimalSizeLimitForText() {
        byte[] bytes = new byte[20_000_000];
        Arrays.fill(bytes, (byte) 'a');
        assertThat(validator.validate(new MockMultipartFile("file", "manual.txt", "text/plain", bytes))
                .bytes()).hasSize(20_000_000);
    }
}
