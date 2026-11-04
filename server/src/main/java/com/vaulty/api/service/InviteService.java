package com.vaulty.api.service;

import com.vaulty.api.dto.invite.InviteResponse;
import com.vaulty.api.dto.invite.InviteUserRequest;
import com.vaulty.api.dto.invite.InviteValidationRequest;
import com.vaulty.api.dto.invite.InviteValidationResponse;
import com.vaulty.api.entity.UserInvite;
import com.vaulty.api.entity.UserInviteStatus;
import com.vaulty.api.enums.ActivityAction;
import com.vaulty.api.enums.ActivityActorContext;
import com.vaulty.api.enums.ActivityResourceType;
import com.vaulty.api.exception.ConflictException;
import com.vaulty.api.exception.ResourceNotFoundException;
import com.vaulty.api.repository.UserInviteRepository;
import com.vaulty.api.repository.UserRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InviteService {

    private final UserInviteRepository userInviteRepository;

    private final UserRepository userRepository;

    private final WorkspaceService workspaceService;

    private final EmailOutboxService emailOutboxService;

    private final ActivityLogService activityLogService;

    private final long inviteExpirationMs;

    private final Clock clock;

    @Autowired
    public InviteService(
            UserInviteRepository userInviteRepository,

            UserRepository userRepository,

            WorkspaceService workspaceService,

            EmailOutboxService emailOutboxService,

            ActivityLogService activityLogService,

            Clock clock,

            @Value("${invite.expiration-ms}")
            long inviteExpirationMs) {
        this.userInviteRepository = userInviteRepository;
        this.userRepository = userRepository;
        this.workspaceService = workspaceService;
        this.emailOutboxService = emailOutboxService;
        this.activityLogService = activityLogService;
        this.clock = clock;
        this.inviteExpirationMs = inviteExpirationMs;
    }

    @Transactional(readOnly = true)
    public InviteValidationResponse validate(InviteValidationRequest request) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        UserInvite invite = requirePendingInvite(request, now);

        Duration remaining = Duration.between(now, invite.getExpiresAt());
        long remainingSeconds = remaining.getSeconds() + (remaining.getNano() == 0 ? 0 : 1);
        return new InviteValidationResponse(invite.getEmail(), remainingSeconds);
    }

    @Transactional(readOnly = true)
    public List<InviteResponse> listPending(UUID ownerId) {
        workspaceService.requireOwner(ownerId);
        return userInviteRepository.findPendingUsable(OffsetDateTime.now(clock), UserInviteStatus.PENDING);
    }

    @Transactional
    public void decline(InviteValidationRequest request) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        UserInvite invite = requirePendingInviteForUpdate(request, now);
        invite.setStatus(UserInviteStatus.DECLINED);
        activityLogService.recordInviteeEmail(workspaceService.singletonId(), invite.getEmail(),
                ActivityAction.MEMBER_INVITE_DECLINED, ActivityResourceType.MEMBER, invite.getId(),
                Map.of("email", invite.getEmail()));
    }

    @Transactional
    public void inviteUser(UUID inviterId, InviteUserRequest request) {
        var workspace = workspaceService.requireOwner(inviterId);

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

        activityLogService.record(workspace.getId(), inviterId, ActivityActorContext.USER,
                ActivityAction.MEMBER_INVITED, ActivityResourceType.MEMBER, invite.getId(),
                Map.of("email", invite.getEmail(), "expiresAt", invite.getExpiresAt().toString()));

        emailOutboxService.enqueueInvite(invite.getEmail(), invite.getToken(), invite.getExpiresAt());
    }

    @Transactional
    public void revoke(UUID ownerId, UUID inviteId) {
        var workspace = workspaceService.requireOwner(ownerId);
        UserInvite invite = userInviteRepository.findByIdAndStatusForUpdate(inviteId, UserInviteStatus.PENDING)
                .orElseThrow(() -> new ResourceNotFoundException("Convite indisponível"));

        invite.setStatus(UserInviteStatus.REVOKED);
        activityLogService.record(workspace.getId(), ownerId, ActivityActorContext.USER,
                ActivityAction.MEMBER_INVITE_REVOKED, ActivityResourceType.MEMBER, invite.getId(),
                Map.of("email", invite.getEmail()));
    }

    private UserInvite requirePendingInvite(InviteValidationRequest request, OffsetDateTime now) {
        if (userRepository.findByEmail(request.email()).isPresent()) {
            throw new ResourceNotFoundException("Convite indisponível");
        }

        return userInviteRepository.findByEmailAndTokenAndStatus(
                        request.email(), request.token(), UserInviteStatus.PENDING)
                .filter(invite -> invite.getExpiresAt().isAfter(now))
                .orElseThrow(() -> new ResourceNotFoundException("Convite indisponível"));
    }

    private UserInvite requirePendingInviteForUpdate(InviteValidationRequest request, OffsetDateTime now) {
        if (userRepository.findByEmail(request.email()).isPresent()) {
            throw new ResourceNotFoundException("Convite indisponível");
        }

        return userInviteRepository.findByEmailAndTokenAndStatusForUpdate(
                        request.email(), request.token(), UserInviteStatus.PENDING)
                .filter(invite -> invite.getExpiresAt().isAfter(now))
                .orElseThrow(() -> new ResourceNotFoundException("Convite indisponível"));
    }
}
