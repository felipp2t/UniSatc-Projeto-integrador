import { type ZodType, z } from 'zod'
import { apiClient } from './client'
import {
  workspacePermissionsSchema,
  workspaceRoleDefinitionsSchema,
} from './permissions'
import type {
  ActivityFilters,
  ActivityPageResponse,
  AttachmentResponse,
  ChangePasswordRequest,
  CollectionPageResponse,
  CollectionPathEntry,
  CollectionResponse,
  CreateCollectionRequest,
  CreateItemRequest,
  CreatePublicationRequest,
  ForgotPasswordRequest,
  InviteResponse,
  InviteUserRequest,
  InviteValidationRequest,
  InviteValidationResponse,
  ItemPageResponse,
  ItemResponse,
  ItemSearchParams,
  LoginRequest,
  NotificationPageResponse,
  PublicationConfiguration,
  PublicationResponse,
  ReceivedContentPage,
  ReceivedItemPath,
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
import { workspaceMembersSchema } from './workspace-members'

const teamSchema = z.object({
  id: z.string().uuid(),
  leaderMemberId: z.string().uuid(),
  leaderName: z.string(),
  memberCount: z.number(),
  name: z.string(),
  rootCollectionId: z.string().uuid(),
  rootCollectionName: z.string(),
})
const teamMemberSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  roleName: z.string(),
  userId: z.string().uuid(),
})
const publicationSchema = z.object({
  capturedPath: z.string(),
  createdAt: z.string(),
  destinationCollectionId: z.string().uuid(),
  id: z.string().uuid(),
  originalId: z.string().uuid(),
  originalType: z.enum(['COLLECTION', 'ITEM']),
  sourceCollectionId: z.string().uuid(),
  sourceTeamName: z.string(),
})
const publicationConfigurationSchema = z.object({
  destinationTeams: z.array(
    z.object({
      collectionId: z.string().uuid(),
      id: z.string().uuid(),
      name: z.string(),
    })
  ),
  publications: z.array(publicationSchema),
  sourceCollectionId: z.string().uuid(),
})
const receivedItemSchema = z.object({
  id: z.string().uuid(),
  path: z.string(),
  readOnly: z.boolean(),
  received: z.boolean(),
  sourceTeamName: z.string(),
  title: z.string(),
  type: z.enum(['folder', 'file', 'image', 'link', 'secret', 'text']),
})
const receivedPageSchema = z.object({
  items: z.array(receivedItemSchema),
  page: z.number(),
  size: z.number(),
  totalItems: z.number(),
  totalPages: z.number(),
})

function parseResponse<T>(
  response: { data: unknown },
  schema: ZodType<T>,
  message: string
) {
  return { ...response, data: parseOrThrow(schema, response.data, message) }
}

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
  backup: () =>
    apiClient.post<Blob>('/workspaces/backup', undefined, {
      responseType: 'blob',
    }),
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
  listRoles: async (workspaceId: string) => {
    const response = await apiClient.get<unknown>(
      `/workspaces/${workspaceId}/roles`
    )
    return {
      ...response,
      data: parseOrThrow(
        workspaceRoleDefinitionsSchema,
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
  transferOwnership: (workspaceId: string, memberId: string) =>
    apiClient.put<unknown>(
      `/workspaces/${workspaceId}/members/transfer-owner`,
      { memberId }
    ),
  update: (workspaceId: string, request: UpdateWorkspaceRequest) =>
    apiClient.put<WorkspaceResponse>(`/workspaces/${workspaceId}`, request),
}

export const workspaceTeamsApi = {
  addMember: (workspaceId: string, teamId: string, workspaceMemberId: string) =>
    apiClient.post<void>(`/workspaces/${workspaceId}/teams/${teamId}/members`, {
      workspaceMemberId,
    }),
  create: async (
    workspaceId: string,
    request: { name: string; leaderMemberId: string; rootCollectionId?: string }
  ) => {
    const response = await apiClient.post<unknown>(
      `/workspaces/${workspaceId}/teams`,
      request
    )
    return parseResponse(
      response,
      teamSchema,
      'A resposta da API contém um time inválido.'
    )
  },
  delete: (workspaceId: string, teamId: string) =>
    apiClient.delete<void>(`/workspaces/${workspaceId}/teams/${teamId}`),
  list: async (workspaceId: string) => {
    const response = await apiClient.get<unknown>(
      `/workspaces/${workspaceId}/teams`
    )
    return parseResponse(
      response,
      z.array(teamSchema),
      'A resposta da API contém times inválidos.'
    )
  },
  listMembers: async (workspaceId: string, teamId: string) => {
    const response = await apiClient.get<unknown>(
      `/workspaces/${workspaceId}/teams/${teamId}/members`
    )
    return parseResponse(
      response,
      z.array(teamMemberSchema),
      'A resposta da API contém membros inválidos.'
    )
  },
  removeMember: (workspaceId: string, teamId: string, memberId: string) =>
    apiClient.delete<void>(
      `/workspaces/${workspaceId}/teams/${teamId}/members/${memberId}`
    ),
  rename: async (workspaceId: string, teamId: string, name: string) => {
    const response = await apiClient.put<unknown>(
      `/workspaces/${workspaceId}/teams/${teamId}`,
      { name }
    )
    return parseResponse(
      response,
      teamSchema,
      'A resposta da API contém um time inválido.'
    )
  },
  transferLeader: (
    workspaceId: string,
    teamId: string,
    workspaceMemberId: string
  ) =>
    apiClient.put<void>(`/workspaces/${workspaceId}/teams/${teamId}/leader`, {
      workspaceMemberId,
    }),
}

export const publicationApi = {
  configuration: async (workspaceId: string, sourceCollectionId: string) => {
    const response = await apiClient.get<unknown>(
      `/workspaces/${workspaceId}/sharing/publications/configuration`,
      { params: { sourceCollectionId } }
    )
    return parseResponse<PublicationConfiguration>(
      response,
      publicationConfigurationSchema,
      'Configuração de publicação inválida.'
    )
  },
  publish: async (workspaceId: string, request: CreatePublicationRequest) => {
    const response = await apiClient.post<unknown>(
      `/workspaces/${workspaceId}/sharing/publications`,
      request
    )
    return parseResponse<PublicationResponse>(
      response,
      publicationSchema,
      'Publicação inválida.'
    )
  },
  revoke: (workspaceId: string, publicationId: string) =>
    apiClient.delete<void>(
      `/workspaces/${workspaceId}/sharing/publications/${publicationId}`
    ),
}

export const receivedContentApi = {
  attachment: (workspaceId: string, virtualId: string, download = false) =>
    apiClient.get<Blob>(
      `/workspaces/${workspaceId}/received/${virtualId}/attachment`,
      { params: { download }, responseType: 'blob' }
    ),
  list: async (
    workspaceId: string,
    params: { contentOnly?: boolean; page?: number; q?: string; size?: number },
    signal?: AbortSignal
  ) => {
    const response = await apiClient.get<unknown>(
      `/workspaces/${workspaceId}/received`,
      { params, signal }
    )
    return parseResponse<ReceivedContentPage>(
      response,
      receivedPageSchema,
      'Conteúdo recebido inválido.'
    )
  },
  path: async (workspaceId: string, virtualId: string) => {
    const response = await apiClient.get<unknown>(
      `/workspaces/${workspaceId}/received/${virtualId}/path`
    )
    return parseResponse<ReceivedItemPath>(
      response,
      receivedItemSchema,
      'Caminho recebido inválido.'
    )
  },
  read: async (workspaceId: string, virtualId: string) => {
    const response = await apiClient.get<unknown>(
      `/workspaces/${workspaceId}/received/${virtualId}`
    )
    return parseResponse(
      response,
      z.object({
        archivedAt: z.string().nullable(),
        collectionId: z.string().uuid().nullable(),
        description: z.string().nullable(),
        id: z.string().uuid(),
        linkUrl: z.string().nullable(),
        preview: z.string().nullable(),
        textContent: z.string().nullable(),
        title: z.string(),
        type: z.enum(['file', 'image', 'link', 'secret', 'text']),
      }),
      'Conteúdo recebido inválido.'
    )
  },
  secret: (workspaceId: string, virtualId: string) =>
    apiClient.get<SecretValueResponse>(
      `/workspaces/${workspaceId}/received/${virtualId}/secret`
    ),
}

export const globalRoleApi = {
  assign: (
    workspaceId: string,
    memberId: string,
    globalRole: 'ADMIN' | 'MAINTAINER' | null
  ) =>
    apiClient.put<unknown>(
      `/workspaces/${workspaceId}/members/${memberId}/role`,
      { globalRole }
    ),
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
  list: (page = 0, size = 10, signal?: AbortSignal) =>
    apiClient.get<NotificationPageResponse>('/notifications', {
      params: { page, size },
      signal,
    }),
  markAllRead: () => apiClient.patch<void>('/notifications/read'),
  markRead: (notificationId: string) =>
    apiClient.patch<void>(`/notifications/${notificationId}/read`),
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
  search: (
    workspaceId: string,
    params: ItemSearchParams,
    signal?: AbortSignal
  ) =>
    apiClient.get<ItemPageResponse>(`/workspaces/${workspaceId}/items/search`, {
      params,
      signal,
    }),
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
