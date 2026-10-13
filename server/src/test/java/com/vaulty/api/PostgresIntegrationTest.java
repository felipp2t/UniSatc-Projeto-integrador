package com.vaulty.api;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;

@SpringBootTest(properties = {
    "app.scheduling.enabled=false",
    "jwt.secret=test-secret-with-at-least-thirty-two-bytes",
    "spring.mail.host=localhost",
    "app.secret-encryption-key=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
})
public abstract class PostgresIntegrationTest {

    @Autowired protected JdbcTemplate jdbcTemplate;
    @Autowired private TransactionTemplate fixtureTransaction;

    @BeforeEach
    void resetDatabaseFixture() {
        fixtureTransaction.executeWithoutResult(status -> {
            jdbcTemplate.update("DELETE FROM email_outbox");
            jdbcTemplate.update("DELETE FROM password_reset_token");
            jdbcTemplate.update("DELETE FROM refresh_token");
            jdbcTemplate.update("DELETE FROM user_invite");
            jdbcTemplate.update("DELETE FROM \"user\" WHERE id NOT IN (SELECT owner_id FROM workspace)");
        });
    }

    private static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:17-alpine");

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }
}
