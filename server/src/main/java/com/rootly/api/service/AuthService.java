package com.rootly.api.service;

import com.rootly.api.dto.auth.ForgotPasswordRequest;
import com.rootly.api.dto.auth.LoginRequest;
import com.rootly.api.dto.auth.RegisterRequest;
import com.rootly.api.dto.auth.ResetPasswordRequest;
import com.rootly.api.dto.auth.TokenPair;
import com.rootly.api.entity.PasswordResetToken;
import com.rootly.api.entity.RefreshToken;
import com.rootly.api.entity.User;
import com.rootly.api.entity.UserInvite;
import com.rootly.api.exception.ConflictException;
import com.rootly.api.exception.InvalidCredentialsException;
import com.rootly.api.exception.InvalidInviteException;
import com.rootly.api.exception.ResourceNotFoundException;
import com.rootly.api.exception.ValidationException;
import com.rootly.api.repository.PasswordResetTokenRepository;
import com.rootly.api.repository.RefreshTokenRepository;
import com.rootly.api.repository.UserInviteRepository;
import com.rootly.api.repository.UserRepository;
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

    private final UserInviteRepository userInviteRepository;

    private final PasswordResetTokenRepository passwordResetTokenRepository;

    private final PasswordEncoder passwordEncoder;

    private final JwtService jwtService;

    private final MailService mailService;

    private final long refreshTokenExpirationMs;

    private final long passwordResetExpirationMs;

    public AuthService(
            UserRepository userRepository,

            RefreshTokenRepository refreshTokenRepository,

            UserInviteRepository userInviteRepository,

            PasswordResetTokenRepository passwordResetTokenRepository,

            PasswordEncoder passwordEncoder,

            JwtService jwtService,

            MailService mailService,

            @Value("${jwt.refresh-token-expiration-ms}")
            long refreshTokenExpirationMs,

            @Value("${password-reset.expiration-ms}")
            long passwordResetExpirationMs) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.userInviteRepository = userInviteRepository;
        this.passwordResetTokenRepository = passwordResetTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.mailService = mailService;
        this.refreshTokenExpirationMs = refreshTokenExpirationMs;
        this.passwordResetExpirationMs = passwordResetExpirationMs;
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
    public TokenPair register(RegisterRequest request) {
        if (!request.password().equals(request.confirmPassword())) {
            throw new ValidationException("As senhas não conferem");
        }

        UserInvite invite = userInviteRepository.findByEmailAndToken(request.email(), request.token())
                .orElseThrow(() -> new ResourceNotFoundException("Convite não encontrado"));

        if (invite.getExpiresAt().isBefore(OffsetDateTime.now())) {
            userInviteRepository.delete(invite);
            throw new InvalidInviteException("Convite expirado");
        }

        if (userRepository.findByEmail(request.email()).isPresent()) {
            throw new ConflictException("E-mail já possui uma conta");
        }

        User user = new User();
        user.setName(request.name());
        user.setEmail(request.email());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        userRepository.save(user);

        userInviteRepository.delete(invite);

        return issueTokenPair(user.getId());
    }

    @Transactional
    public void forgotPassword(ForgotPasswordRequest request) {
        // resposta pro cliente e sempre a mesma, exista ou nao o e-mail (evita enumeracao de contas)
        userRepository.findByEmail(request.email()).ifPresent(this::issuePasswordResetToken);
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        if (!request.newPassword().equals(request.confirmPassword())) {
            throw new ValidationException("As senhas não conferem");
        }

        PasswordResetToken resetToken = passwordResetTokenRepository.findByToken(request.token())
                .orElseThrow(() -> new InvalidCredentialsException("Token de redefinição inválido"));

        UUID userId = resetToken.getUser().getId();
        passwordResetTokenRepository.delete(resetToken);

        if (resetToken.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw new InvalidCredentialsException("Token de redefinição inválido");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado"));
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);

        // forca novo login em todas as sessoes, igual a troca de senha manual
        refreshTokenRepository.deleteAllByUserId(userId);
    }

    private void issuePasswordResetToken(User user) {
        passwordResetTokenRepository.deleteAllByUserId(user.getId());

        PasswordResetToken resetToken = new PasswordResetToken();
        resetToken.setToken(UUID.randomUUID().toString());
        resetToken.setUser(user);
        resetToken.setExpiresAt(OffsetDateTime.now().plus(Duration.ofMillis(passwordResetExpirationMs)));
        passwordResetTokenRepository.save(resetToken);

        mailService.sendPasswordResetEmail(user.getEmail(), resetToken.getToken());
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
}
