package com.vaulty.api.enums;

public enum NotificationEvent {
    PROFILE_UPDATED("Dados da conta atualizados", "Os dados da sua conta foram atualizados."),
    PASSWORD_CHANGED("Senha alterada", "A senha da sua conta foi alterada."),
    ACCESS_CHANGED("Acesso atualizado", "As permissões de acesso da sua conta foram atualizadas.");

    private final String title;
    private final String content;

    NotificationEvent(String title, String content) {
        this.title = title;
        this.content = content;
    }

    public String title() {
        return title;
    }

    public String content() {
        return content;
    }
}
