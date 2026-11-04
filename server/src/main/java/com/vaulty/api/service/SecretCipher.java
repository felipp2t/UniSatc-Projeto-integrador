package com.vaulty.api.service;

import com.vaulty.api.exception.SecretConfigurationException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class SecretCipher {

    private static final int NONCE_LENGTH = 12;
    private static final int TAG_LENGTH_BITS = 128;
    private final String configuredKey;
    private final SecureRandom random = new SecureRandom();

    public SecretCipher(@Value("${app.secret-encryption-key:}") String configuredKey) {
        this.configuredKey = configuredKey;
    }

    public String encrypt(String value) {
        byte[] nonce = new byte[NONCE_LENGTH];
        random.nextBytes(nonce);
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key(), new GCMParameterSpec(TAG_LENGTH_BITS, nonce));
            byte[] ciphertext = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
            return "v1:" + Base64.getEncoder().encodeToString(nonce) + ":"
                    + Base64.getEncoder().encodeToString(ciphertext);
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("Falha ao criptografar segredo", exception);
        }
    }

    public String decrypt(String value) {
        try {
            String[] parts = value.split(":", 3);
            if (parts.length != 3 || !"v1".equals(parts[0])) {
                throw new IllegalArgumentException("Formato de segredo inválido");
            }
            byte[] nonce = Base64.getDecoder().decode(parts[1]);
            if (nonce.length != NONCE_LENGTH) {
                throw new IllegalArgumentException("Nonce inválido");
            }
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(TAG_LENGTH_BITS, nonce));
            return new String(cipher.doFinal(Base64.getDecoder().decode(parts[2])), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException exception) {
            throw new IllegalStateException("Falha ao descriptografar segredo", exception);
        }
    }

    private SecretKeySpec key() {
        if (configuredKey.isBlank()) {
            throw new SecretConfigurationException("SECRET_ENCRYPTION_KEY não configurada");
        }
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(configuredKey);
        } catch (IllegalArgumentException exception) {
            throw new SecretConfigurationException("SECRET_ENCRYPTION_KEY deve conter 32 bytes em Base64");
        }
        if (bytes.length != 32) {
            throw new SecretConfigurationException("SECRET_ENCRYPTION_KEY deve conter 32 bytes em Base64");
        }
        return new SecretKeySpec(bytes, "AES");
    }
}
