package com.rootly.api.service;

import com.rootly.api.entity.EmailOutbox;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class MailService {

    private final JavaMailSender mailSender;

    private final String fromAddress;

    public MailService(
            JavaMailSender mailSender,
            @Value("${app.mail.from}")
            String fromAddress) {
        this.mailSender = mailSender;
        this.fromAddress = fromAddress;
    }

    public void send(EmailOutbox email) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(email.getRecipient());
        message.setSubject(email.getSubject());
        message.setText(email.getBody());
        mailSender.send(message);
    }
}
