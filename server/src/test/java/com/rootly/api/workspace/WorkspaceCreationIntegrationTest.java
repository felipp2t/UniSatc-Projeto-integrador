package com.rootly.api.workspace;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.rootly.api.dto.workspace.CreateWorkspaceRequest;
import com.rootly.api.dto.workspace.UpdateWorkspaceRequest;
import com.rootly.api.dto.workspace.WorkspaceResponse;
import com.rootly.api.entity.User;
import com.rootly.api.entity.Workspace;
import com.rootly.api.entity.WorkspaceMember;
import com.rootly.api.entity.WorkspaceRole;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class WorkspaceCreationIntegrationTest extends WorkspaceIntegrationSupport {

    @Test
    void createsWorkspaceOwnerRoleAndOwnerMembership() throws Exception {
        User owner = createUser();

        mockMvc.perform(post("/workspaces")
                        .cookie(authCookie(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "  Meu Workspace  ",
                                  "description": "  Documentação da equipe  "
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isString())
                .andExpect(jsonPath("$.ownerId").value(owner.getId().toString()))
                .andExpect(jsonPath("$.name").value("Meu Workspace"))
                .andExpect(jsonPath("$.description").value("Documentação da equipe"))
                .andExpect(jsonPath("$.createdAt").isNotEmpty());

        Workspace workspace = workspaceRepository.findAll().get(0);
        WorkspaceRole role = workspaceRoleRepository.findAll().get(0);
        WorkspaceMember member = workspaceMemberRepository.findAll().get(0);

        assertThat(workspace.getName()).isEqualTo("Meu Workspace");
        assertThat(workspace.getDescription()).isEqualTo("Documentação da equipe");
        assertThat(workspace.getOwner().getId()).isEqualTo(owner.getId());
        assertThat(role.getName()).isEqualTo("Owner");
        assertThat(role.getWorkspace().getId()).isEqualTo(workspace.getId());
        assertThat(member.getUser().getId()).isEqualTo(owner.getId());
        assertThat(member.getWorkspace().getId()).isEqualTo(workspace.getId());
        assertThat(member.getRole().getId()).isEqualTo(role.getId());
    }

    @Test
    void convertsBlankDescriptionToNull() {
        User owner = createUser();

        workspaceService.create(owner.getId(), new CreateWorkspaceRequest("Workspace", "   "));

        assertThat(workspaceRepository.findAll().get(0).getDescription()).isNull();
    }

    @Test
    void listsOnlyWorkspacesWhereTheAuthenticatedUserIsAMember() throws Exception {
        User owner = createUser();
        User anotherOwner = createUser();
        createWorkspace(owner, "Workspace do proprietário");
        createWorkspace(anotherOwner, "Workspace de outro usuário");

        mockMvc.perform(get("/workspaces").cookie(authCookie(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Workspace do proprietário"))
                .andExpect(jsonPath("$[0].ownerId").value(owner.getId().toString()));
    }

    @Test
    void getsWorkspaceWhenTheAuthenticatedUserIsAMember() throws Exception {
        User owner = createUser();
        WorkspaceResponse createdWorkspace = createWorkspace(owner, "Workspace acessível");

        mockMvc.perform(get("/workspaces/{workspaceId}", createdWorkspace.id()).cookie(authCookie(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(createdWorkspace.id().toString()))
                .andExpect(jsonPath("$.name").value("Workspace acessível"));
    }

    @Test
    void doesNotExposeWorkspaceToUsersWhoAreNotMembers() throws Exception {
        User owner = createUser();
        User unrelatedUser = createUser();
        WorkspaceResponse createdWorkspace = createWorkspace(owner, "Workspace privado");

        mockMvc.perform(get("/workspaces/{workspaceId}", createdWorkspace.id()).cookie(authCookie(unrelatedUser)))
                .andExpect(status().isNotFound());
    }

    @Test
    void updatesOnlyEditableWorkspaceFields() {
        User owner = createUser();
        Workspace workspace = new Workspace();
        UUID workspaceId = UUID.randomUUID();
        workspace.setId(workspaceId);
        workspace.setOwner(owner);
        workspace.setName("Nome anterior");
        workspace.setDescription("Descrição anterior");

        workspaceMapper.update(new UpdateWorkspaceRequest("Nome atualizado", "Nova descrição"), workspace);

        assertThat(workspace.getId()).isEqualTo(workspaceId);
        assertThat(workspace.getOwner()).isEqualTo(owner);
        assertThat(workspace.getName()).isEqualTo("Nome atualizado");
        assertThat(workspace.getDescription()).isEqualTo("Nova descrição");
    }

    @Test
    void updatesWorkspaceWhenTheAuthenticatedUserIsTheOwner() throws Exception {
        User owner = createUser();
        WorkspaceResponse createdWorkspace = createWorkspace(owner, "Nome anterior");

        mockMvc.perform(put("/workspaces/{workspaceId}", createdWorkspace.id())
                        .cookie(authCookie(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "  Nome atualizado  ",
                                  "description": "  Nova descrição  "
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(createdWorkspace.id().toString()))
                .andExpect(jsonPath("$.name").value("Nome atualizado"))
                .andExpect(jsonPath("$.description").value("Nova descrição"));

        Workspace updatedWorkspace = workspaceRepository.findById(createdWorkspace.id()).orElseThrow();
        assertThat(updatedWorkspace.getName()).isEqualTo("Nome atualizado");
        assertThat(updatedWorkspace.getDescription()).isEqualTo("Nova descrição");
    }

    @Test
    void doesNotAllowMembersWhoAreNotOwnersToUpdateWorkspace() throws Exception {
        User owner = createUser();
        User member = createUser();
        WorkspaceResponse createdWorkspace = createWorkspace(owner, "Workspace privado");
        addMember(member, createdWorkspace.id());

        mockMvc.perform(put("/workspaces/{workspaceId}", createdWorkspace.id())
                        .cookie(authCookie(member))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "name": "Tentativa de alteração" }
                                """))
                .andExpect(status().isNotFound());

        Workspace unchangedWorkspace = workspaceRepository.findById(createdWorkspace.id()).orElseThrow();
        assertThat(unchangedWorkspace.getName()).isEqualTo("Workspace privado");
    }

    @Test
    void rejectsInvalidNameWithoutPersistingAnything() throws Exception {
        User owner = createUser();

        mockMvc.perform(post("/workspaces")
                        .cookie(authCookie(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "name": "  a  " }
                                """))
                .andExpect(status().isBadRequest());

        assertWorkspaceTablesAreEmpty();
    }

    @Test
    void rejectsUnauthenticatedCreation() throws Exception {
        mockMvc.perform(post("/workspaces")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "name": "Workspace" }
                                """))
                .andExpect(status().isUnauthorized());

        assertWorkspaceTablesAreEmpty();
    }

    @Test
    void participatesInTheCallerTransactionSoTheAggregateRollsBackTogether() {
        User owner = createUser();

        transactionTemplate.executeWithoutResult(status -> {
            workspaceService.create(owner.getId(), new CreateWorkspaceRequest("Workspace", null));
            status.setRollbackOnly();
        });

        assertWorkspaceTablesAreEmpty();
    }
}
