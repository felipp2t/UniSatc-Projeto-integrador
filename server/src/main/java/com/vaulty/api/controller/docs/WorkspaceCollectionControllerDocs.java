package com.vaulty.api.controller.docs;

import com.vaulty.api.dto.collection.CollectionPathEntry;
import com.vaulty.api.dto.collection.CollectionPageResponse;
import com.vaulty.api.dto.collection.CollectionResponse;
import com.vaulty.api.dto.collection.CreateCollectionRequest;
import com.vaulty.api.dto.collection.RenameCollectionRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;

@Tag(name = "Collections")
public interface WorkspaceCollectionControllerDocs {

    @Operation(summary = "Cria uma pasta na raiz ou dentro de outra pasta")
    @ApiResponses({
        @ApiResponse(responseCode = "201"),
        @ApiResponse(responseCode = "400"),
        @ApiResponse(responseCode = "401"),
        @ApiResponse(responseCode = "404"),
        @ApiResponse(responseCode = "409")
    })
    ResponseEntity<CollectionResponse> create(
            @Parameter(hidden = true) UUID userId, UUID workspaceId, CreateCollectionRequest request);

    @Operation(summary = "Lista as pastas da raiz ou de uma pasta")
    @ApiResponses({@ApiResponse(responseCode = "200"), @ApiResponse(responseCode = "400"), @ApiResponse(responseCode = "404")})
    ResponseEntity<CollectionPageResponse> list(
            @Parameter(hidden = true) UUID userId, UUID workspaceId, UUID parentId, int page, int size);

    @Operation(summary = "Consulta o caminho de uma pasta desde a raiz")
    @ApiResponses({@ApiResponse(responseCode = "200"), @ApiResponse(responseCode = "404")})
    ResponseEntity<List<CollectionPathEntry>> path(
            @Parameter(hidden = true) UUID userId, UUID workspaceId, UUID collectionId);

    @Operation(summary = "Renomeia uma pasta")
    @ApiResponses({@ApiResponse(responseCode = "200"), @ApiResponse(responseCode = "400"),
        @ApiResponse(responseCode = "401"), @ApiResponse(responseCode = "404"),
        @ApiResponse(responseCode = "409")})
    ResponseEntity<CollectionResponse> rename(
            @Parameter(hidden = true) UUID userId, UUID workspaceId, UUID collectionId,
            RenameCollectionRequest request);

    @Operation(summary = "Exclui uma pasta vazia")
    @ApiResponses({@ApiResponse(responseCode = "204"), @ApiResponse(responseCode = "401"),
        @ApiResponse(responseCode = "404"), @ApiResponse(responseCode = "409")})
    ResponseEntity<Void> delete(@Parameter(hidden = true) UUID userId,
                                UUID workspaceId, UUID collectionId);
}
