package com.vaulty.api.dto.admin;

// addedExistingAccount indica que a conta já existia e entrou direto, sem convite por e-mail.
public record AdminInviteResponse(boolean addedExistingAccount) {}
