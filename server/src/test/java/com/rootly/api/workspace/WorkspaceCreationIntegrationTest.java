package com.rootly.api.workspace;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.rootly.api.dto.workspace.UpdateWorkspaceRequest;
import com.rootly.api.dto.workspace.WorkspaceResponse;
import com.rootly.api.entity.User;
import com.rootly.api.entity.Workspace;
import jakarta.persistence.PersistenceException;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;

class WorkspaceCreationIntegrationTest extends WorkspaceIntegrationSupport {

    @Test
    void rejectsASecondWorkspaceAtTheDatabaseLevel() {
        User owner = createUser();
        createWorkspace(owner);

        Workspace second = new Workspace();
        second.setOwner(owner);
        second.setName("Segundo workspace");

        assertThatThrownBy(() -> workspaceRepository.saveAndFlush(second))
                .isInstanceOfAny(DataIntegrityViolationException.class, PersistenceException.class);
    }

    @Test
    void rejectsSingletonFalseEvenAsTheOnlyRow() {
        User owner = createUser();

        assertThatThrownBy(() -> jdbcTemplate.update(
                        """
                        INSERT INTO workspace (id, owner_id, name, singleton)
                        VALUES (gen_random_uuid(), ?, 'Workspace', false)
                        """,
                        owner.getId()))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void doesNotOfferWorkspaceCreationThroughTheApi() throws Exception {
        User owner = createUser();

        mockMvc.perform(post("/workspaces")
                        .cookie(authCookie(owner))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "name": "Workspace" }
                                """))
                .andExpect(status().isMethodNotAllowed());
    }

    @Test
    void listsOnlyWorkspacesWhereTheAuthenticatedUserIsAMember() throws Exception {
        User owner = createUser();
        createWorkspace(owner, "Workspace do proprietário");

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
        workspace.setOwner(owner);
        workspace.setName("Nome anterior");
        workspace.setDescription("Descrição anterior");

        workspaceMapper.update(new UpdateWorkspaceRequest("Nome atualizado", "Nova descrição"), workspace);

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
}
