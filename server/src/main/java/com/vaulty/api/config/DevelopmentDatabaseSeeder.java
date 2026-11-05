package com.vaulty.api.config;

import com.vaulty.api.service.PermissionCatalog;
import com.vaulty.api.service.SecretCipher;
import java.net.URI;
import java.util.UUID;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

@Component
@ConditionalOnProperty(name = "app.dev-seed.enabled", havingValue = "true")
public class DevelopmentDatabaseSeeder implements ApplicationRunner {

    private static final String DEV_PASSWORD = "vaulty123";
    private static final UUID WORKSPACE = id("10000000-0000-4000-8000-000000000001");

    private static final UUID OWNER = id("20000000-0000-4000-8000-000000000001");
    private static final UUID EDITOR = id("20000000-0000-4000-8000-000000000002");
    private static final UUID VIEWER = id("20000000-0000-4000-8000-000000000003");
    private static final UUID AUDITOR = id("20000000-0000-4000-8000-000000000004");
    private static final UUID CONTRIBUTOR = id("20000000-0000-4000-8000-000000000005");
    private static final UUID RAFAEL = id("20000000-0000-4000-8000-000000000006");
    private static final UUID MATHEUS = id("20000000-0000-4000-8000-000000000007");

    private static final UUID OWNER_ROLE = id("30000000-0000-4000-8000-000000000001");
    private static final UUID MEMBER_ROLE = id("30000000-0000-4000-8000-000000000002");
    private static final UUID EDITOR_ROLE = id("30000000-0000-4000-8000-000000000003");
    private static final UUID VIEWER_ROLE = id("30000000-0000-4000-8000-000000000004");
    private static final UUID AUDITOR_ROLE = id("30000000-0000-4000-8000-000000000005");
    private static final UUID CONTRIBUTOR_ROLE = id("30000000-0000-4000-8000-000000000006");

    private static final UUID OWNER_MEMBER = id("40000000-0000-4000-8000-000000000001");
    private static final UUID EDITOR_MEMBER = id("40000000-0000-4000-8000-000000000002");
    private static final UUID VIEWER_MEMBER = id("40000000-0000-4000-8000-000000000003");
    private static final UUID AUDITOR_MEMBER = id("40000000-0000-4000-8000-000000000004");
    private static final UUID CONTRIBUTOR_MEMBER = id("40000000-0000-4000-8000-000000000005");
    private static final UUID RAFAEL_MEMBER = id("40000000-0000-4000-8000-000000000006");
    private static final UUID MATHEUS_MEMBER = id("40000000-0000-4000-8000-000000000007");

    private static final UUID ENGINEERING_GROUP = id("50000000-0000-4000-8000-000000000001");
    private static final UUID FINANCE_GROUP = id("50000000-0000-4000-8000-000000000002");

    private static final UUID ENGINEERING = id("60000000-0000-4000-8000-000000000001");
    private static final UUID FRONTEND = id("60000000-0000-4000-8000-000000000002");
    private static final UUID RESTRICTED = id("60000000-0000-4000-8000-000000000003");
    private static final UUID FINANCE = id("60000000-0000-4000-8000-000000000004");
    private static final UUID SHARED = id("60000000-0000-4000-8000-000000000005");

    private static final UUID WELCOME_ITEM = id("70000000-0000-4000-8000-000000000001");
    private static final UUID ROADMAP_ITEM = id("70000000-0000-4000-8000-000000000002");
    private static final UUID SECRET_ITEM = id("70000000-0000-4000-8000-000000000003");
    private static final UUID FINANCE_ITEM = id("70000000-0000-4000-8000-000000000004");
    private static final UUID SHARED_ITEM = id("70000000-0000-4000-8000-000000000005");
    private static final UUID DIRECT_SHARED_ITEM = id("70000000-0000-4000-8000-000000000006");

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final SecretCipher secretCipher;
    private final TransactionTemplate transaction;
    private final Environment environment;

    public DevelopmentDatabaseSeeder(
            JdbcTemplate jdbc,
            PasswordEncoder passwordEncoder,
            SecretCipher secretCipher,
            TransactionTemplate transaction,
            Environment environment) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
        this.secretCipher = secretCipher;
        this.transaction = transaction;
        this.environment = environment;
    }

    @Override
    public void run(ApplicationArguments args) {
        requireLocalDevelopmentDatabase(environment.getRequiredProperty("spring.datasource.url"));
        transaction.executeWithoutResult(status -> seed());
        System.out.println("Development database seeded. Demo accounts use password: " + DEV_PASSWORD);
    }

    private void seed() {
        jdbc.execute("""
                TRUNCATE TABLE email_outbox, password_reset_token, refresh_token, user_invite,
                    notification, activity_log, collection_public_grant, item_member_grant,
                    collection_access_grant, access_group_member, item_file, item_media,
                    item_secret, item, collection, role_permission, workspace_member,
                    access_group, workspace_role, workspace, \"user\"
                RESTART IDENTITY CASCADE
                """);

        String passwordHash = passwordEncoder.encode(DEV_PASSWORD);
        insertUser(OWNER, "Olivia Owner", "owner@vaulty.local", passwordHash);
        insertUser(EDITOR, "Eddie Editor", "editor@vaulty.local", passwordHash);
        insertUser(VIEWER, "Vera Viewer", "viewer@vaulty.local", passwordHash);
        insertUser(AUDITOR, "Alex Auditor", "auditor@vaulty.local", passwordHash);
        insertUser(CONTRIBUTOR, "Casey Contributor", "contributor@vaulty.local", passwordHash);
        insertUser(RAFAEL, "Rafael Augusto", "rafael.augusto@vaulty.local", passwordHash);
        insertUser(MATHEUS, "Matheus Silveira", "matheus.silveira@vaulty.local", passwordHash);

        jdbc.update(
                "INSERT INTO workspace (id, owner_id, name, description, singleton) VALUES (?, ?, ?, ?, TRUE)",
                WORKSPACE,
                OWNER,
                "Vaulty Demo",
                "Workspace de demonstração com cargos, grupos, pastas e compartilhamento.");

        insertRole(OWNER_ROLE, "Owner");
        insertRole(MEMBER_ROLE, "Member");
        insertRole(EDITOR_ROLE, "Editor");
        insertRole(VIEWER_ROLE, "Viewer");
        insertRole(AUDITOR_ROLE, "Auditor");
        insertRole(CONTRIBUTOR_ROLE, "Contributor");
        seedPermissions();

        insertMember(OWNER_MEMBER, OWNER, OWNER_ROLE);
        insertMember(EDITOR_MEMBER, EDITOR, EDITOR_ROLE);
        insertMember(VIEWER_MEMBER, VIEWER, VIEWER_ROLE);
        insertMember(AUDITOR_MEMBER, AUDITOR, AUDITOR_ROLE);
        insertMember(CONTRIBUTOR_MEMBER, CONTRIBUTOR, CONTRIBUTOR_ROLE);
        insertMember(RAFAEL_MEMBER, RAFAEL, MEMBER_ROLE);
        insertMember(MATHEUS_MEMBER, MATHEUS, MEMBER_ROLE);

        insertGroup(ENGINEERING_GROUP, "Engineering");
        insertGroup(FINANCE_GROUP, "Finance");
        insertGroupMember(ENGINEERING_GROUP, EDITOR_MEMBER);
        insertGroupMember(ENGINEERING_GROUP, CONTRIBUTOR_MEMBER);
        insertGroupMember(FINANCE_GROUP, VIEWER_MEMBER);
        insertGroupMember(FINANCE_GROUP, AUDITOR_MEMBER);

        insertCollection(ENGINEERING, null, "Engineering", true);
        insertCollection(FRONTEND, ENGINEERING, "Frontend", true);
        insertCollection(RESTRICTED, ENGINEERING, "Restricted", false);
        insertCollection(FINANCE, null, "Finance", true);
        insertCollection(SHARED, null, "Shared", true);
        jdbc.update(
                "INSERT INTO collection_access_grant (collection_id, group_id, workspace_id) VALUES (?, ?, ?), (?, ?, ?)",
                ENGINEERING,
                ENGINEERING_GROUP,
                WORKSPACE,
                FINANCE,
                FINANCE_GROUP,
                WORKSPACE);
        jdbc.update(
                "INSERT INTO collection_public_grant (collection_id, workspace_id) VALUES (?, ?)",
                SHARED,
                WORKSPACE);

        insertItem(WELCOME_ITEM, null, "Welcome", "text", "Welcome to the Vaulty demo workspace.", null);
        insertItem(ROADMAP_ITEM, FRONTEND, "Frontend roadmap", "text", "1. Build accessible flows.\n2. Ship with confidence.", null);
        insertItem(SECRET_ITEM, RESTRICTED, "Demo credentials", "secret", null, null);
        jdbc.update(
                "INSERT INTO item_secret (item_id, value) VALUES (?, ?)",
                SECRET_ITEM,
                secretCipher.encrypt("demo-secret-123"));
        insertItem(FINANCE_ITEM, FINANCE, "Invoice process", "text", "Submit invoices by the last business day of the month.", null);
        insertItem(SHARED_ITEM, SHARED, "Team handbook", "link", null, "https://example.com/handbook");
        insertItem(DIRECT_SHARED_ITEM, RESTRICTED, "Access request", "text", "Ask the owner for access to this restricted folder.", null);

        jdbc.update(
                "INSERT INTO item_member_grant (item_id, workspace_member_id, workspace_id) VALUES (?, ?, ?)",
                DIRECT_SHARED_ITEM,
                VIEWER_MEMBER,
                WORKSPACE);

        insertNotification(EDITOR, "Folder shared", "Engineering is now available to you.", false);
        insertNotification(VIEWER, "Welcome to Vaulty", "Your demo workspace is ready.", true);
        insertActivity(OWNER, "Olivia Owner", "folder_created", "folder", ENGINEERING, "{\"name\":\"Engineering\"}");
        insertActivity(EDITOR, "Eddie Editor", "item_created", "item", ROADMAP_ITEM, "{\"title\":\"Frontend roadmap\"}");
        insertActivity(OWNER, "Olivia Owner", "group_created", "group", ENGINEERING_GROUP, "{\"name\":\"Engineering\"}");
    }

    private void seedPermissions() {
        PermissionCatalog.effectiveOwnerPermissions()
                .forEach(permission -> insertPermission(OWNER_ROLE, permission.resource(), permission.action()));
        insertPermission(MEMBER_ROLE, "collection", "read");
        insertPermission(MEMBER_ROLE, "item", "read");
        insertPermission(VIEWER_ROLE, "collection", "read");
        insertPermission(VIEWER_ROLE, "item", "read");
        insertPermission(EDITOR_ROLE, "collection", "read");
        insertPermission(EDITOR_ROLE, "collection", "create");
        insertPermission(EDITOR_ROLE, "collection", "update");
        insertPermission(EDITOR_ROLE, "item", "read");
        insertPermission(EDITOR_ROLE, "item", "create");
        insertPermission(EDITOR_ROLE, "item", "update");
        insertPermission(EDITOR_ROLE, "item", "delete");
        insertPermission(EDITOR_ROLE, "secret", "read");
        insertPermission(CONTRIBUTOR_ROLE, "collection", "read");
        insertPermission(CONTRIBUTOR_ROLE, "item", "read");
        insertPermission(CONTRIBUTOR_ROLE, "item", "create");
        insertPermission(CONTRIBUTOR_ROLE, "item", "update");
        insertPermission(AUDITOR_ROLE, "collection", "read");
        insertPermission(AUDITOR_ROLE, "item", "read");
        insertPermission(AUDITOR_ROLE, "activity", "read");
    }

    private void insertUser(UUID userId, String name, String email, String passwordHash) {
        jdbc.update(
                "INSERT INTO \"user\" (id, name, email, password_hash) VALUES (?, ?, ?, ?)",
                userId,
                name,
                email,
                passwordHash);
    }

    private void insertRole(UUID roleId, String name) {
        jdbc.update(
                "INSERT INTO workspace_role (id, workspace_id, name) VALUES (?, ?, ?)",
                roleId,
                WORKSPACE,
                name);
    }

    private void insertPermission(UUID roleId, String resource, String action) {
        jdbc.update(
                "INSERT INTO role_permission (role_id, resource, action) VALUES (?, ?, ?)",
                roleId,
                resource,
                action);
    }

    private void insertMember(UUID memberId, UUID userId, UUID roleId) {
        jdbc.update(
                "INSERT INTO workspace_member (id, user_id, workspace_id, role_id) VALUES (?, ?, ?, ?)",
                memberId,
                userId,
                WORKSPACE,
                roleId);
    }

    private void insertGroup(UUID groupId, String name) {
        jdbc.update("INSERT INTO access_group (id, workspace_id, name) VALUES (?, ?, ?)", groupId, WORKSPACE, name);
    }

    private void insertGroupMember(UUID groupId, UUID memberId) {
        jdbc.update(
                "INSERT INTO access_group_member (group_id, workspace_member_id, workspace_id) VALUES (?, ?, ?)",
                groupId,
                memberId,
                WORKSPACE);
    }

    private void insertCollection(UUID collectionId, UUID parentId, String name, boolean inheritAccess) {
        jdbc.update(
                "INSERT INTO collection (id, workspace_id, parent_id, name, inherit_access) VALUES (?, ?, ?, ?, ?)",
                collectionId,
                WORKSPACE,
                parentId,
                name,
                inheritAccess);
    }

    private void insertItem(UUID itemId, UUID collectionId, String title, String type, String text, String link) {
        jdbc.update(
                "INSERT INTO item (id, workspace_id, collection_id, title, type, text_content, link_url) VALUES (?, ?, ?, ?, ?, ?, ?)",
                itemId,
                WORKSPACE,
                collectionId,
                title,
                type,
                text,
                link);
    }

    private void insertNotification(UUID recipientId, String title, String content, boolean read) {
        jdbc.update(
                "INSERT INTO notification (id, recipient_id, title, content, metadata, read_at) VALUES (?, ?, ?, ?, '{}'::jsonb, CASE WHEN ? THEN now() ELSE NULL END)",
                UUID.randomUUID(),
                recipientId,
                title,
                content,
                read);
    }

    private void insertActivity(
            UUID actorId, String actorName, String action, String resourceType, UUID resourceId, String snapshot) {
        jdbc.update(
                "INSERT INTO activity_log (id, workspace_id, actor_id, actor_name, actor_context, action, resource_type, resource_id, snapshot) VALUES (?, ?, ?, ?, 'MEMBER', ?, ?, ?, ?::jsonb)",
                UUID.randomUUID(),
                WORKSPACE,
                actorId,
                actorName,
                action,
                resourceType,
                resourceId,
                snapshot);
    }

    private void requireLocalDevelopmentDatabase(String jdbcUrl) {
        URI database = URI.create(jdbcUrl.substring("jdbc:".length()));
        String host = database.getHost();
        String databaseName = database.getPath() == null ? "" : database.getPath().substring(1);
        if (!("localhost".equals(host) || "127.0.0.1".equals(host) || "::1".equals(host))
                || !"vaulty".equals(databaseName)) {
            throw new IllegalStateException(
                    "Development seed is restricted to the local 'vaulty' database; refusing " + host + "/" + databaseName);
        }
    }

    private static UUID id(String value) {
        return UUID.fromString(value);
    }
}
