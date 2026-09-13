package com.rootly.api.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class RateLimitRegistryTest {

    @Test
    void blocksTheSixthRequestAndRefillsAfterTheWindow() {
        MutableClock clock = new MutableClock(Instant.parse("2026-01-01T00:00:00Z"));
        RateLimitRegistry registry = new RateLimitRegistry(clock);

        for (int request = 0; request < RateLimitRegistry.MAX_REQUESTS; request++) {
            assertThat(registry.tryConsume("client:/auth/login")).isTrue();
        }
        assertThat(registry.tryConsume("client:/auth/login")).isFalse();

        clock.advance(Duration.ofMinutes(1));
        assertThat(registry.tryConsume("client:/auth/login")).isTrue();
    }

    @Test
    void removesOnlyInactiveEntriesAfterTheirRateWindowHasEnded() {
        MutableClock clock = new MutableClock(Instant.parse("2026-01-01T00:00:00Z"));
        RateLimitRegistry registry = new RateLimitRegistry(clock);
        registry.tryConsume("inactive");

        clock.advance(Duration.ofSeconds(119));
        registry.cleanupInactive();
        assertThat(registry.size()).isEqualTo(1);

        clock.advance(Duration.ofSeconds(1));
        registry.cleanupInactive();
        assertThat(registry.size()).isZero();
    }

    @Test
    void rejectsUnknownClientsWhenTheRegistryIsFull() {
        MutableClock clock = new MutableClock(Instant.parse("2026-01-01T00:00:00Z"));
        RateLimitRegistry registry = new RateLimitRegistry(clock);
        for (int index = 0; index < RateLimitRegistry.MAX_ENTRIES; index++) {
            assertThat(registry.tryConsume("client-" + index)).isTrue();
        }

        assertThat(registry.tryConsume("overflow-client")).isFalse();
        assertThat(registry.size()).isEqualTo(RateLimitRegistry.MAX_ENTRIES);
    }
}
