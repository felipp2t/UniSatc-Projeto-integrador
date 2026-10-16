import { apiClient } from './client'
import type {
  ChangePasswordRequest,
  CollectionPageResponse,
  CollectionPathEntry,
  CreateItemRequest,
  CreateWorkspaceRequest,
  ForgotPasswordRequest,
  InviteUserRequest,
  ItemPageResponse,
  ItemResponse,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  UpdateProfileRequest,
  UpdateWorkspaceRequest,
  UserResponse,
  WorkspaceMemberResponse,
  WorkspaceResponse,
} from './types'

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
  create: (request: CreateWorkspaceRequest) =>
    apiClient.post<WorkspaceResponse>('/workspaces', request),
  get: (workspaceId: string) =>
    apiClient.get<WorkspaceResponse>(`/workspaces/${workspaceId}`),
  list: () => apiClient.get<WorkspaceResponse[]>('/workspaces'),
  listMembers: (workspaceId: string) =>
    apiClient.get<WorkspaceMemberResponse[]>(
      `/workspaces/${workspaceId}/members`
    ),
  update: (workspaceId: string, request: UpdateWorkspaceRequest) =>
    apiClient.put<WorkspaceResponse>(`/workspaces/${workspaceId}`, request),
}

export const inviteApi = {
  create: (request: InviteUserRequest) =>
    apiClient.post<void>('/invites', request),
}

export const collectionsApi = {
  list: (workspaceId: string, parentId?: string, page = 0, size = 100) =>
    apiClient.get<CollectionPageResponse>(
      `/workspaces/${workspaceId}/collections`,
      { params: { page, parentId, size } }
    ),
  path: (workspaceId: string, collectionId: string) =>
    apiClient.get<CollectionPathEntry[]>(
      `/workspaces/${workspaceId}/collections/${collectionId}/path`
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
