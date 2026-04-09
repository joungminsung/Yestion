# A-1 workspace-channel-domain

## Capability

- [ ] Own the channel data model, scope rules, and room-state primitives that all workspace collaboration features depend on.
- [ ] Consider this feature complete when workspace and teamspace channels can be created safely, accessed through membership checks, and queried as a stable base for text, voice, and future media sessions.

## Breakdown

- [x] Add Prisma models for workspace channels, channel messages, and voice presence state.
- [x] Add router-level workspace and teamspace access checks so channel access cannot bypass existing membership rules.
- [x] Add a first-pass voice presence model for join, leave, heartbeat, and stale-user cleanup behavior.
- [ ] Define how channel-level roles, moderation, and private-room membership will extend beyond workspace and teamspace membership.
- [ ] Decide whether page chat and page meetings should later bridge into the same channel timeline or remain independent surfaces.

## Detail Task Links

- [ ] [A-1-1 channel schema and permissions](../detail_tasks/A-1_workspace-channel-domain/A-1-1_channel-schema-and-permissions.md)
- [ ] [A-1-2 room state and voice presence](../detail_tasks/A-1_workspace-channel-domain/A-1-2_room-state-and-voice-presence.md)

## Validation

- [x] Prisma schema compiles and local database sync succeeds.
- [x] Channel router tests cover channel creation, text messages, and voice presence state.
- [ ] Product review confirms private-channel and moderation requirements before widening permissions.
