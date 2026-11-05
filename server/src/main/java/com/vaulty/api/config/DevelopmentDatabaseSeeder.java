package com.vaulty.api.config;

import com.vaulty.api.service.ReceivedContentProjectionService;
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
    private static final UUID ADMIN = id("20000000-0000-4000-8000-000000000002");
    private static final UUID MAINTAINER = id("20000000-0000-4000-8000-000000000003");
    private static final UUID MARCELO = id("20000000-0000-4000-8000-000000000004");
    private static final UUID ANDREW = id("20000000-0000-4000-8000-000000000005");
    private static final UUID MATHEUS = id("20000000-0000-4000-8000-000000000006");
    private static final UUID RAFAEL = id("20000000-0000-4000-8000-000000000007");
    private static final UUID GIOVANI = id("20000000-0000-4000-8000-000000000008");
    private static final UUID UNASSIGNED = id("20000000-0000-4000-8000-000000000009");
    private static final UUID TEAM_MEMBER = id("20000000-0000-4000-8000-000000000010");
    private static final UUID INFRA_TEAM = id("50000000-0000-4000-8000-000000000006");

    private static final UUID OWNER_MEMBER = id("40000000-0000-4000-8000-000000000001");
    private static final UUID ADMIN_MEMBER = id("40000000-0000-4000-8000-000000000002");
    private static final UUID MAINTAINER_MEMBER = id("40000000-0000-4000-8000-000000000003");
    private static final UUID MARCELO_MEMBER = id("40000000-0000-4000-8000-000000000004");
    private static final UUID ANDREW_MEMBER = id("40000000-0000-4000-8000-000000000005");
    private static final UUID MATHEUS_MEMBER = id("40000000-0000-4000-8000-000000000006");
    private static final UUID RAFAEL_MEMBER = id("40000000-0000-4000-8000-000000000007");
    private static final UUID GIOVANI_MEMBER = id("40000000-0000-4000-8000-000000000008");
    private static final UUID UNASSIGNED_MEMBER = id("40000000-0000-4000-8000-000000000009");
    private static final UUID TEAM_MEMBER_MEMBER = id("40000000-0000-4000-8000-000000000010");

    private static final UUID FINANCE_TEAM = id("50000000-0000-4000-8000-000000000001");
    private static final UUID IOT_TEAM = id("50000000-0000-4000-8000-000000000002");
    private static final UUID OSMANGAS_TEAM = id("50000000-0000-4000-8000-000000000003");
    private static final UUID DROPTABLE_TEAM = id("50000000-0000-4000-8000-000000000004");
    private static final UUID ADMIN_TEAM = id("50000000-0000-4000-8000-000000000005");

    private static final UUID FINANCE = id("60000000-0000-4000-8000-000000000001");
    private static final UUID IOT = id("60000000-0000-4000-8000-000000000002");
    private static final UUID OSMANGAS = id("60000000-0000-4000-8000-000000000003");
    private static final UUID DROPTABLE = id("60000000-0000-4000-8000-000000000004");
    private static final UUID ADMIN_COLLECTION = id("60000000-0000-4000-8000-000000000005");
    private static final UUID FINANCE_OPERATIONS = id("60000000-0000-4000-8000-000000000006");
    private static final UUID UNASSIGNED_COLLECTION = id("60000000-0000-4000-8000-000000000007");
    private static final UUID INFRA_COLLECTION = id("60000000-0000-4000-8000-000000000008");

    private static final UUID FINANCE_TEXT = id("70000000-0000-4000-8000-000000000001");
    private static final UUID FINANCE_LINK = id("70000000-0000-4000-8000-000000000002");
    private static final UUID FINANCE_SECRET = id("70000000-0000-4000-8000-000000000003");
    private static final UUID IOT_PUBLICATION_ITEM = id("70000000-0000-4000-8000-000000000005");
    private static final UUID ADMIN_ITEM = id("70000000-0000-4000-8000-000000000006");
    private static final UUID UNASSIGNED_ITEM = id("70000000-0000-4000-8000-000000000007");

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final SecretCipher secretCipher;
    private final ReceivedContentProjectionService projectionService;
    private final TransactionTemplate transaction;
    private final Environment environment;

    public DevelopmentDatabaseSeeder(
            JdbcTemplate jdbc,
            PasswordEncoder passwordEncoder,
            SecretCipher secretCipher,
            ReceivedContentProjectionService projectionService,
            TransactionTemplate transaction,
            Environment environment) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
        this.secretCipher = secretCipher;
        this.projectionService = projectionService;
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
                    notification, activity_log, received_content_coverage, received_content_projection,
                    content_publication, collection_public_grant, item_member_grant,
                    collection_access_grant, access_group_member, item_media, item_file,
                    item_secret, item, workspace_team, collection, role_permission,
                    workspace_member, access_group, workspace_role, workspace, "user"
                RESTART IDENTITY CASCADE
                """);

        String passwordHash = passwordEncoder.encode(DEV_PASSWORD);
        insertUser(OWNER, "Olivia Owner", "owner@vaulty.local", passwordHash);
        insertUser(ADMIN, "Admin Vaulty", "admin@vaulty.local", passwordHash);
        insertUser(MAINTAINER, "Maintainer Vaulty", "maintainer@vaulty.local", passwordHash);
        insertUser(MARCELO, "Marcelo Serpa", "marcelo.serpa@vaulty.local", passwordHash);
        insertUser(ANDREW, "Andrew Senra", "andrew.senra@vaulty.local", passwordHash);
        insertUser(MATHEUS, "Matheus Silveira", "matheus.silveira@vaulty.local", passwordHash);
        insertUser(RAFAEL, "Rafael Augusto", "rafael.augusto@vaulty.local", passwordHash);
        insertUser(GIOVANI, "Giovani Martings", "giovani.martings@vaulty.local", passwordHash);
        insertUser(UNASSIGNED, "Membro sem time", "member@vaulty.local", passwordHash);
        insertUser(TEAM_MEMBER, "Membro Financeiro", "team.member@vaulty.local", passwordHash);

        jdbc.update("INSERT INTO workspace (id, owner_id, name, description, singleton) VALUES (?, ?, ?, ?, TRUE)",
                WORKSPACE, OWNER, "Vaulty Demo", "Workspace de demonstração com times e conteúdo compartilhado.");

        insertMember(OWNER_MEMBER, OWNER, null, null);
        insertMember(ADMIN_MEMBER, ADMIN, null, "ADMIN");
        insertMember(MAINTAINER_MEMBER, MAINTAINER, null, "MAINTAINER");
        insertMember(MARCELO_MEMBER, MARCELO, FINANCE_TEAM, null);
        insertMember(ANDREW_MEMBER, ANDREW, IOT_TEAM, null);
        insertMember(MATHEUS_MEMBER, MATHEUS, OSMANGAS_TEAM, null);
        insertMember(RAFAEL_MEMBER, RAFAEL, DROPTABLE_TEAM, null);
        insertMember(GIOVANI_MEMBER, GIOVANI, ADMIN_TEAM, null);
        insertMember(UNASSIGNED_MEMBER, UNASSIGNED, null, null);
        insertMember(TEAM_MEMBER_MEMBER, TEAM_MEMBER, FINANCE_TEAM, null);

        UUID andersonMember = insertTeamMember(
                "Anderson Rodrigues", "anderson.rodrigues@vaulty.local", ADMIN_TEAM, passwordHash);
        insertTeamMember("Felipe de Assunção", "felipe.assuncao@vaulty.local", ADMIN_TEAM, passwordHash);
        insertTeamMember("Emily Nataly", "emily.nataly@vaulty.local", ADMIN_TEAM, passwordHash);
        insertTeamMember("Rafael Serpa", "rafael.serpa@vaulty.local", ADMIN_TEAM, passwordHash);

        insertTeamMember("Felipe Rossetto", "felipe.rossetto@vaulty.local", DROPTABLE_TEAM, passwordHash);
        insertTeamMember("Gabriel Sumara", "gabriel.sumara@vaulty.local", DROPTABLE_TEAM, passwordHash);
        insertTeamMember("Leonardo Dalponte", "leonardo.dalponte@vaulty.local", DROPTABLE_TEAM, passwordHash);
        insertTeamMember("Rodrigo Martinhago", "rodrigo.martinhago@vaulty.local", DROPTABLE_TEAM, passwordHash);

        insertTeamMember("Leonardo Kulkamp", "leonardo.kulkamp@vaulty.local", OSMANGAS_TEAM, passwordHash);
        insertTeamMember("Carlos Fontana", "carlos.fontana@vaulty.local", OSMANGAS_TEAM, passwordHash);
        insertTeamMember("Isabelle Machado", "isabelle.machado@vaulty.local", OSMANGAS_TEAM, passwordHash);
        insertTeamMember("Mizael Cancelier", "mizael.cancelier@vaulty.local", OSMANGAS_TEAM, passwordHash);

        insertTeamMember("Cibele Batista", "cibele.batista@vaulty.local", FINANCE_TEAM, passwordHash);
        insertTeamMember("João Lucas Pantaleão", "joao.lucas.pantaleao@vaulty.local", IOT_TEAM, passwordHash);

        UUID ericMember = insertTeamMember(
                "Eric Ribeiro", "eric.ribeiro@vaulty.local", INFRA_TEAM, passwordHash);
        insertTeamMember("Denis Couto", "denis.couto@vaulty.local", INFRA_TEAM, passwordHash);
        insertTeamMember("Paloma Melo", "paloma.melo@vaulty.local", INFRA_TEAM, passwordHash);

        insertCollection(FINANCE, "Financeiro");
        insertCollection(IOT, "IOT");
        insertCollection(OSMANGAS, "OsMangas");
        insertCollection(DROPTABLE, "DropTable_OsMangas");
        insertCollection(ADMIN_COLLECTION, "Administração");
        insertCollection(UNASSIGNED_COLLECTION, "Coleção preservada");
        insertCollection(FINANCE_OPERATIONS, "Operações", FINANCE);
        insertCollection(INFRA_COLLECTION, "Infra");
        insertTeam(FINANCE_TEAM, "Financeiro", FINANCE, MARCELO_MEMBER);
        insertTeam(IOT_TEAM, "IOT", IOT, ANDREW_MEMBER);
        insertTeam(OSMANGAS_TEAM, "OsMangas", OSMANGAS, MATHEUS_MEMBER);
        insertTeam(DROPTABLE_TEAM, "DropTable_OsMangas", DROPTABLE, RAFAEL_MEMBER);
        insertTeam(ADMIN_TEAM, "Administração", ADMIN_COLLECTION, andersonMember);
        insertTeam(INFRA_TEAM, "Infra", INFRA_COLLECTION, ericMember);

        insertItem(FINANCE_TEXT, FINANCE_OPERATIONS, "Fechamento mensal", "text",
                "Enviar os relatórios até o último dia útil do mês.", null);
        insertItem(FINANCE_LINK, FINANCE, "Portal financeiro", "link", null, "https://example.com/financeiro");
        insertItem(FINANCE_SECRET, FINANCE, "Token de demonstração", "secret", null, null);
        jdbc.update("INSERT INTO item_secret (item_id, value) VALUES (?, ?)",
                FINANCE_SECRET, secretCipher.encrypt("demo-secret-123"));
        insertItem(IOT_PUBLICATION_ITEM, IOT, "Padrão de integração", "text",
                "Integrações devem registrar timeout e política de retry.", null);
        insertItem(ADMIN_ITEM, ADMIN_COLLECTION, "Manual administrativo", "text", "Conteúdo de demonstração.", null);
        insertItem(UNASSIGNED_ITEM, UNASSIGNED_COLLECTION, "Notas da coleção", "text",
                "Conteúdo preservado para demonstrar uma coleção sem time.", null);

        jdbc.update("""
                INSERT INTO content_publication (id, workspace_id, original_type, original_item_id,
                    source_collection_id, destination_collection_id, source_team_name, captured_path)
                VALUES (?, ?, 'ITEM', ?, ?, ?, ?, ?)
                """, id("80000000-0000-4000-8000-000000000001"), WORKSPACE,
                IOT_PUBLICATION_ITEM, IOT, OSMANGAS, "IOT", "");
        projectionService.refresh(WORKSPACE, OSMANGAS);

        insertActivity(OWNER, "Olivia Owner", "team_created", "team", FINANCE_TEAM, "{\"name\":\"Financeiro\"}");
        insertActivity(OWNER, "Olivia Owner", "item_created", "item", FINANCE_TEXT, "{\"title\":\"Fechamento mensal\"}");
    }

    private void insertUser(UUID userId, String name, String email, String passwordHash) {
        jdbc.update("INSERT INTO \"user\" (id, name, email, password_hash) VALUES (?, ?, ?, ?)", userId, name, email, passwordHash);
    }

    private void insertMember(UUID memberId, UUID userId, UUID teamId, String globalRole) {
        jdbc.update("INSERT INTO workspace_member (id, user_id, workspace_id, role_id, team_id, global_role) VALUES (?, ?, ?, NULL, ?, ?)",
                memberId, userId, WORKSPACE, teamId, globalRole);
    }

    private UUID insertTeamMember(String name, String email, UUID teamId, String passwordHash) {
        UUID userId = UUID.randomUUID();
        UUID memberId = UUID.randomUUID();
        insertUser(userId, name, email, passwordHash);
        insertMember(memberId, userId, teamId, null);
        return memberId;
    }

    private void insertCollection(UUID collectionId, String name) {
        insertCollection(collectionId, name, null);
    }

    private void insertCollection(UUID collectionId, String name, UUID parentId) {
        jdbc.update("INSERT INTO collection (id, workspace_id, parent_id, name, inherit_access) VALUES (?, ?, ?, ?, TRUE)",
                collectionId, WORKSPACE, parentId, name);
    }

    private void insertTeam(UUID teamId, String name, UUID rootCollectionId, UUID leaderMemberId) {
        jdbc.update("INSERT INTO workspace_team (id, workspace_id, name, root_collection_id, leader_member_id) VALUES (?, ?, ?, ?, ?)",
                teamId, WORKSPACE, name, rootCollectionId, leaderMemberId);
    }

    private void insertItem(UUID itemId, UUID collectionId, String title, String type, String text, String link) {
        jdbc.update("INSERT INTO item (id, workspace_id, collection_id, title, type, text_content, link_url) VALUES (?, ?, ?, ?, ?, ?, ?)",
                itemId, WORKSPACE, collectionId, title, type, text, link);
    }

    private void insertActivity(UUID actorId, String actorName, String action, String resourceType, UUID resourceId, String snapshot) {
        jdbc.update("""
                INSERT INTO activity_log (id, workspace_id, actor_id, actor_name, actor_context, action, resource_type, resource_id, snapshot)
                VALUES (?, ?, ?, ?, 'REGISTERED_USER', ?, ?, ?, ?::jsonb)
                """, UUID.randomUUID(), WORKSPACE, actorId, actorName, action, resourceType, resourceId, snapshot);
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
