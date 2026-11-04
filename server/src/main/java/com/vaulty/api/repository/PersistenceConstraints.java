package com.vaulty.api.repository;

import java.util.Arrays;
import java.util.List;
import org.hibernate.exception.ConstraintViolationException;

public final class PersistenceConstraints {

    private PersistenceConstraints() {}

    public static boolean causedBy(Throwable exception, String... constraintNames) {
        List<String> names = Arrays.asList(constraintNames);
        for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
            if (cause instanceof ConstraintViolationException violation && names.contains(violation.getConstraintName())) {
                return true;
            }
        }
        return false;
    }
}
