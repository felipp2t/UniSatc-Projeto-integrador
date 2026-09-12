package com.rootly.api.service;

import com.rootly.api.dto.user.ChangePasswordRequest;
import com.rootly.api.dto.user.UpdateProfileRequest;
import com.rootly.api.entity.User;
import com.rootly.api.exception.InvalidCredentialsException;
import com.rootly.api.exception.ResourceNotFoundException;
import com.rootly.api.exception.ValidationException;
import com.rootly.api.repository.RefreshTokenRepository;
import com.rootly.api.repository.UserRepository;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private final UserRepository userRepository;

    private final RefreshTokenRepository refreshTokenRepository;

    private final PasswordEncoder passwordEncoder;

    public UserService(
            UserRepository userRepository,

            RefreshTokenRepository refreshTokenRepository,

            PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public User getMe(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado"));
    }

    @Transactional
    public void updateProfile(UUID userId, UpdateProfileRequest request) {
        User user = getMe(userId);
        user.setName(request.name().trim());
        userRepository.save(user);
    }

    @Transactional
    public void changePassword(UUID userId, ChangePasswordRequest request) {
        if (!request.newPassword().equals(request.confirmPassword())) {
            throw new ValidationException("As senhas não conferem");
        }

        User user = getMe(userId);

        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new InvalidCredentialsException("Senha atual incorreta");
        }

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);

        refreshTokenRepository.deleteAllByUserId(userId);
    }
}
