package com.vaulty.api.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class CorsConfigTest {

    @Test
    void normalizesConfiguredFrontendUrlToAnOrigin() {
        assertThat(CorsConfig.allowedOrigin(" HTTP://LocalHost:5173/ ")).isEqualTo("http://localhost:5173");
        assertThat(CorsConfig.allowedOrigin("https://app.vaulty.example")).isEqualTo("https://app.vaulty.example");
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"*", "   ", "localhost:5173", "ftp://files.example", "not a url"})
    void rejectsWildcardOrInvalidFrontendUrl(String frontendUrl) {
        assertThatThrownBy(() -> CorsConfig.allowedOrigin(frontendUrl))
                .isInstanceOf(IllegalStateException.class);
    }
}
