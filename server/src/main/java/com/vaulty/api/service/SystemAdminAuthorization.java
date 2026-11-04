package com.vaulty.api.service;

import com.vaulty.api.exception.ForbiddenException;
import com.vaulty.api.repository.UserRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SystemAdminAuthorization {

    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public boolean isSystemAdmin(UUID userId) {
        return userRepository.findById(userId)
                .map(user -> user.isSystemAdmin())
                .orElse(false);
    }

    public void require(UUID userId) {
        if (!isSystemAdmin(userId)) {
            throw new ForbiddenException("Permissão insuficiente");
        }
    }
}
