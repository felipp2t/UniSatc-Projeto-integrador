package com.rootly.api.mapper;

import com.rootly.api.dto.workspace.CreateWorkspaceRequest;
import com.rootly.api.entity.Workspace;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface WorkspaceMapper {

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "owner", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    Workspace toEntity(CreateWorkspaceRequest request);
}
