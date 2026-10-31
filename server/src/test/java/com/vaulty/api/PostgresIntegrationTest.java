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
            jdbcTemplate.update("DELETE FROM activity_log");
            jdbcTemplate.update("DELETE FROM email_outbox");
            jdbcTemplate.update("DELETE FROM password_reset_token");
            jdbcTemplate.update("DELETE FROM refresh_token");
            jdbcTemplate.update("DELETE FROM user_invite");
            jdbcTemplate.update("""
                    INSERT INTO "user" (id, name, email, password_hash)
                    VALUES ('afd23ecc-4abb-4e2b-b985-3aaa8637a839', 'Administrador', 'admin@gmail.com',
                            '$argon2id$v=19$m=16384,t=2,p=1$d1oLFzIUrRrPYQaKonX2KA$nKvPhijE6S9EzOy08pgAANMF4VsTR9OwtInJnNDaSPk')
                    ON CONFLICT (id) DO NOTHING
                    """);
            jdbcTemplate.update("UPDATE workspace SET owner_id = 'afd23ecc-4abb-4e2b-b985-3aaa8637a839'");
            jdbcTemplate.update("""
                    INSERT INTO workspace_member (id, user_id, workspace_id, role_id)
                    SELECT gen_random_uuid(), workspace.owner_id, workspace.id, role.id
                    FROM workspace
                    JOIN workspace_role role ON role.workspace_id = workspace.id AND role.name = 'Owner'
                    ON CONFLICT (workspace_id, user_id) DO UPDATE SET role_id = EXCLUDED.role_id
                    """);
            jdbcTemplate.update("DELETE FROM \"user\" WHERE id NOT IN (SELECT owner_id FROM workspace)");
        });
    }

    protected static final PostgreSQLContainer<?> POSTGRES =
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
