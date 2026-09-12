package com.rootly.api.service;

import java.nio.charset.StandardCharsets;
import java.net.URLEncoder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class MailService {

    private final JavaMailSender mailSender;

    private final String frontendUrl;

    private final String fromAddress;

    public MailService(
            JavaMailSender mailSender,

            @Value("${app.frontend-url}")
            String frontendUrl,

            @Value("${app.mail.from}")
            String fromAddress) {
        this.mailSender = mailSender;
        this.frontendUrl = frontendUrl;
        this.fromAddress = fromAddress;
    }

    public void sendInviteEmail(String toEmail, String token) {
        String link = frontendUrl + "/cadastro?email=" + encode(toEmail) + "&token=" + encode(token);

        send(
                toEmail,
                "Você foi convidado para o Rootly",
                "Você foi convidado a criar uma conta no Rootly.\n\n"
                        + "Clique no link abaixo para concluir seu cadastro:\n"
                        + link
                        + "\n\nSe você não esperava este convite, pode ignorar este e-mail.");
    }

    public void sendPasswordResetEmail(String toEmail, String token) {
        String link = frontendUrl + "/redefinir-senha?token=" + encode(token);

        send(
                toEmail,
                "Recuperação de senha - Rootly",
                "Recebemos uma solicitação para redefinir sua senha.\n\n"
                        + "Clique no link abaixo para escolher uma nova senha:\n"
                        + link
                        + "\n\nSe você não solicitou isso, pode ignorar este e-mail.");
    }

    private void send(String to, String subject, String text) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(to);
        message.setSubject(subject);
        message.setText(text);
        mailSender.send(message);
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
