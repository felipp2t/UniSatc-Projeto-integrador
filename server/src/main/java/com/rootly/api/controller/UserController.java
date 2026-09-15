package com.rootly.api.controller;

import com.rootly.api.controller.docs.UserControllerDocs;
import com.rootly.api.dto.user.ChangePasswordRequest;
import com.rootly.api.dto.user.UpdateProfileRequest;
import com.rootly.api.dto.user.UserResponse;
import com.rootly.api.service.UserService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class UserController implements UserControllerDocs {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    @Override
    public UserResponse getMe(@AuthenticationPrincipal UUID userId) {
        return UserResponse.from(userService.getMe(userId));
    }

    @PatchMapping("/me")
    @Override
    public ResponseEntity<Void> updateProfile(
            @AuthenticationPrincipal UUID userId,

            @Valid @RequestBody UpdateProfileRequest request) {
        userService.updateProfile(userId, request);

        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    @PatchMapping("/me/password")
    @Override
    public ResponseEntity<Void> changePassword(
            @AuthenticationPrincipal UUID userId,

            @Valid @RequestBody ChangePasswordRequest request) {
        userService.changePassword(userId, request);

        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }
}
