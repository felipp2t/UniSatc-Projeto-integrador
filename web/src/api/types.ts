import type { components } from './generated/schema'

export type ChangePasswordRequest =
  components['schemas']['ChangePasswordRequest']
export type CreateItemType = 'text' | 'link' | 'secret'
export type CreateItemRequest =
  | {
      type: 'text'
      title: string
      collectionId?: string
      textContent: string
    }
  | {
      type: 'link'
      title: string
      collectionId?: string
      linkUrl: string
    }
  | {
      type: 'secret'
      title: string
      collectionId?: string
      value: string
    }
export interface ItemResponse {
  archivedAt: string | null
  collectionId: string | null
  description: string | null
  id: string
  linkUrl: string | null
  preview: string | null
  textContent: string | null
  title: string
  type: ItemType
}
export interface CollectionResponse {
  id: string
  name: string
  parentId: string | null
}
export type CreateCollectionRequest =
  components['schemas']['CreateCollectionRequest']
export type RenameCollectionRequest =
  components['schemas']['RenameCollectionRequest']
export interface CollectionPageResponse {
  items: CollectionResponse[]
  page: number
  size: number
  totalItems: number
  totalPages: number
}
export type ItemType = 'file' | 'image' | 'link' | 'secret' | 'text'
export type UpdateItemRequest =
  | { textContent: string; title: string }
  | { linkUrl: string; title: string }
  | { title: string; value: string }
export interface UpdateAttachmentMetadataRequest {
  description?: string | null
  title: string
}
// Manual: o OpenAPI gerado marca todos os campos como opcionais e width/height
// como number; a API devolve null para anexos que não são imagem.
export interface AttachmentResponse {
  fileName: string
  format: string
  height: number | null
  itemId: string
  mimeType: string
  size: number
  width: number | null
}
export interface SecretValueResponse {
  value: string
}
export interface ItemPageResponse {
  items: ItemResponse[]
  page: number
  size: number
  totalItems: number
  totalPages: number
}
export interface CollectionPathEntry {
  id: string
  name: string
}
export type ActivityAction =
  | 'folder_created'
  | 'folder_renamed'
  | 'folder_deleted'
  | 'item_created'
  | 'item_updated'
  | 'item_archived'
  | 'item_restored'
  | 'item_deleted'
  | 'member_invited'
  | 'member_joined'
  | 'member_role_changed'
  | 'member_removed'
  | 'member_invite_revoked'
  | 'member_invite_declined'
  | 'workspace_renamed'
  | 'role_created'
  | 'role_deleted'
  | 'role_permissions_changed'
  | 'group_created'
  | 'group_renamed'
  | 'group_deleted'
  | 'group_member_added'
  | 'group_member_removed'
export type ActivityResourceType =
  | 'folder'
  | 'item'
  | 'member'
  | 'workspace'
  | 'role'
  | 'group'
export interface ActivityEntry {
  action: ActivityAction
  actorContext: string
  actorId: string | null
  actorName: string
  createdAt: string
  id: string
  resourceId: string
  resourceType: ActivityResourceType
  snapshot: Record<string, unknown> | null
}
export interface ActivityPageResponse {
  activities: ActivityEntry[]
  page: number
  size: number
  totalItems: number
  totalPages: number
}
export interface ActivityFilters {
  action?: ActivityAction
  actorId?: string
  from?: string
  page: number
  resourceType?: ActivityResourceType
  size: number
  to?: string
}
export type ForgotPasswordRequest =
  components['schemas']['ForgotPasswordRequest']
export type InviteUserRequest = components['schemas']['InviteUserRequest']
export interface InviteResponse {
  createdAt: string
  email: string
  expiresAt: string
  id: string
  invitedByName: string
  invitedByUserId: string
}
export interface NotificationResponse {
  content: string
  createdAt: string
  id: string
  metadata: Record<string, unknown>
  readAt: string | null
  title: string
}
export interface NotificationPageResponse {
  notifications: NotificationResponse[]
  page: number
  size: number
  totalItems: number
  totalPages: number
  unreadCount: number
}
export type InviteValidationRequest =
  components['schemas']['InviteValidationRequest']
export type InviteValidationResponse =
  components['schemas']['InviteValidationResponse']
export type LoginRequest = components['schemas']['LoginRequest']
export type RegisterRequest = components['schemas']['RegisterRequest']
export type ResetPasswordRequest = components['schemas']['ResetPasswordRequest']
export type UpdateProfileRequest = components['schemas']['UpdateProfileRequest']
export type UpdateWorkspaceRequest =
  components['schemas']['UpdateWorkspaceRequest']
export type UserResponse = components['schemas']['UserResponse']
export type WorkspaceMemberDto =
  components['schemas']['WorkspaceMemberResponse']
export type {
  WorkspaceMemberResponse,
  WorkspaceRolePermission,
  WorkspaceRoleResponse,
} from './workspace-members'
export type WorkspaceResponse = components['schemas']['WorkspaceResponse']
export interface WorkspacePermission {
  action: string
  resource: string
}
export interface WorkspacePermissionsResponse {
  isOwner: boolean
  permissions: WorkspacePermission[]
  roleId: string
  roleName: string
}
export interface AccessGroupResponse {
  id: string
  name: string
}
