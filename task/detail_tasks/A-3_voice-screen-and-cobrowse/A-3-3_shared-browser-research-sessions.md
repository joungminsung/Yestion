# A-3-3 shared browser research sessions

## Goal

- [x] Define and ship the first shared-browser experience that lets users research together inside a collaboration room.

## Implementation

- [x] Decide to ship the first version as a synchronized URL and tab session with embedded iframe viewing where browser policies allow it.
- [x] Define who controls navigation, how authority is handed off, and how observers request control.
- [x] Add room-linked state for open tabs, active URL, active controller, and request-to-control metadata.
- [x] Route research artifacts back into the channel as saved browser notes with URL metadata.
- [ ] Add shared annotations, cursor intent, and richer in-page collaboration signals on top of the session state.

## Edge Cases

- [x] Define sandbox, iframe, and CSP restrictions in-product so users understand why some sites cannot render inside the embedded viewer.
- [ ] Add a remote-browser fallback plan for protected sites, logins, and iframe-blocked targets.
- [ ] Handle clipboard boundaries and sensitive-data redaction rules before broader rollout.

## Validation

- [ ] Add a security review checklist before any shared-browser prototype is enabled broadly.
- [x] Add router and persistence checks for synchronized browsing, handoff, link capture, and session persistence.
- [ ] Add manual browser scenarios for iframe-allowed sites, iframe-blocked sites, handoff, and reconnect recovery.
