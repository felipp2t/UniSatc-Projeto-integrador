package com.vaulty.api.workspace;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.FlywayException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.testcontainers.containers.PostgreSQLContainer;

class ContentNameMigrationTest {

    @Test
    void upgradesExistingContentAndMaintainsGeneratedSearchAndIdentity() throws Exception {
        try (var postgres = new PostgreSQLContainer<>("postgres:17-alpine")) {
            postgres.start();
            migrateThroughV10(postgres);
            try (var connection = connect(postgres); var sql = connection.createStatement()) {
                UUID workspaceId = workspaceId(connection);
                UUID itemId = UUID.randomUUID();
                insertItem(connection, workspaceId, itemId, "  Chave de Produção  ");
                sql.execute("INSERT INTO collection (id, workspace_id, name) VALUES (gen_random_uuid(), '"
                        + workspaceId + "', 'Produção')");

                flyway(postgres).migrate();

                try (var result = sql.executeQuery("SELECT title, title_key FROM item WHERE id = '" + itemId + "'")) {
                    result.next();
                    assertThat(result.getString("title")).isEqualTo("  Chave de Produção  ");
                    assertThat(result.getString("title_key")).isEqualTo("chave de producao");
                }
                assertThat(count(connection, "SELECT count(*) FROM role_permission permission JOIN workspace_role role"
                        + " ON role.id = permission.role_id WHERE role.name = 'Member' AND action = 'read'"
                        + " AND resource IN ('item', 'collection')")).isEqualTo(2);
                assertThatThrownBy(() -> insertItem(connection, workspaceId, UUID.randomUUID(), "CHAVE DE PRODUCAO"))
                        .isInstanceOf(SQLException.class).hasMessageContaining("uq_item_workspace_collection_title");
                assertThatThrownBy(() -> sql.execute("INSERT INTO collection (id, workspace_id, name) VALUES"
                        + " (gen_random_uuid(), '" + workspaceId + "', ' producao ')"))
                        .isInstanceOf(SQLException.class).hasMessageContaining("uq_collection_workspace_parent_name");

                sql.execute("UPDATE item SET title = 'API de Homologação' WHERE id = '" + itemId + "'");
                assertThat(count(connection, "SELECT count(*) FROM item WHERE title_search @@"
                        + " plainto_tsquery('simple', normalize_content_name('homologacao API'))")).isEqualTo(1);
                assertThat(count(connection, "SELECT count(*) FROM item WHERE title_search @@"
                        + " plainto_tsquery('simple', normalize_content_name('api producao'))")).isZero();
            }
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"item", "collection"})
    void refusesLegacyCollisionsWithoutChangingContentAndCanResumeAfterRegularization(String table) throws Exception {
        try (var postgres = new PostgreSQLContainer<>("postgres:17-alpine")) {
            postgres.start();
            migrateThroughV10(postgres);
            try (var connection = connect(postgres); var sql = connection.createStatement()) {
                UUID workspaceId = workspaceId(connection);
                String column = "item".equals(table) ? "title" : "name";
                String extraColumns = "item".equals(table) ? ", type, text_content" : "";
                String extraValues = "item".equals(table) ? ", 'text', 'Content'" : "";
                for (String name : List.of("Produção", "producao")) {
                    sql.execute("INSERT INTO " + table + " (id, workspace_id, " + column + extraColumns + ")"
                            + " VALUES (gen_random_uuid(), '" + workspaceId + "', '" + name + "'" + extraValues + ")");
                }

                assertThatThrownBy(() -> flyway(postgres).migrate())
                        .isInstanceOf(FlywayException.class).hasStackTraceContaining("regularize manualmente");
                assertThat(count(connection, "SELECT count(*) FROM " + table)).isEqualTo(2);
                assertThat(count(connection, "SELECT count(*) FROM " + table + " WHERE " + column
                        + " IN ('Produção', 'producao')")).isEqualTo(2);
                sql.execute("UPDATE " + table + " SET " + column + " = 'Outra' WHERE " + column + " = 'producao'");
                flyway(postgres).migrate();
                assertThat(count(connection, "SELECT count(*) FROM " + table)).isEqualTo(2);
            }
        }
    }

    @Test
    void normalizedUniquenessRejectsOneOfTwoConcurrentTransactions() throws Exception {
        try (var postgres = new PostgreSQLContainer<>("postgres:17-alpine")) {
            postgres.start();
            flyway(postgres).migrate();
            UUID workspaceId;
            try (var connection = connect(postgres)) {
                workspaceId = workspaceId(connection);
            }
            var barrier = new CyclicBarrier(2);
            var executor = Executors.newFixedThreadPool(2);
            try {
                var first = executor.submit(() -> insertConcurrently(postgres, workspaceId, "Produção", barrier));
                var second = executor.submit(() -> insertConcurrently(postgres, workspaceId, "PRODUCAO", barrier));
                assertThat(List.of(first.get(15, TimeUnit.SECONDS), second.get(15, TimeUnit.SECONDS)))
                        .containsExactlyInAnyOrder(true, false);
                try (var connection = connect(postgres)) {
                    assertThat(count(connection, "SELECT count(*) FROM item")).isEqualTo(1);
                }
            } finally {
                executor.shutdownNow();
            }
        }
    }

    private boolean insertConcurrently(PostgreSQLContainer<?> postgres, UUID workspaceId,
                                       String title, CyclicBarrier barrier) throws Exception {
        try (var connection = connect(postgres)) {
            connection.setAutoCommit(false);
            barrier.await(10, TimeUnit.SECONDS);
            try {
                insertItem(connection, workspaceId, UUID.randomUUID(), title);
                connection.commit();
                return true;
            } catch (SQLException exception) {
                connection.rollback();
                if (!"23505".equals(exception.getSQLState())) {
                    throw exception;
                }
                return false;
            }
        }
    }

    private Flyway flyway(PostgreSQLContainer<?> postgres) {
        return Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword()).load();
    }

    private void migrateThroughV10(PostgreSQLContainer<?> postgres) {
        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .target("10").load().migrate();
    }

    private Connection connect(PostgreSQLContainer<?> postgres) throws SQLException {
        return DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
    }

    private UUID workspaceId(Connection connection) throws SQLException {
        try (var sql = connection.createStatement(); var result = sql.executeQuery("SELECT id FROM workspace")) {
            result.next();
            return result.getObject(1, UUID.class);
        }
    }

    private void insertItem(Connection connection, UUID workspaceId, UUID itemId, String title) throws SQLException {
        try (var insert = connection.prepareStatement(
                "INSERT INTO item (id, workspace_id, type, title, text_content) VALUES (?, ?, 'text', ?, 'Content')")) {
            insert.setObject(1, itemId);
            insert.setObject(2, workspaceId);
            insert.setString(3, title);
            insert.executeUpdate();
        }
    }

    private int count(Connection connection, String query) throws SQLException {
        try (var sql = connection.createStatement(); var result = sql.executeQuery(query)) {
            result.next();
            return result.getInt(1);
        }
    }
}
