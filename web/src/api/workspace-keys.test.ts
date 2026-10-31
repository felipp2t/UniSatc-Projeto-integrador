import { describe, expect, it } from 'vitest'
import {
  workspaceMembersQueryKey,
  workspaceRolesQueryKey,
  workspacesQueryKey,
} from './workspace-keys'

describe('workspace query keys', () => {
  it('keeps the canonical workspace and workspace-member key shapes', () => {
    expect(workspacesQueryKey).toEqual(['workspaces'])
    expect(workspaceMembersQueryKey('workspace-1')).toEqual([
      'workspace-members',
      'workspace-1',
    ])
    expect(workspaceMembersQueryKey(undefined)).toEqual([
      'workspace-members',
      undefined,
    ])
  })

  it('keeps the canonical workspace roles key shape', () => {
    expect(workspaceRolesQueryKey('workspace-1')).toEqual([
      'workspace-roles',
      'workspace-1',
    ])
  })
})
