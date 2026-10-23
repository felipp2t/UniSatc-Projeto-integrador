package com.vaulty.api.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.vaulty.api.dto.invite.InviteValidationRequest;
import com.vaulty.api.entity.UserInvite;
import com.vaulty.api.entity.UserInviteStatus;
import com.vaulty.api.repository.UserInviteRepository;
import com.vaulty.api.repository.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class InviteServiceTest {

    @ParameterizedTest
    @CsvSource({"1, 1", "999999999, 1", "1000000000, 1", "1000000001, 2", "1500000000, 2", "2000000000, 2"})
    void roundsPositiveRemainingTimeUpWithoutTruncatingFractions(long remainingNanos, long expectedSeconds) {
        Clock clock = Clock.fixed(Instant.parse("2030-01-01T00:00:00Z"), ZoneOffset.UTC);
        UserInviteRepository invites = mock(UserInviteRepository.class);
        UserRepository users = mock(UserRepository.class);
        UserInvite invite = new UserInvite();
        invite.setEmail("invite@example.com");
        invite.setToken("token");
        invite.setExpiresAt(OffsetDateTime.now(clock).plusNanos(remainingNanos));
        when(users.findByEmail(invite.getEmail())).thenReturn(Optional.empty());
        when(invites.findByEmailAndTokenAndStatus(invite.getEmail(), invite.getToken(), UserInviteStatus.PENDING))
                .thenReturn(Optional.of(invite));
        InviteService service = new InviteService(
                invites, users, mock(WorkspaceService.class), mock(EmailOutboxService.class), clock, 604800000);

        var result = service.validate(new InviteValidationRequest(invite.getEmail(), invite.getToken()));

        assertThat(result.email()).isEqualTo(invite.getEmail());
        assertThat(result.remainingSeconds()).isEqualTo(expectedSeconds);
    }
}
