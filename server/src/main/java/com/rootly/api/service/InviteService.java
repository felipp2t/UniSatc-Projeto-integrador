package com.rootly.api.service;

import com.rootly.api.dto.invite.InviteUserRequest;
import com.rootly.api.entity.UserInvite;
import com.rootly.api.exception.ConflictException;
import com.rootly.api.repository.UserInviteRepository;
import com.rootly.api.repository.UserRepository;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// restringir o convite a administradores fica para quando o sistema de papeis existir
@Service
public class InviteService {

    private final UserInviteRepository userInviteRepository;

    private final UserRepository userRepository;

    private final EmailOutboxService emailOutboxService;

    private final long inviteExpirationMs;

    public InviteService(
            UserInviteRepository userInviteRepository,

            UserRepository userRepository,

            EmailOutboxService emailOutboxService,

            @Value("${invite.expiration-ms}")
            long inviteExpirationMs) {
        this.userInviteRepository = userInviteRepository;
        this.userRepository = userRepository;
        this.emailOutboxService = emailOutboxService;
        this.inviteExpirationMs = inviteExpirationMs;
    }

    @Transactional
    public void inviteUser(UUID inviterId, InviteUserRequest request) {
        if (userRepository.findByEmail(request.email()).isPresent()) {
            throw new ConflictException("E-mail já possui uma conta");
        }

        userInviteRepository.deleteAllByEmail(request.email());

        UserInvite invite = new UserInvite();
        invite.setEmail(request.email());
        invite.setToken(UUID.randomUUID().toString());
        invite.setInvitedBy(userRepository.getReferenceById(inviterId));
        invite.setExpiresAt(OffsetDateTime.now().plus(Duration.ofMillis(inviteExpirationMs)));
        userInviteRepository.save(invite);

        emailOutboxService.enqueueInvite(invite.getEmail(), invite.getToken(), invite.getExpiresAt());
    }
}
