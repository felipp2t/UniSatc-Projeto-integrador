package com.vaulty.api.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaulty.api.PostgresIntegrationTest;
import com.vaulty.api.VaultyApiApplication;
import com.vaulty.api.entity.User;
import com.vaulty.api.entity.Workspace;
import com.vaulty.api.storage.ObjectStorage;
import jakarta.servlet.http.Cookie;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.zip.ZipInputStream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.testcontainers.utility.MountableFile;

@Import(WorkspaceBackupServiceIntegrationTest.TestStorageConfiguration.class)
class WorkspaceBackupServiceIntegrationTest extends PostgresIntegrationTest {

    @Autowired private WorkspaceBackupService backupService;
    @Autowired private MaintenanceGate gate;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private SecretCipher secretCipher;
    @Autowired private ObjectStorage storage;
    private UUID itemId;
    private UUID secretId;
    private UUID ownerId;
    private UUID ownerMembershipId;
    private UUID memberId;
    private UUID memberMembershipId;
    private UUID workspaceId;
    private String ownerRole;
    private String memberRole;
    private static final Path SOURCE_STORAGE = temporaryDirectory("vaulty-backup-source-");

    @DynamicPropertySource
    static void storageProperties(DynamicPropertyRegistry registry) {
        registry.add("test.storage.root", SOURCE_STORAGE::toString);
    }

    @AfterAll
    static void removeSourceStorage() throws Exception {
        deleteTree(SOURCE_STORAGE);
    }

    @AfterEach
    void removeFixtureItem() {
        if (itemId != null) jdbcTemplate.update("DELETE FROM item WHERE id = ?", itemId);
        if (secretId != null) jdbcTemplate.update("DELETE FROM item WHERE id = ?", secretId);
        if (itemId != null) storage.delete("fixture/" + itemId);
        if (memberMembershipId != null) jdbcTemplate.update("DELETE FROM workspace_member WHERE id = ?", memberMembershipId);
        if (memberId != null) jdbcTemplate.update("DELETE FROM \"user\" WHERE id = ?", memberId);
    }

    @Test
    void packageContainsRestorablePostgresDumpAndAttachmentInventoryWithHashesAndCleansUp() throws Exception {
        User owner = jdbcTemplate.queryForObject("SELECT id, name, email, password_hash FROM \"user\" WHERE email = 'admin@gmail.com'",
                (rs, row) -> {
                    User user = new User();
                    user.setId(rs.getObject("id", UUID.class));
                    return user;
                });
        Workspace workspace = jdbcTemplate.queryForObject("SELECT id FROM workspace", (rs, row) -> {
            Workspace value = new Workspace();
            value.setId(rs.getObject("id", UUID.class));
            return value;
        });
        ownerId = owner.getId();
        workspaceId = workspace.getId();
        ownerMembershipId = jdbcTemplate.queryForObject(
                "SELECT id FROM workspace_member WHERE workspace_id = ? AND user_id = ?", UUID.class,
                workspaceId, ownerId);
        ownerRole = jdbcTemplate.queryForObject("""
                SELECT role.name FROM workspace_member member JOIN workspace_role role ON role.id = member.role_id
                WHERE member.id = ?
                """, String.class, ownerMembershipId);
        memberId = UUID.randomUUID();
        memberMembershipId = UUID.randomUUID();
        jdbcTemplate.update("INSERT INTO \"user\" (id, name, email, password_hash) VALUES (?, 'Backup member', ?, 'test-hash')",
                memberId, memberId + "@example.com");
        jdbcTemplate.update("""
                INSERT INTO workspace_member (id, user_id, workspace_id, role_id)
                SELECT ?, ?, workspace.id, role.id FROM workspace
                JOIN workspace_role role ON role.workspace_id = workspace.id AND role.name = 'Member'
                WHERE workspace.id = ?
                """, memberMembershipId, memberId, workspaceId);
        memberRole = "Member";
        itemId = UUID.randomUUID();
        secretId = UUID.randomUUID();
        byte[] attachment = "disposable attachment".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        String secretValue = "authorized disposable secret";
        jdbcTemplate.update("INSERT INTO item (id, workspace_id, type, title) VALUES (?, ?, 'file', 'backup fixture')",
                itemId, workspace.getId());
        jdbcTemplate.update("INSERT INTO item (id, workspace_id, type, title) VALUES (?, ?, 'secret', 'secret fixture')",
                secretId, workspace.getId());
        jdbcTemplate.update("INSERT INTO item_secret (item_id, value) VALUES (?, ?)", secretId, secretCipher.encrypt(secretValue));
        jdbcTemplate.update("INSERT INTO item_file (item_id, storage_key, original_name, mime_type, size_bytes) VALUES (?, ?, ?, ?, ?)",
                itemId, "fixture/" + itemId, "fixture.txt", "text/plain", attachment.length);
        storage.put("fixture/" + itemId, attachment, "text/plain");

        WorkspaceBackupService.BackupFile result = backupService.create(owner.getId());
        Path directory = result.path().getParent();
        try (result; ZipInputStream zip = new ZipInputStream(Files.newInputStream(result.path()))) {
            byte[] dump = null;
            byte[] manifestBytes = null;
            byte[] bundledAttachment = null;
            for (var entry = zip.getNextEntry(); entry != null; entry = zip.getNextEntry()) {
                byte[] content = zip.readAllBytes();
                if (entry.getName().equals("database.dump")) dump = content;
                if (entry.getName().equals("manifest.json")) manifestBytes = content;
                if (entry.getName().equals("attachments/" + itemId)) bundledAttachment = content;
            }
            assertThat(dump).startsWith("PGDMP".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
            assertThat(bundledAttachment).isEqualTo(attachment);
            JsonNode manifest = objectMapper.readTree(manifestBytes);
            assertThat(manifest.get("formatVersion").asInt()).isEqualTo(1);
            assertThat(manifest.get("workspaceId").asText()).isEqualTo(workspace.getId().toString());
            assertThat(manifest.at("/database/path").asText()).isEqualTo("database.dump");
            assertThat(manifest.at("/database/sizeBytes").asLong()).isEqualTo(dump.length);
            assertThat(manifest.at("/database/sha256").asText()).isEqualTo(sha256(dump));
            assertThat(manifest.at("/attachments/0/id").asText()).isEqualTo(itemId.toString());
            assertThat(manifest.at("/attachments/0/path").asText()).isEqualTo("attachments/" + itemId);
            assertThat(manifest.at("/attachments/0/sizeBytes").asLong()).isEqualTo(attachment.length);
            assertThat(manifest.at("/attachments/0/sha256").asText()).isEqualTo(sha256(attachment));
            assertThat(manifest.get("attachments").size()).isEqualTo(1);
            assertThat(manifest.toString()).doesNotContain("secret", "password", "token", secretValue);
            restoreAndCheckAttachmentRelationship(dump, secretValue, attachment, manifest);
        }
        assertThat(Files.exists(directory)).isFalse();
    }

    private void restoreAndCheckAttachmentRelationship(byte[] dump, String secretValue, byte[] attachment,
            JsonNode manifest) throws Exception {
        String database = "backup_" + UUID.randomUUID().toString().replace("-", "");
        String containerDump = "/tmp/" + database + ".dump";
        Path localDump = Files.createTempFile(database, ".dump");
        try {
            Files.write(localDump, dump);
            assertThat(POSTGRES.execInContainer("createdb", "-U", POSTGRES.getUsername(), database).getExitCode())
                    .isZero();
            POSTGRES.copyFileToContainer(MountableFile.forHostPath(localDump), containerDump);
            var restore = POSTGRES.execInContainer("pg_restore", "--exit-on-error", "--no-owner", "-U",
                    POSTGRES.getUsername(), "-d", database, containerDump);
            assertThat(restore.getExitCode()).withFailMessage(restore.getStderr()).isZero();
            String url = "jdbc:postgresql://" + POSTGRES.getHost() + ":" + POSTGRES.getMappedPort(5432) + "/" + database;
            try (var connection = DriverManager.getConnection(url, POSTGRES.getUsername(), POSTGRES.getPassword());
                    var statement = connection.prepareStatement(
                            "SELECT count(*) FROM item i JOIN item_file f ON f.item_id = i.id WHERE i.id = ? AND f.storage_key = ?")) {
                statement.setObject(1, itemId);
                statement.setString(2, "fixture/" + itemId);
                try (var result = statement.executeQuery()) {
                    result.next();
                    assertThat(result.getInt(1)).isEqualTo(1);
                }
                try (var secretQuery = connection.prepareStatement("SELECT value FROM item_secret WHERE item_id = ?")) {
                    secretQuery.setObject(1, secretId);
                    try (var result = secretQuery.executeQuery()) {
                        assertThat(result.next()).isTrue();
                        String encrypted = result.getString(1);
                        assertThat(encrypted).isNotEqualTo(secretValue);
                        assertThat(secretCipher.decrypt(encrypted)).isEqualTo(secretValue);
                    }
                }
            }
            assertRestoredApi(database, secretValue, attachment, manifest);
        } finally {
            POSTGRES.execInContainer("dropdb", "--if-exists", "-U", POSTGRES.getUsername(), database);
            Files.deleteIfExists(localDump);
        }
    }

    @Test
    void failedStorageReadCleansTemporaryBackupAndReopensWrites() throws Exception {
        User owner = jdbcTemplate.queryForObject("SELECT id FROM \"user\" WHERE email = 'admin@gmail.com'",
                (rs, row) -> {
                    User user = new User();
                    user.setId(rs.getObject("id", UUID.class));
                    return user;
                });
        UUID workspaceId = jdbcTemplate.queryForObject("SELECT id FROM workspace", UUID.class);
        itemId = UUID.randomUUID();
        jdbcTemplate.update("INSERT INTO item (id, workspace_id, type, title) VALUES (?, ?, 'file', 'failure fixture')",
                itemId, workspaceId);
        jdbcTemplate.update("INSERT INTO item_file (item_id, storage_key, original_name, mime_type, size_bytes) VALUES (?, ?, ?, ?, ?)",
                itemId, "fixture/failure-" + itemId, "fixture.txt", "text/plain", 1);
        long before = countTemporaryBackupDirectories();

        assertThatThrownBy(() -> backupService.create(owner.getId()))
                .isInstanceOf(WorkspaceBackupService.BackupGenerationException.class);

        assertThat(countTemporaryBackupDirectories()).isEqualTo(before);
        try (MaintenanceGate.Lease ignored = gate.enterWriter()) {
            assertThat(ignored).isNotNull();
        }
    }

    private long countTemporaryBackupDirectories() throws Exception {
        try (var paths = Files.list(Path.of(System.getProperty("java.io.tmpdir")))) {
            return paths.filter(path -> path.getFileName().toString().startsWith("vaulty-backup-")).count();
        }
    }

    private String sha256(byte[] value) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value));
    }

    private void assertRestoredApi(String database, String secretValue, byte[] attachment, JsonNode manifest)
            throws Exception {
        Path restoredStorage = Files.createTempDirectory("vaulty-backup-restored-storage-");
        String storageKey = manifest.at("/attachments/0/storageKey").asText();
        new DirectoryObjectStorage(restoredStorage).put(storageKey, attachment, "text/plain");
        String url = "jdbc:postgresql://" + POSTGRES.getHost() + ":" + POSTGRES.getMappedPort(5432) + "/" + database;
        try (ConfigurableApplicationContext app = new SpringApplicationBuilder(
                VaultyApiApplication.class, TestStorageConfiguration.class)
                .web(WebApplicationType.SERVLET)
                .run(
                        "--spring.datasource.url=" + url,
                        "--spring.datasource.username=" + POSTGRES.getUsername(),
                        "--spring.datasource.password=" + POSTGRES.getPassword(),
                        "--app.scheduling.enabled=false",
                        "--app.secret-encryption-key=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
                        "--jwt.secret=test-secret-with-at-least-thirty-two-bytes",
                        "--test.storage.root=" + restoredStorage,
                        "--server.port=0")) {
            WebApplicationContext web = (WebApplicationContext) app;
            MockMvc api = MockMvcBuilders.webAppContextSetup(web)
                    .apply(SecurityMockMvcConfigurers.springSecurity())
                    .build();
            JwtService jwt = app.getBean(JwtService.class);
            Cookie ownerCookie = new Cookie("accessToken", jwt.generateAccessToken(ownerId, ownerMembershipId, ownerRole));
            Cookie memberCookie = new Cookie("accessToken", jwt.generateAccessToken(memberId, memberMembershipId, memberRole));

            api.perform(get("/workspaces/{workspaceId}/items/{itemId}/secret", workspaceId, secretId)
                            .cookie(ownerCookie))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.value").value(secretValue));
            api.perform(get("/workspaces/{workspaceId}/items/{itemId}/secret", workspaceId, secretId)
                            .cookie(memberCookie))
                    .andExpect(status().isForbidden());
            api.perform(get("/workspaces/{workspaceId}/items/{itemId}/attachment", workspaceId, itemId)
                            .cookie(ownerCookie))
                    .andExpect(status().isOk())
                    .andExpect(content().bytes(attachment));
        } finally {
            deleteTree(restoredStorage);
        }
    }

    @Test
    void interruptedDumpTerminatesProcessBeforeReleasingGateAndRestoresInterruptFlag() throws Exception {
        User owner = jdbcTemplate.queryForObject("SELECT id FROM \"user\" WHERE email = 'admin@gmail.com'",
                (rs, row) -> {
                    User user = new User();
                    user.setId(rs.getObject("id", UUID.class));
                    return user;
                });
        Path support = Path.of(System.getenv("PATH").split(java.io.File.pathSeparator)[0]);
        Path marker = support.resolve("pg_dump.interrupt");
        Path pidFile = support.resolve("pg_dump.interrupt.pid");
        Files.writeString(marker, "interrupt");
        long before = countTemporaryBackupDirectories();
        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            Future<Boolean> generation = executor.submit(() -> {
                try {
                    backupService.create(owner.getId());
                    return false;
                } catch (WorkspaceBackupService.BackupGenerationException expected) {
                    return Thread.currentThread().isInterrupted();
                }
            });
            long deadline = System.nanoTime() + java.util.concurrent.TimeUnit.SECONDS.toNanos(10);
            while (!Files.exists(pidFile) && System.nanoTime() < deadline) Thread.sleep(10);
            assertThat(Files.exists(pidFile)).isTrue();
            long pid = Long.parseLong(Files.readString(pidFile));
            executor.shutdownNow();
            assertThat(generation.get(5, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
            assertThat(ProcessHandle.of(pid).map(ProcessHandle::isAlive).orElse(false)).isFalse();
            assertThat(countTemporaryBackupDirectories()).isEqualTo(before);
            try (MaintenanceGate.Lease writer = gate.enterWriter()) {
                assertThat(writer).isNotNull();
            }
        } finally {
            executor.shutdownNow();
            Files.deleteIfExists(marker);
            Files.deleteIfExists(pidFile);
        }
    }

    @TestConfiguration
    static class TestStorageConfiguration {
        @Bean
        ObjectStorage fileObjectStorage(@Value("${test.storage.root}") String root) throws IOException {
            return new DirectoryObjectStorage(Path.of(root));
        }
    }

    private static final class DirectoryObjectStorage implements ObjectStorage {
        private final Path root;

        private DirectoryObjectStorage(Path root) throws IOException {
            this.root = root.toAbsolutePath().normalize();
            Files.createDirectories(this.root);
        }

        @Override
        public void put(String key, byte[] content, String mimeType) {
            Path destination = resolve(key);
            try {
                Files.createDirectories(destination.getParent());
                Files.write(destination, content);
            } catch (IOException exception) {
                throw new IllegalStateException(exception);
            }
        }

        @Override
        public byte[] get(String key) {
            try {
                return Files.readAllBytes(resolve(key));
            } catch (IOException exception) {
                throw new IllegalStateException(exception);
            }
        }

        @Override
        public void delete(String key) {
            try {
                Files.deleteIfExists(resolve(key));
            } catch (IOException exception) {
                throw new IllegalStateException(exception);
            }
        }

        private Path resolve(String key) {
            Path path = root.resolve(key).normalize();
            if (!path.startsWith(root)) throw new IllegalArgumentException("Invalid object key");
            return path;
        }
    }

    private static Path temporaryDirectory(String prefix) {
        try {
            return Files.createTempDirectory(prefix);
        } catch (IOException exception) {
            throw new ExceptionInInitializerError(exception);
        }
    }

    private static void deleteTree(Path root) throws IOException {
        if (!Files.exists(root)) return;
        try (var paths = Files.walk(root)) {
            for (Path path : paths.sorted(java.util.Comparator.reverseOrder()).toList()) Files.deleteIfExists(path);
        }
    }
}
