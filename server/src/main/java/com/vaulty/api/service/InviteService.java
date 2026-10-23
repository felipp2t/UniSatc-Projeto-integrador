package com.vaulty.api.service;

import com.vaulty.api.dto.invite.InviteResponse;
import com.vaulty.api.dto.invite.InviteUserRequest;
import com.vaulty.api.dto.invite.InviteValidationRequest;
import com.vaulty.api.dto.invite.InviteValidationResponse;
import com.vaulty.api.entity.UserInvite;
import com.vaulty.api.exception.ConflictException;
import com.vaulty.api.exception.ResourceNotFoundException;
import com.vaulty.api.repository.UserInviteRepository;
import com.vaulty.api.repository.UserRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InviteService {

    private final UserInviteRepository userInviteRepository;

    private final UserRepository userRepository;

    private final WorkspaceService workspaceService;

    private final EmailOutboxService emailOutboxService;

    private final long inviteExpirationMs;

    private final Clock clock;

    public InviteService(
            UserInviteRepository userInviteRepository,

            UserRepository userRepository,

            WorkspaceService workspaceService,

            EmailOutboxService emailOutboxService,

            Clock clock,

            @Value("${invite.expiration-ms}")
            long inviteExpirationMs) {
        this.userInviteRepository = userInviteRepository;
        this.userRepository = userRepository;
        this.workspaceService = workspaceService;
        this.emailOutboxService = emailOutboxService;
        this.clock = clock;
        this.inviteExpirationMs = inviteExpirationMs;
    }

    @Transactional(readOnly = true)
    public InviteValidationResponse validate(InviteValidationRequest request) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        if (userRepository.findByEmail(request.email()).isPresent()) {
            throw new ResourceNotFoundException("Convite indisponível");
        }

        UserInvite invite = userInviteRepository.findByEmailAndToken(request.email(), request.token())
                .filter(candidate -> candidate.getExpiresAt().isAfter(now))
                .orElseThrow(() -> new ResourceNotFoundException("Convite indisponível"));

        Duration remaining = Duration.between(now, invite.getExpiresAt());
        long remainingSeconds = remaining.getSeconds() + (remaining.getNano() == 0 ? 0 : 1);
        return new InviteValidationResponse(invite.getEmail(), remainingSeconds);
    }

    @Transactional(readOnly = true)
    public List<InviteResponse> listPending(UUID ownerId) {
        workspaceService.requireOwner(ownerId);
        return userInviteRepository.findPendingUsable(OffsetDateTime.now(clock));
    }

    @Transactional
    public void inviteUser(UUID inviterId, InviteUserRequest request) {
        workspaceService.requireOwner(inviterId);

        if (userRepository.findByEmail(request.email()).isPresent()) {
            throw new ConflictException("E-mail já possui uma conta");
        }

        userInviteRepository.deleteAllByEmail(request.email());

        UserInvite invite = new UserInvite();
        invite.setEmail(request.email());
        invite.setToken(UUID.randomUUID().toString());
        invite.setInvitedBy(userRepository.getReferenceById(inviterId));
        invite.setExpiresAt(OffsetDateTime.now(clock).plus(Duration.ofMillis(inviteExpirationMs)));
        userInviteRepository.save(invite);

        emailOutboxService.enqueueInvite(invite.getEmail(), invite.getToken(), invite.getExpiresAt());
    }
}
