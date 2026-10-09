package com.vaulty.api.dto.workspace;

final class WorkspaceTextNormalizer {

    private WorkspaceTextNormalizer() {
    }

    static String normalizeName(String name) {
        return name == null ? null : name.trim();
    }

    static String normalizeDescription(String description) {
        if (description == null) {
            return null;
        }
        String normalized = description.trim();
        return normalized.isEmpty() ? null : normalized;
    }
}
