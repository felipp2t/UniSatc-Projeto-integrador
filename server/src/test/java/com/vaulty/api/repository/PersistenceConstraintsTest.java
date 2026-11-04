package com.vaulty.api.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.SQLException;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.Test;

class PersistenceConstraintsTest {

    @Test
    void recognizesNamedConstraintsInsideWrappedExceptions() {
        var violation = new ConstraintViolationException("Duplicate", new SQLException(), "unique_title");
        var wrapped = new RuntimeException("Persistence failure", violation);

        assertThat(PersistenceConstraints.causedBy(wrapped, "unique_name", "unique_title")).isTrue();
        assertThat(PersistenceConstraints.causedBy(wrapped, "foreign_key")).isFalse();
    }

    @Test
    void leavesUnnamedAndUnrelatedFailuresUntouched() {
        var unnamed = new ConstraintViolationException("Constraint failure", new SQLException(), null);

        assertThat(PersistenceConstraints.causedBy(unnamed, "unique_title")).isFalse();
        assertThat(PersistenceConstraints.causedBy(new RuntimeException("Other failure"), "unique_title")).isFalse();
    }
}
