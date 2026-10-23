package com.vaulty.api.controller.docs;

import com.vaulty.api.dto.item.CreateItemRequest;
import com.vaulty.api.dto.item.CreateDocumentRequest;
import com.vaulty.api.dto.item.ItemPageResponse;
import com.vaulty.api.dto.item.ItemResponse;
import com.vaulty.api.dto.item.SecretValueResponse;
import com.vaulty.api.dto.item.UpdateItemRequest;
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

    @Operation(summary = "Cria um item de texto, link ou segredo")
    @ApiResponses({@ApiResponse(responseCode = "201"), @ApiResponse(responseCode = "400"),
        @ApiResponse(responseCode = "401"), @ApiResponse(responseCode = "404"),
        @ApiResponse(responseCode = "409")})
    ResponseEntity<ItemResponse> create(@Parameter(hidden = true) UUID userId,
                                        UUID workspaceId, CreateItemRequest request);

    @Operation(summary = "Cria documento com um arquivo PDF, texto, Office ou imagem")
    ResponseEntity<ItemResponse> createDocument(@Parameter(hidden = true) UUID userId,
                                                 UUID workspaceId, CreateDocumentRequest metadata,
                                                 MultipartFile file);

    @Operation(summary = "Lista os itens ativos da raiz ou de uma pasta")
    @ApiResponses({@ApiResponse(responseCode = "200"), @ApiResponse(responseCode = "400"),
        @ApiResponse(responseCode = "401"), @ApiResponse(responseCode = "404")})
    ResponseEntity<ItemPageResponse> list(@Parameter(hidden = true) UUID userId,
                                          UUID workspaceId, UUID collectionId, boolean includeArchived, int page, int size);

    @Operation(summary = "Busca itens ativos por todas as palavras do título, ignorando caixa e acentos")
    @ApiResponses({@ApiResponse(responseCode = "200"), @ApiResponse(responseCode = "400"),
        @ApiResponse(responseCode = "401"), @ApiResponse(responseCode = "404")})
    ResponseEntity<ItemPageResponse> search(@Parameter(hidden = true) UUID userId,
                                            UUID workspaceId, String q, boolean includeArchived, int page, int size);

    @Operation(summary = "Consulta um item de texto, link ou metadados de segredo")
    @ApiResponses({@ApiResponse(responseCode = "200"), @ApiResponse(responseCode = "401"),
        @ApiResponse(responseCode = "404")})
    ResponseEntity<ItemResponse> get(@Parameter(hidden = true) UUID userId,
                                     UUID workspaceId, UUID itemId);

    @Operation(summary = "Revela o valor de um segredo autorizado")
    @ApiResponses({@ApiResponse(responseCode = "200"), @ApiResponse(responseCode = "401"),
        @ApiResponse(responseCode = "404")})
    ResponseEntity<SecretValueResponse> reveal(@Parameter(hidden = true) UUID userId,
                                               UUID workspaceId, UUID itemId);

    @Operation(summary = "Edita título, descrição e conteúdo de item ativo")
    ResponseEntity<ItemResponse> update(@Parameter(hidden = true) UUID userId,
                                        UUID workspaceId, UUID itemId, UpdateItemRequest request);

    @Operation(summary = "Arquiva um item ativo")
    ResponseEntity<ItemResponse> archive(@Parameter(hidden = true) UUID userId, UUID workspaceId, UUID itemId);

    @Operation(summary = "Restaura um item arquivado")
    ResponseEntity<ItemResponse> restore(@Parameter(hidden = true) UUID userId, UUID workspaceId, UUID itemId);

    @Operation(summary = "Exclui definitivamente um item arquivado após confirmação")
    ResponseEntity<Void> delete(@Parameter(hidden = true) UUID userId, UUID workspaceId, UUID itemId, boolean confirm);

    @Operation(summary = "Substitui o anexo de um documento ativo")
    ResponseEntity<ItemResponse> replaceAttachment(@Parameter(hidden = true) UUID userId,
                                                    UUID workspaceId, UUID itemId, MultipartFile file);

    @Operation(summary = "Baixa ou visualiza o anexo de um documento")
    ResponseEntity<byte[]> downloadAttachment(@Parameter(hidden = true) UUID userId,
                                              UUID workspaceId, UUID itemId, boolean download);
}
