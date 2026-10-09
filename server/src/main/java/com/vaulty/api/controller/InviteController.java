package com.vaulty.api.controller;

import com.vaulty.api.controller.docs.InviteControllerDocs;
import com.vaulty.api.dto.invite.InviteUserRequest;
import com.vaulty.api.service.InviteService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/invites")
public class InviteController implements InviteControllerDocs {

    private final InviteService inviteService;

    public InviteController(InviteService inviteService) {
        this.inviteService = inviteService;
    }

    @PostMapping
    @Override
    public ResponseEntity<Void> invite(
            @AuthenticationPrincipal UUID inviterId,

            @Valid @RequestBody InviteUserRequest request) {
        inviteService.inviteUser(inviterId, request);

        return ResponseEntity.status(HttpStatus.CREATED).build();
    }
}
