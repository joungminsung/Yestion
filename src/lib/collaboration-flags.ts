function parseBooleanFlag(value: string | undefined, fallback = true) {
  if (value == null) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

export function getCollaborationFlags() {
  const channelsEnabled = parseBooleanFlag(process.env.COLLAB_CHANNELS_ENABLED, true);
  const voiceEnabled = channelsEnabled && parseBooleanFlag(process.env.COLLAB_VOICE_ENABLED, true);
  const screenShareEnabled =
    voiceEnabled && parseBooleanFlag(process.env.COLLAB_SCREEN_SHARE_ENABLED, true);
  const cobrowseEnabled =
    voiceEnabled && parseBooleanFlag(process.env.COLLAB_COBROWSE_ENABLED, true);

  return {
    channelsEnabled,
    voiceEnabled,
    screenShareEnabled,
    cobrowseEnabled,
  };
}
