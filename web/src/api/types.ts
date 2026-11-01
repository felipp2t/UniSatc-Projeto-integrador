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
export type UpdateAttachmentMetadataRequest =
  components['schemas']['UpdateItemMetadataRequest']
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
  WorkspaceRoleResponse,
} from './workspace-members'
export type WorkspaceResponse = components['schemas']['WorkspaceResponse']
