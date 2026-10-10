package com.vaulty.api.service;

import com.vaulty.api.entity.EmailOutbox;
import com.vaulty.api.entity.EmailOutboxStatus;
import com.vaulty.api.repository.EmailOutboxRepository;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.OffsetDateTime;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class EmailOutboxService {

    private final EmailOutboxRepository repository;
    private final Clock clock;
    private final String frontendUrl;

    public EmailOutboxService(
            EmailOutboxRepository repository,
            Clock clock,
            @Value("${app.frontend-url}") String frontendUrl) {
        this.repository = repository;
        this.clock = clock;
        this.frontendUrl = frontendUrl;
    }

    public void enqueueInvite(String recipient, String token, OffsetDateTime expiresAt) {
        String link = frontendUrl + "/cadastro?email=" + encode(recipient) + "&token=" + encode(token);
        enqueue(
                recipient,
                "Você foi convidado para o Vaulty",
                "Você foi convidado a criar uma conta no Vaulty.\n\n"
                        + "Clique no link abaixo para concluir seu cadastro:\n"
                        + link
                        + "\n\nSe você não esperava este convite, pode ignorar este e-mail.",
                expiresAt);
    }

    public void enqueuePasswordReset(String recipient, String token, OffsetDateTime expiresAt) {
        String link = frontendUrl + "/redefinir-senha?token=" + encode(token);
        enqueue(
                recipient,
                "Recuperação de senha - Vaulty",
                "Recebemos uma solicitação para redefinir sua senha.\n\n"
                        + "Clique no link abaixo para escolher uma nova senha:\n"
                        + link
                        + "\n\nSe você não solicitou isso, pode ignorar este e-mail.",
                expiresAt);
    }

    private void enqueue(String recipient, String subject, String body, OffsetDateTime expiresAt) {
        EmailOutbox email = new EmailOutbox();
        email.setRecipient(recipient);
        email.setSubject(subject);
        email.setBody(body);
        email.setStatus(EmailOutboxStatus.PENDING);
        email.setAttempts(0);
        email.setNextAttemptAt(OffsetDateTime.now(clock));
        email.setExpiresAt(expiresAt);
        repository.save(email);
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
