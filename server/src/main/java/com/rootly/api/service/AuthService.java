package com.rootly.api.service;

import com.rootly.api.dto.AcceptInviteRequest;
import com.rootly.api.dto.LoginRequest;
import com.rootly.api.dto.TokenPair;
import com.rootly.api.entity.RefreshToken;
import com.rootly.api.entity.User;
import com.rootly.api.entity.WorkspaceInvite;
import com.rootly.api.entity.WorkspaceMember;
import com.rootly.api.enums.WorkspaceInviteStatus;
import com.rootly.api.exception.InvalidCredentialsException;
import com.rootly.api.exception.InvalidInviteException;
import com.rootly.api.exception.ResourceNotFoundException;
import com.rootly.api.exception.ValidationException;
import com.rootly.api.repository.RefreshTokenRepository;
import com.rootly.api.repository.UserRepository;
import com.rootly.api.repository.WorkspaceInviteRepository;
import com.rootly.api.repository.WorkspaceMemberRepository;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;

    private final RefreshTokenRepository refreshTokenRepository;

    private final WorkspaceInviteRepository workspaceInviteRepository;

    private final WorkspaceMemberRepository workspaceMemberRepository;

    private final PasswordEncoder passwordEncoder;

    private final JwtService jwtService;

    private final long refreshTokenExpirationMs;

    public AuthService(
            UserRepository userRepository,

            RefreshTokenRepository refreshTokenRepository,

            WorkspaceInviteRepository workspaceInviteRepository,

            WorkspaceMemberRepository workspaceMemberRepository,

            PasswordEncoder passwordEncoder,

            JwtService jwtService,

            @Value("${jwt.refresh-token-expiration-ms}")
            long refreshTokenExpirationMs) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.workspaceInviteRepository = workspaceInviteRepository;
        this.workspaceMemberRepository = workspaceMemberRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.refreshTokenExpirationMs = refreshTokenExpirationMs;
    }

    @Transactional
    public TokenPair login(LoginRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new InvalidCredentialsException("Credenciais inválidas"));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new InvalidCredentialsException("Credenciais inválidas");
        }

        return issueTokenPair(user.getId());
    }

    @Transactional
    public TokenPair refreshToken(String token) {
        RefreshToken refreshToken = refreshTokenRepository.findByToken(token)
                .orElseThrow(() -> new InvalidCredentialsException("Token de atualização inválido"));

        UUID userId = refreshToken.getUser().getId();
        refreshTokenRepository.delete(refreshToken);

        if (refreshToken.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new InvalidCredentialsException("Token de atualização inválido");
        }

        return issueTokenPair(userId);
    }

    @Transactional
    public void logout(String token) {
        RefreshToken refreshToken = refreshTokenRepository.findByToken(token)
                .orElseThrow(() -> new InvalidCredentialsException("Token de atualização inválido"));

        refreshTokenRepository.delete(refreshToken);
    }

    @Transactional
    public TokenPair acceptInviteAndRegister(UUID inviteId, AcceptInviteRequest request) {
        if (!request.password().equals(request.confirmPassword())) {
            throw new ValidationException("As senhas não conferem");
        }

        WorkspaceInvite invite = workspaceInviteRepository.findById(inviteId)
                .orElseThrow(() -> new ResourceNotFoundException("Convite de workspace não encontrado"));

        if (invite.getStatus() != WorkspaceInviteStatus.pending) {
            throw new InvalidInviteException("Convite já está " + statusPt(invite.getStatus()));
        }

        if (invite.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new InvalidInviteException("Convite expirado");
        }

        User user = invite.getInvitedUser();
        user.setName(request.name());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        userRepository.save(user);

        invite.setStatus(WorkspaceInviteStatus.accepted);
        workspaceInviteRepository.save(invite);

        boolean alreadyMember = workspaceMemberRepository
                .findByUserIdAndWorkspaceId(user.getId(), invite.getWorkspace().getId())
                .isPresent();

        if (!alreadyMember) {
            WorkspaceMember member = new WorkspaceMember();
            member.setUser(user);
            member.setWorkspace(invite.getWorkspace());
            member.setRole(invite.getRole());
            workspaceMemberRepository.save(member);
        }

        return issueTokenPair(user.getId());
    }

    private TokenPair issueTokenPair(UUID userId) {
        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setToken(UUID.randomUUID().toString());
        refreshToken.setUser(userRepository.getReferenceById(userId));
        refreshToken.setExpiresAt(OffsetDateTime.now().plus(Duration.ofMillis(refreshTokenExpirationMs)));
        refreshTokenRepository.save(refreshToken);

        String accessToken = jwtService.generateAccessToken(userId);

        return new TokenPair(accessToken, refreshToken.getToken());
    }

    // traduz o status do convite pra portugues nas mensagens de erro
    private String statusPt(WorkspaceInviteStatus status) {
        return switch (status) {
            case accepted -> "aceito";
            case declined -> "recusado";
            case revoked -> "revogado";
            case pending -> "pendente";
        };
    }
}
