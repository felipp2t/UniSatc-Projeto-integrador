import type { ZodType } from 'zod'
import { apiClient } from './client'
import { permissionsSchema, workspacePermissionsSchema } from './permissions'
import type {
  AccessGroupResponse,
  ActivityFilters,
  ActivityPageResponse,
  AttachmentResponse,
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
  NotificationPageResponse,
  RegisterRequest,
  RenameCollectionRequest,
  ResetPasswordRequest,
  SecretValueResponse,
  UpdateAttachmentMetadataRequest,
  UpdateItemRequest,
  UpdateProfileRequest,
  UpdateWorkspaceRequest,
  UserResponse,
  WorkspaceMemberDto,
  WorkspaceResponse,
} from './types'
import {
  workspaceMemberSchema,
  workspaceMembersSchema,
  workspaceRolesSchema,
} from './workspace-members'

function parseOrThrow<T>(schema: ZodType<T>, data: unknown, message: string) {
  const parsed = schema.safeParse(data)
  if (!parsed.success) throw new Error(message)
  return parsed.data
}

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
  activity: (workspaceId: string, filters: ActivityFilters) =>
    apiClient.get<ActivityPageResponse>(`/workspaces/${workspaceId}/activity`, {
      params: filters,
    }),
  changeMemberRole: async (
    workspaceId: string,
    memberId: string,
    roleId: string
  ) => {
    const response = await apiClient.put<unknown>(
      `/workspaces/${workspaceId}/members/${memberId}/role`,
      { roleId }
    )
    return {
      ...response,
      data: parseOrThrow(
        workspaceMemberSchema,
        response.data,
        'A resposta da API contém um membro inválido.'
      ),
    }
  },
  createRole: (workspaceId: string, name: string) =>
    apiClient.post<void>(`/workspaces/${workspaceId}/roles`, { name }),
  deleteRole: (workspaceId: string, roleId: string) =>
    apiClient.delete<void>(`/workspaces/${workspaceId}/roles/${roleId}`),
  get: (workspaceId: string) =>
    apiClient.get<WorkspaceResponse>(`/workspaces/${workspaceId}`),
  list: () => apiClient.get<WorkspaceResponse[]>('/workspaces'),
  listMembers: async (workspaceId: string) => {
    const response = await apiClient.get<WorkspaceMemberDto[]>(
      `/workspaces/${workspaceId}/members`
    )
    return {
      ...response,
      data: parseOrThrow(
        workspaceMembersSchema,
        response.data,
        'A resposta da API contém membros inválidos.'
      ),
    }
  },
  listRolePermissions: async (workspaceId: string, roleId: string) => {
    const response = await apiClient.get<unknown>(
      `/workspaces/${workspaceId}/roles/${roleId}/permissions`
    )
    return {
      ...response,
      data: parseOrThrow(
        permissionsSchema,
        response.data,
        'A resposta da API contém permissões inválidas.'
      ),
    }
  },
  listRoles: async (workspaceId: string) => {
    const response = await apiClient.get<unknown>(
      `/workspaces/${workspaceId}/roles`
    )
    return {
      ...response,
      data: parseOrThrow(
        workspaceRolesSchema,
        response.data,
        'A resposta da API contém cargos inválidos.'
      ),
    }
  },
  permissions: async (workspaceId: string) => {
    const response = await apiClient.get<unknown>(
      `/workspaces/${workspaceId}/me/permissions`
    )
    return {
      ...response,
      data: parseOrThrow(
        workspacePermissionsSchema,
        response.data,
        'A resposta da API contém permissões inválidas.'
      ),
    }
  },
  removeMember: (workspaceId: string, membershipId: string) =>
    apiClient.delete<void>(
      `/workspaces/${workspaceId}/members/${membershipId}`,
      { params: { confirmMemberId: membershipId } }
    ),
  update: (workspaceId: string, request: UpdateWorkspaceRequest) =>
    apiClient.put<WorkspaceResponse>(`/workspaces/${workspaceId}`, request),
}

export const inviteApi = {
  create: (request: InviteUserRequest) =>
    apiClient.post<void>('/invites', request),
  decline: (request: InviteValidationRequest) =>
    apiClient.post<void>('/invites/decline', request),
  list: () => apiClient.get<InviteResponse[]>('/invites'),
  revoke: (inviteId: string) =>
    apiClient.post<void>(`/invites/${inviteId}/revoke`),
  validate: (request: InviteValidationRequest) =>
    apiClient.post<InviteValidationResponse>('/invites/validate', request),
}

export const notificationsApi = {
  list: (page = 0, size = 10) =>
    apiClient.get<NotificationPageResponse>('/notifications', {
      params: { page, size },
    }),
  markAllRead: () => apiClient.patch<void>('/notifications/read'),
  markRead: (notificationId: string) =>
    apiClient.patch<void>(`/notifications/${notificationId}/read`),
}

export const accessGroupApi = {
  list: (workspaceId: string) =>
    apiClient.get<AccessGroupResponse[]>(`/workspaces/${workspaceId}/groups`),
}

export const sharingApi = {
  grantEveryone: (workspaceId: string, collectionId: string) =>
    apiClient.put<void>(
      `/workspaces/${workspaceId}/sharing/collections/${collectionId}/everyone`
    ),
  grantGroup: (workspaceId: string, collectionId: string, groupId: string) =>
    apiClient.put<void>(
      `/workspaces/${workspaceId}/sharing/collections/${collectionId}/groups/${groupId}`
    ),
  grantMember: (workspaceId: string, itemId: string, memberId: string) =>
    apiClient.put<void>(
      `/workspaces/${workspaceId}/sharing/items/${itemId}/members/${memberId}`
    ),
  origins: (workspaceId: string, type: 'collection' | 'item', id: string) =>
    apiClient.get<string[]>(
      `/workspaces/${workspaceId}/sharing/${type === 'collection' ? 'collections' : 'items'}/${id}/origins`
    ),
  revokeEveryone: (workspaceId: string, collectionId: string) =>
    apiClient.delete<void>(
      `/workspaces/${workspaceId}/sharing/collections/${collectionId}/everyone`
    ),
  setInheritance: (
    workspaceId: string,
    collectionId: string,
    enabled: boolean
  ) =>
    apiClient.put<void>(
      `/workspaces/${workspaceId}/sharing/collections/${collectionId}/inheritance`,
      undefined,
      { params: { enabled } }
    ),
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

export interface CreateAttachmentRequest {
  collectionId?: string
  description?: string
  file: File
  title: string
}

export interface UploadOptions {
  onUploadProgress: (progress: number) => void
  signal: AbortSignal
}

function uploadAttachment(
  method: 'post' | 'put',
  url: string,
  form: FormData,
  options?: Partial<UploadOptions>
) {
  return apiClient.request<AttachmentResponse>({
    data: form,
    method,
    onUploadProgress: ({ progress }) =>
      options?.onUploadProgress?.(Math.round((progress ?? 0) * 100)),
    signal: options?.signal,
    url,
  })
}

export const itemsApi = {
  archive: (workspaceId: string, itemId: string) =>
    apiClient.post<void>(`/workspaces/${workspaceId}/items/${itemId}/archive`),
  create: (workspaceId: string, request: CreateItemRequest) =>
    apiClient.post<ItemResponse>(`/workspaces/${workspaceId}/items`, request),
  createAttachment: (
    workspaceId: string,
    { collectionId, description, file, title }: CreateAttachmentRequest,
    options: UploadOptions
  ) => {
    const form = new FormData()
    form.set('title', title)
    form.set('file', file)
    if (description) form.set('description', description)
    if (collectionId) form.set('collectionId', collectionId)
    return uploadAttachment(
      'post',
      `/workspaces/${workspaceId}/items/attachments`,
      form,
      options
    )
  },
  downloadAttachment: (workspaceId: string, itemId: string) =>
    apiClient.get<Blob>(
      `/workspaces/${workspaceId}/items/${itemId}/attachment`,
      { responseType: 'blob' }
    ),
  get: (workspaceId: string, itemId: string) =>
    apiClient.get<ItemResponse>(`/workspaces/${workspaceId}/items/${itemId}`),
  list: (
    workspaceId: string,
    collectionId?: string,
    page = 0,
    size = 100,
    { archived }: { archived?: boolean } = {}
  ) =>
    apiClient.get<ItemPageResponse>(`/workspaces/${workspaceId}/items`, {
      params: { archived, collectionId, page, size },
    }),
  remove: (workspaceId: string, itemId: string) =>
    apiClient.delete<void>(`/workspaces/${workspaceId}/items/${itemId}`, {
      params: { confirm: true },
    }),
  replaceAttachment: (
    workspaceId: string,
    itemId: string,
    file: File,
    options?: Partial<UploadOptions>
  ) => {
    const form = new FormData()
    form.append('file', file)
    return uploadAttachment(
      'put',
      `/workspaces/${workspaceId}/items/${itemId}/attachment`,
      form,
      options
    )
  },
  restore: (workspaceId: string, itemId: string) =>
    apiClient.post<void>(`/workspaces/${workspaceId}/items/${itemId}/restore`),
  revealSecret: (workspaceId: string, itemId: string) =>
    apiClient.get<SecretValueResponse>(
      `/workspaces/${workspaceId}/items/${itemId}/secret`
    ),
  update: (workspaceId: string, itemId: string, request: UpdateItemRequest) =>
    apiClient.put<ItemResponse>(
      `/workspaces/${workspaceId}/items/${itemId}`,
      request
    ),
  updateMetadata: (
    workspaceId: string,
    itemId: string,
    request: UpdateAttachmentMetadataRequest
  ) =>
    apiClient.put<void>(
      `/workspaces/${workspaceId}/items/${itemId}/metadata`,
      request
    ),
}
