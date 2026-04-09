# A-1-1 channel schema and permissions

## Goal

- [ ] Own the initial schema and access model for workspace and teamspace channels.

## Implementation

- [x] Add `WorkspaceChannel`, `WorkspaceChannelMessage`, and `WorkspaceChannelVoicePresence` Prisma models.
- [x] Add a Prisma migration file for the new channel tables and indexes.
- [x] Add channel router access checks that require workspace membership and, when applicable, teamspace membership.
- [x] Add unique channel slugs within a workspace so direct routes remain stable.
- [ ] Define how private channels, invite-only rooms, and channel-specific moderators extend this access model.

## Edge Cases

- [x] Reject channel access when a user belongs to the workspace but not the referenced teamspace.
- [x] Keep page chat and page meeting data isolated so the new channel tables do not overwrite existing page-first behavior.
- [ ] Decide whether deleted teamspaces should archive, migrate, or null-scope their channels before enabling heavy production use.

## Validation

- [x] `pnpm exec prisma generate`
- [x] `pnpm exec prisma db push --skip-generate`
- [x] `pnpm exec vitest run tests/server/routers/channel.test.ts`
