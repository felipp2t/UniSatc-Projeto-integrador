package com.vaulty.api.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vaulty.api.exception.SecretConfigurationException;
import org.junit.jupiter.api.Test;

class SecretCipherTest {

    private final SecretCipher cipher = new SecretCipher("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");

    @Test
    void encryptsWithDistinctNoncesAndDetectsTampering() {
        String first = cipher.encrypt("api-key");
        String second = cipher.encrypt("api-key");

        assertThat(first).isNotEqualTo(second).doesNotContain("api-key");
        assertThat(cipher.decrypt(first)).isEqualTo("api-key");
        String[] parts = first.split(":");
        char changed = parts[2].charAt(0) == 'A' ? 'B' : 'A';
        String tampered = parts[0] + ":" + parts[1] + ":" + changed + parts[2].substring(1);
        assertThatThrownBy(() -> cipher.decrypt(tampered))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void reportsMissingOrInvalidEncryptionKey() {
        assertThatThrownBy(() -> new SecretCipher("").encrypt("api-key"))
                .isInstanceOf(SecretConfigurationException.class)
                .hasMessageContaining("não configurada");
        assertThatThrownBy(() -> new SecretCipher("invalid-base64").encrypt("api-key"))
                .isInstanceOf(SecretConfigurationException.class)
                .hasMessageContaining("32 bytes em Base64");
    }
}
