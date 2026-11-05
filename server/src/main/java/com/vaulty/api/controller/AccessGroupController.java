package com.vaulty.api.controller;

import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestMethod;

@RestController
@RequestMapping("/workspaces/{workspaceId}/groups")
public class AccessGroupController {

    @RequestMapping(method = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE})
    public ResponseEntity<Void> retired(@AuthenticationPrincipal UUID userId) {
        return ResponseEntity.status(410).build();
    }

    @RequestMapping(path = "/{groupId}", method = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE})
    public ResponseEntity<Void> retiredGroup(@AuthenticationPrincipal UUID userId) {
        return ResponseEntity.status(410).build();
    }

    @RequestMapping(path = "/{groupId}/members", method = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE})
    public ResponseEntity<Void> retiredMembers(@AuthenticationPrincipal UUID userId) {
        return ResponseEntity.status(410).build();
    }

    @RequestMapping(path = "/{groupId}/members/{memberId}", method = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE})
    public ResponseEntity<Void> retiredMember(@AuthenticationPrincipal UUID userId) {
        return ResponseEntity.status(410).build();
    }
}
