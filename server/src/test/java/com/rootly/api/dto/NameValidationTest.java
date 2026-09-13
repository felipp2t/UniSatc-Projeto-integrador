package com.rootly.api.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.rootly.api.dto.auth.RegisterRequest;
import com.rootly.api.dto.user.UpdateProfileRequest;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class NameValidationTest {

    private static AutoCloseable validatorFactory;
    private static Validator validator;

    @BeforeAll
    static void createValidator() {
        var factory = Validation.buildDefaultValidatorFactory();
        validatorFactory = factory;
        validator = factory.getValidator();
    }

    @AfterAll
    static void closeValidator() throws Exception {
        validatorFactory.close();
    }

    @Test
    void normalizesBeforeValidatingProfileNames() {
        UpdateProfileRequest valid = new UpdateProfileRequest("  Ana  ");
        UpdateProfileRequest tooShort = new UpdateProfileRequest(" a ");

        assertThat(valid.name()).isEqualTo("Ana");
        assertThat(validator.validate(valid)).isEmpty();
        assertThat(validator.validate(tooShort)).isNotEmpty();
    }

    @Test
    void appliesDatabaseLengthLimitsToBothInputs() {
        String max = "a".repeat(255);
        String tooLong = "a".repeat(256);

        assertThat(validator.validate(new UpdateProfileRequest(max))).isEmpty();
        assertThat(validator.validate(new UpdateProfileRequest(tooLong))).isNotEmpty();
        assertThat(validator.validate(register("  Ana  "))).isEmpty();
        assertThat(register("  Ana  ").name()).isEqualTo("Ana");
        assertThat(validator.validate(register(tooLong))).isNotEmpty();
    }

    private RegisterRequest register(String name) {
        return new RegisterRequest("user@example.com", "token", name, "password123", "password123");
    }
}
