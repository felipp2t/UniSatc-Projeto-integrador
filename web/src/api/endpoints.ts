import { apiClient } from './client'
import type {
  ChangePasswordRequest,
  CollectionPageResponse,
  CollectionPathEntry,
  CollectionResponse,
  CreateCollectionRequest,
  CreateItemRequest,
  ForgotPasswordRequest,
  InviteResponse,
  InviteUserRequest,
  InviteValidationRequest,
  InviteValidationResponse,
  ItemPageResponse,
  ItemResponse,
  LoginRequest,
  RegisterRequest,
  RenameCollectionRequest,
  ResetPasswordRequest,
  UpdateProfileRequest,
  UpdateWorkspaceRequest,
  UserResponse,
  WorkspaceMemberDto,
  WorkspaceResponse,
} from './types'
import { workspaceMembersSchema } from './workspace-members'

export const authApi = {
  forgotPassword: (request: ForgotPasswordRequest) =>
    apiClient.post<void>('/auth/forgot-password', request),
  login: (request: LoginRequest) =>
    apiClient.post<void>('/auth/login', request),
  logout: () => apiClient.post<void>('/auth/logout'),
  refresh: () => apiClient.post<void>('/auth/refresh'),
  register: (request: RegisterRequest) =>
    apiClient.post<void>('/auth/register', request),
  resetPassword: (request: ResetPasswordRequest) =>
    apiClient.post<void>('/auth/reset-password', request),
}

export const userApi = {
  changePassword: (request: ChangePasswordRequest) =>
    apiClient.patch<void>('/me/password', request),
  getMe: () => apiClient.get<UserResponse>('/me'),
  updateProfile: (request: UpdateProfileRequest) =>
    apiClient.patch<void>('/me', request),
}

export const workspaceApi = {
  get: (workspaceId: string) =>
    apiClient.get<WorkspaceResponse>(`/workspaces/${workspaceId}`),
  list: () => apiClient.get<WorkspaceResponse[]>('/workspaces'),
  listMembers: async (workspaceId: string) => {
    const response = await apiClient.get<WorkspaceMemberDto[]>(
      `/workspaces/${workspaceId}/members`
    )
    const parsed = workspaceMembersSchema.safeParse(response.data)
    if (!parsed.success) {
      throw new Error('A resposta da API contém membros inválidos.')
    }
    return { ...response, data: parsed.data }
  },
  update: (workspaceId: string, request: UpdateWorkspaceRequest) =>
    apiClient.put<WorkspaceResponse>(`/workspaces/${workspaceId}`, request),
}

export const inviteApi = {
  create: (request: InviteUserRequest) =>
    apiClient.post<void>('/invites', request),
  list: () => apiClient.get<InviteResponse[]>('/invites'),
  revoke: (inviteId: string) =>
    apiClient.post<void>(`/invites/${inviteId}/revoke`),
  validate: (request: InviteValidationRequest) =>
    apiClient.post<InviteValidationResponse>('/invites/validate', request),
}

export const collectionsApi = {
  create: (workspaceId: string, request: CreateCollectionRequest) =>
    apiClient.post<CollectionResponse>(
      `/workspaces/${workspaceId}/collections`,
      request
    ),
  list: (workspaceId: string, parentId?: string, page = 0, size = 100) =>
    apiClient.get<CollectionPageResponse>(
      `/workspaces/${workspaceId}/collections`,
      { params: { page, parentId, size } }
    ),
  path: (workspaceId: string, collectionId: string) =>
    apiClient.get<CollectionPathEntry[]>(
      `/workspaces/${workspaceId}/collections/${collectionId}/path`
    ),
  remove: (workspaceId: string, collectionId: string) =>
    apiClient.delete<void>(
      `/workspaces/${workspaceId}/collections/${collectionId}`
    ),
  rename: (
    workspaceId: string,
    collectionId: string,
    request: RenameCollectionRequest
  ) =>
    apiClient.put<CollectionResponse>(
      `/workspaces/${workspaceId}/collections/${collectionId}`,
      request
    ),
}

export const itemsApi = {
  create: (workspaceId: string, request: CreateItemRequest) =>
    apiClient.post<ItemResponse>(`/workspaces/${workspaceId}/items`, request),
  list: (workspaceId: string, collectionId?: string, page = 0, size = 100) =>
    apiClient.get<ItemPageResponse>(`/workspaces/${workspaceId}/items`, {
      params: { collectionId, page, size },
    }),
}
