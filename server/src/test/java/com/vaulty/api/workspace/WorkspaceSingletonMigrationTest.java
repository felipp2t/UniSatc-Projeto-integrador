package com.vaulty.api.workspace;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.core.io.ClassPathResource;
import org.testcontainers.containers.PostgreSQLContainer;

class WorkspaceSingletonMigrationTest {

    @Test
    void provisionsAnEmptyInstallation() throws Exception {
        try (PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine")) {
            postgres.start();
            try (Connection connection = connect(postgres); Statement sql = connection.createStatement()) {
                migrateThroughV4(sql);
                applySingletonMigrations(sql);
                assertThat(count(sql, "SELECT count(*) FROM workspace")).isEqualTo(1);
                assertThat(count(sql, "SELECT count(*) FROM workspace_role")).isEqualTo(2);
                assertThat(count(sql, "SELECT count(*) FROM workspace_member")).isEqualTo(1);
            }
        }
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void preservesAnExistingWorkspaceAndEnsuresDefaultRoles(boolean hasOwnerRole) throws Exception {
        try (PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine")) {
            postgres.start();
            try (Connection connection = connect(postgres); Statement sql = connection.createStatement()) {
                migrateThroughV4(sql);
                UUID owner = UUID.randomUUID();
                UUID workspace = UUID.randomUUID();
                UUID role = UUID.randomUUID();
                sql.execute("""
                        INSERT INTO "user" (id, name, email, password_hash)
                        VALUES ('%s', 'Owner', 'owner@example.com', 'hash')
                        """.formatted(owner));
                sql.execute("""
                        INSERT INTO workspace (id, owner_id, name, description)
                        VALUES ('%s', '%s', 'Existing', 'Preserved')
                        """.formatted(workspace, owner));
                if (hasOwnerRole) {
                    sql.execute("""
                            INSERT INTO workspace_role (id, workspace_id, name)
                            VALUES ('%s', '%s', 'Owner')
                            """.formatted(role, workspace));
                    sql.execute("""
                            INSERT INTO workspace_member (id, user_id, workspace_id, role_id)
                            VALUES (gen_random_uuid(), '%s', '%s', '%s')
                            """.formatted(owner, workspace, role));
                }
                applySingletonMigrations(sql);
                assertThat(count(sql, """
                        SELECT count(*) FROM workspace
                        WHERE id = '%s' AND owner_id = '%s'
                          AND name = 'Existing' AND description = 'Preserved'
                        """.formatted(workspace, owner))).isEqualTo(1);
                assertThat(count(sql, "SELECT count(*) FROM workspace_role WHERE workspace_id = '%s'".formatted(workspace))).isEqualTo(2);
                assertThat(count(sql, """
                        SELECT count(*) FROM workspace_member member
                        JOIN workspace_role role ON role.id = member.role_id
                        WHERE member.user_id = '%s' AND member.workspace_id = '%s' AND role.name = 'Owner'
                        """.formatted(owner, workspace))).isEqualTo(1);
                if (hasOwnerRole) {
                    assertThat(count(sql, "SELECT count(*) FROM workspace_role WHERE id = '%s'".formatted(role))).isEqualTo(1);
                }
            }
        }
    }

    @Test
    void rejectsMultipleWorkspaces() throws Exception {
        try (PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine")) {
            postgres.start();
            try (Connection connection = connect(postgres); Statement sql = connection.createStatement()) {
                migrateThroughV4(sql);
                sql.execute("INSERT INTO workspace (id, owner_id, name) SELECT gen_random_uuid(), id, 'First' FROM \"user\"");
                sql.execute("INSERT INTO workspace (id, owner_id, name) SELECT gen_random_uuid(), id, 'Second' FROM \"user\"");
                assertThatThrownBy(() -> applySingletonMigrations(sql))
                        .isInstanceOf(SQLException.class)
                        .hasMessageContaining("regularize manualmente");
            }
        }
    }

    private Connection connect(PostgreSQLContainer<?> postgres) throws SQLException {
        return DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
    }

    private void migrateThroughV4(Statement sql) throws Exception {
        for (String migration : new String[] {
                "V1__create_authentication_tables.sql", "V2__insert_admin_user.sql",
                "V3__create_email_outbox_and_expiration_indexes.sql", "V4__create_workspace_foundation.sql"}) {
            executeMigration(sql, migration);
        }
    }

    private void applySingletonMigrations(Statement sql) throws Exception {
        executeMigration(sql, "V5__enforce_workspace_singleton.sql");
        executeMigration(sql, "V6__seed_workspace_member_role.sql");
    }

    private void executeMigration(Statement sql, String migration) throws Exception {
        try (var stream = new ClassPathResource("db/migration/" + migration).getInputStream()) {
            sql.execute(new String(stream.readAllBytes(), StandardCharsets.UTF_8));
        }
    }

    private int count(Statement sql, String query) throws SQLException {
        try (var result = sql.executeQuery(query)) {
            result.next();
            return result.getInt(1);
        }
    }
}
