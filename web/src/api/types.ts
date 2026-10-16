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
  collectionId: string | null
  id: string
  linkUrl: string | null
  textContent: string | null
  title: string
  type: CreateItemType
}
export interface CollectionResponse {
  id: string
  name: string
  parentId: string | null
}
export interface CollectionPageResponse {
  items: CollectionResponse[]
  page: number
  size: number
  totalItems: number
  totalPages: number
}
export type CreateWorkspaceRequest =
  components['schemas']['CreateWorkspaceRequest']
export type ForgotPasswordRequest =
  components['schemas']['ForgotPasswordRequest']
export type InviteUserRequest = components['schemas']['InviteUserRequest']
export type LoginRequest = components['schemas']['LoginRequest']
export type RegisterRequest = components['schemas']['RegisterRequest']
export type ResetPasswordRequest = components['schemas']['ResetPasswordRequest']
export type UpdateProfileRequest = components['schemas']['UpdateProfileRequest']
export type UpdateWorkspaceRequest =
  components['schemas']['UpdateWorkspaceRequest']
export type UserResponse = components['schemas']['UserResponse']
export type WorkspaceMemberResponse =
  components['schemas']['WorkspaceMemberResponse']
export type WorkspaceResponse = components['schemas']['WorkspaceResponse']
