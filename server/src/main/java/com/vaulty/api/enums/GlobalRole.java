package com.vaulty.api.enums;

public enum GlobalRole {
    ADMIN("Admin"),
    MAINTAINER("Maintainer");

    private final String displayName;

    GlobalRole(String displayName) {
        this.displayName = displayName;
    }

    public String displayName() {
        return displayName;
    }
}
