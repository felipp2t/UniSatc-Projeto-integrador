package com.vaulty.api.workspace;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;

class RefreshTokenMembershipMigrationTest {

    @Test
    void backfillsCurrentMembershipRemovesOrphansAndCascadesOnMembershipDeletion() throws Exception {
        try (var postgres = new PostgreSQLContainer<>("postgres:17-alpine")) {
            postgres.start();
            Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                    .target("17").load().migrate();

            try (var connection = connect(postgres); var sql = connection.createStatement()) {
                UUID membershipId;
                UUID memberUserId;
                try (var result = sql.executeQuery("""
                        SELECT member.id, member.user_id
                        FROM workspace_member member
                        JOIN workspace ON workspace.id = member.workspace_id
                        WHERE member.user_id = workspace.owner_id
                        """)) {
                    assertThat(result.next()).isTrue();
                    membershipId = result.getObject("id", UUID.class);
                    memberUserId = result.getObject("user_id", UUID.class);
                }

                UUID orphanUserId = UUID.randomUUID();
                sql.execute("""
                        INSERT INTO "user" (id, name, email, password_hash)
                        VALUES ('%s', 'Orphan', 'orphan@example.com', 'hash')
                        """.formatted(orphanUserId));
                sql.execute("""
                        INSERT INTO refresh_token (id, token, user_id, expires_at)
                        VALUES ('%s', 'kept-refresh', '%s', now() + interval '1 hour'),
                               ('%s', 'orphan-refresh', '%s', now() + interval '1 hour')
                        """.formatted(UUID.randomUUID(), memberUserId, UUID.randomUUID(), orphanUserId));

                flyway(postgres).migrate();

                try (var result = sql.executeQuery("""
                        SELECT workspace_member_id FROM refresh_token WHERE token = 'kept-refresh'
                        """)) {
                    assertThat(result.next()).isTrue();
                    assertThat(result.getObject("workspace_member_id", UUID.class)).isEqualTo(membershipId);
                    assertThat(result.next()).isFalse();
                }
                assertThat(count(connection, "SELECT count(*) FROM refresh_token WHERE token = 'orphan-refresh'"))
                        .isZero();
                assertThat(count(connection, """
                        SELECT count(*) FROM information_schema.columns
                        WHERE table_name = 'refresh_token' AND column_name = 'workspace_member_id'
                          AND is_nullable = 'NO'
                        """)).isEqualTo(1);
                assertThat(count(connection, """
                        SELECT count(*) FROM pg_constraint
                        WHERE conrelid = 'refresh_token'::regclass
                          AND conname = 'fk_refresh_token_workspace_member'
                          AND contype = 'f'
                        """)).isEqualTo(1);

                assertThatThrownBy(() -> sql.execute("""
                        INSERT INTO refresh_token (id, token, user_id, expires_at, workspace_member_id)
                        VALUES ('%s', 'bad-reference', '%s', now() + interval '1 hour', '%s')
                        """.formatted(UUID.randomUUID(), memberUserId, UUID.randomUUID())))
                        .isInstanceOf(SQLException.class);

                sql.execute("DELETE FROM workspace_member WHERE id = '%s'".formatted(membershipId));
                assertThat(count(connection, "SELECT count(*) FROM refresh_token WHERE token = 'kept-refresh'"))
                        .isZero();
            }
        }
    }

    private Flyway flyway(PostgreSQLContainer<?> postgres) {
        return Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword()).load();
    }

    private Connection connect(PostgreSQLContainer<?> postgres) throws SQLException {
        return DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
    }

    private int count(Connection connection, String query) throws SQLException {
        try (var sql = connection.createStatement(); var result = sql.executeQuery(query)) {
            result.next();
            return result.getInt(1);
        }
    }
}
