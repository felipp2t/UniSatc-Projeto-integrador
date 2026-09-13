package com.rootly.api.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;

import com.rootly.api.PostgresIntegrationTest;
import com.rootly.api.dto.auth.ForgotPasswordRequest;
import com.rootly.api.dto.invite.InviteUserRequest;
import com.rootly.api.entity.EmailOutbox;
import com.rootly.api.entity.EmailOutboxStatus;
import com.rootly.api.entity.User;
import com.rootly.api.repository.EmailOutboxRepository;
import com.rootly.api.repository.PasswordResetTokenRepository;
import com.rootly.api.repository.RefreshTokenRepository;
import com.rootly.api.repository.UserInviteRepository;
import com.rootly.api.repository.UserRepository;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.support.TransactionTemplate;

class EmailOutboxIntegrationTest extends PostgresIntegrationTest {

    @Autowired private UserRepository userRepository;
    @Autowired private RefreshTokenRepository refreshTokenRepository;
    @Autowired private PasswordResetTokenRepository passwordResetTokenRepository;
    @Autowired private UserInviteRepository userInviteRepository;
    @Autowired private EmailOutboxRepository emailOutboxRepository;
    @Autowired private InviteService inviteService;
    @Autowired private AuthService authService;
    @Autowired private EmailOutboxProcessor processor;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private TransactionTemplate transactionTemplate;

    @MockBean private JavaMailSender mailSender;

    @BeforeEach
    void cleanDatabase() {
        reset(mailSender);
        emailOutboxRepository.deleteAll();
        passwordResetTokenRepository.deleteAll();
        refreshTokenRepository.deleteAll();
        userInviteRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void persistsEmailWithInviteAndSendsOnlyThroughTheProcessor() {
        User inviter = createUser();

        inviteService.inviteUser(inviter.getId(), new InviteUserRequest("guest@example.com"));

        assertThat(userInviteRepository.findAll()).hasSize(1);
        assertThat(emailOutboxRepository.findAll()).hasSize(1);
        verify(mailSender, never()).send(any(SimpleMailMessage.class));

        assertThat(processor.processNext()).isTrue();

        verify(mailSender).send(any(SimpleMailMessage.class));
        assertThat(emailOutboxRepository.findAll()).isEmpty();
    }

    @Test
    void forgotPasswordPersistsTokenAndEmailWithoutCallingSmtpInTheRequest() {
        User user = createUser();

        authService.forgotPassword(new ForgotPasswordRequest(user.getEmail()));

        assertThat(passwordResetTokenRepository.findAll()).hasSize(1);
        assertThat(emailOutboxRepository.findAll()).hasSize(1);
        verify(mailSender, never()).send(any(SimpleMailMessage.class));
    }

    @Test
    void rollsBackInviteAndOutboxTogether() {
        User inviter = createUser();

        transactionTemplate.executeWithoutResult(status -> {
            inviteService.inviteUser(inviter.getId(), new InviteUserRequest("guest@example.com"));
            status.setRollbackOnly();
        });

        assertThat(userInviteRepository.findAll()).isEmpty();
        assertThat(emailOutboxRepository.findAll()).isEmpty();
        verify(mailSender, never()).send(any(SimpleMailMessage.class));
    }

    @Test
    void schedulesRetryWhenSmtpFails() {
        User inviter = createUser();
        inviteService.inviteUser(inviter.getId(), new InviteUserRequest("guest@example.com"));
        doThrow(new MailSendException("SMTP unavailable"))
                .when(mailSender)
                .send(any(SimpleMailMessage.class));

        assertThat(processor.processNext()).isTrue();

        EmailOutbox email = emailOutboxRepository.findAll().get(0);
        assertThat(email.getStatus()).isEqualTo(EmailOutboxStatus.PENDING);
        assertThat(email.getAttempts()).isEqualTo(1);
        assertThat(email.getLockedAt()).isNull();
        assertThat(email.getNextAttemptAt()).isAfter(email.getCreatedAt());
    }

    private User createUser() {
        User user = new User();
        user.setName("Test User");
        user.setEmail(UUID.randomUUID() + "@example.com");
        user.setPasswordHash(passwordEncoder.encode("password123"));
        return userRepository.save(user);
    }
}
