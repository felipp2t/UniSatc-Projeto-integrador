import type { components } from './generated/schema'

export type {
  WorkspacePermission,
  WorkspacePermissionsResponse,
} from './permissions'

export type ChangePasswordRequest =
  components['schemas']['ChangePasswordRequest']
export type CreateItemType = 'file' | 'text' | 'link' | 'secret'
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
export type ItemType = 'file' | 'folder' | 'image' | 'link' | 'secret' | 'text'
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
export interface ItemSearchParams {
  includeArchived: boolean
  page: number
  q: string
  size: number
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
  | 'role_renamed'
  | 'role_deleted'
  | 'role_permissions_changed'
  | 'group_created'
  | 'group_renamed'
  | 'group_deleted'
  | 'group_member_added'
  | 'group_member_removed'
  | 'team_created'
  | 'team_renamed'
  | 'team_deleted'
  | 'team_member_added'
  | 'team_member_removed'
  | 'team_leader_changed'
  | 'content_published'
  | 'content_publication_revoked'
export type ActivityResourceType =
  | 'folder'
  | 'item'
  | 'member'
  | 'workspace'
  | 'role'
  | 'group'
  | 'team'
  | 'publication'
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
  import('./workspace-members').WorkspaceMemberResponse
export type {
  WorkspaceMemberResponse,
  WorkspaceRoleResponse,
} from './workspace-members'
export type WorkspaceResponse = components['schemas']['WorkspaceResponse']
export type GlobalRole = 'ADMIN' | 'MAINTAINER'
export interface TeamResponse {
  id: string
  leaderMemberId: string
  leaderName: string
  memberCount: number
  name: string
  rootCollectionId: string
  rootCollectionName: string
}
export interface TeamMemberResponse {
  id: string
  name: string
  roleName: string
  userId: string
}
export type PublicationType = 'COLLECTION' | 'ITEM'
export interface CreatePublicationRequest {
  destinationTeamId: string
  originalId: string
  originalType: PublicationType
}
export interface PublicationResponse {
  capturedPath: string
  createdAt: string
  destinationCollectionId: string
  id: string
  originalId: string
  originalType: PublicationType
  sourceCollectionId: string
  sourceTeamName: string
}
export interface PublicationConfiguration {
  destinationTeams: { id: string; name: string; collectionId: string }[]
  publications: PublicationResponse[]
  sourceCollectionId: string
}
export interface ReceivedItemResponse {
  id: string
  path: string
  readOnly: boolean
  received: boolean
  sourceTeamName: string
  title: string
  type: ItemType
}
export interface ReceivedContentPage {
  items: ReceivedItemResponse[]
  page: number
  size: number
  totalItems: number
  totalPages: number
}
export type ReceivedItemPath = ReceivedItemResponse
