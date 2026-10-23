package com.vaulty.api.controller.docs;

import com.vaulty.api.dto.item.AttachmentResponse;
import com.vaulty.api.dto.item.CreateItemRequest;
import com.vaulty.api.dto.item.ItemPageResponse;
import com.vaulty.api.dto.item.ItemResponse;
import com.vaulty.api.dto.item.SecretValueResponse;
import com.vaulty.api.dto.item.UpdateItemMetadataRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "Items")
public interface WorkspaceItemControllerDocs {

    @Operation(summary = "Cria um item de arquivo com um anexo")
    @ApiResponses({@ApiResponse(responseCode = "201"), @ApiResponse(responseCode = "400"),
        @ApiResponse(responseCode = "403"), @ApiResponse(responseCode = "404"),
        @ApiResponse(responseCode = "409")})
    ResponseEntity<AttachmentResponse> createAttachment(@Parameter(hidden = true) UUID userId,
                                                         UUID workspaceId, String title, String description,
                                                         UUID collectionId, MultipartFile file);

    @Operation(summary = "Substitui o arquivo anexado a um item")
    @ApiResponses({@ApiResponse(responseCode = "200"), @ApiResponse(responseCode = "400"),
        @ApiResponse(responseCode = "403"), @ApiResponse(responseCode = "404")})
    ResponseEntity<AttachmentResponse> replaceAttachment(@Parameter(hidden = true) UUID userId,
                                                         UUID workspaceId, UUID itemId, MultipartFile file);

    @Operation(summary = "Atualiza o título, a descrição e a pasta de um item com anexo")
    @ApiResponses({@ApiResponse(responseCode = "204"), @ApiResponse(responseCode = "400"),
        @ApiResponse(responseCode = "403"), @ApiResponse(responseCode = "404"),
        @ApiResponse(responseCode = "409")})
    ResponseEntity<Void> updateAttachmentMetadata(@Parameter(hidden = true) UUID userId,
                                                  UUID workspaceId, UUID itemId,
                                                  UpdateItemMetadataRequest request);

    @Operation(summary = "Baixa ou visualiza um anexo autorizado")
    @ApiResponses({@ApiResponse(responseCode = "200"), @ApiResponse(responseCode = "403"),
        @ApiResponse(responseCode = "404")})
    ResponseEntity<byte[]> downloadAttachment(@Parameter(hidden = true) UUID userId,
                                              UUID workspaceId, UUID itemId, boolean download);

    @Operation(summary = "Cria um item de texto, link ou segredo")
    @ApiResponses({@ApiResponse(responseCode = "201"), @ApiResponse(responseCode = "400"),
        @ApiResponse(responseCode = "403"), @ApiResponse(responseCode = "404"),
        @ApiResponse(responseCode = "409")})
    ResponseEntity<ItemResponse> create(@Parameter(hidden = true) UUID userId,
                                        UUID workspaceId, CreateItemRequest request);

    @Operation(summary = "Lista os itens ativos da raiz ou de uma pasta")
    @ApiResponses({@ApiResponse(responseCode = "200"), @ApiResponse(responseCode = "400"),
        @ApiResponse(responseCode = "403"), @ApiResponse(responseCode = "404")})
    ResponseEntity<ItemPageResponse> list(@Parameter(hidden = true) UUID userId,
                                          UUID workspaceId, UUID collectionId, int page, int size);

    @Operation(summary = "Busca itens ativos por todas as palavras do título, ignorando caixa e acentos")
    @ApiResponses({@ApiResponse(responseCode = "200"), @ApiResponse(responseCode = "400"),
        @ApiResponse(responseCode = "403"), @ApiResponse(responseCode = "404")})
    ResponseEntity<ItemPageResponse> search(@Parameter(hidden = true) UUID userId,
                                            UUID workspaceId, String q, int page, int size);

    @Operation(summary = "Consulta um item de texto, link ou metadados de segredo")
    @ApiResponses({@ApiResponse(responseCode = "200"), @ApiResponse(responseCode = "403"),
        @ApiResponse(responseCode = "404")})
    ResponseEntity<ItemResponse> get(@Parameter(hidden = true) UUID userId,
                                     UUID workspaceId, UUID itemId);

    @Operation(summary = "Revela o valor de um segredo autorizado")
    @ApiResponses({@ApiResponse(responseCode = "200"), @ApiResponse(responseCode = "403"),
        @ApiResponse(responseCode = "404")})
    ResponseEntity<SecretValueResponse> reveal(@Parameter(hidden = true) UUID userId,
                                               UUID workspaceId, UUID itemId);
}
