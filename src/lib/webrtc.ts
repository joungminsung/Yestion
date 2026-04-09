export type SerializableIceServer = {
  urls: string[];
  username?: string;
  credential?: string;
};

function parseUrls(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function getSerializedIceServers(): SerializableIceServer[] {
  const stunUrls = parseUrls(process.env.WEBRTC_STUN_URLS).length > 0
    ? parseUrls(process.env.WEBRTC_STUN_URLS)
    : ["stun:stun.l.google.com:19302"];
  const turnUrls = parseUrls(process.env.WEBRTC_TURN_URLS);
  const turnUsername = process.env.WEBRTC_TURN_USERNAME?.trim();
  const turnCredential = process.env.WEBRTC_TURN_CREDENTIAL?.trim();

  const iceServers: SerializableIceServer[] = [
    { urls: stunUrls },
  ];

  if (turnUrls.length > 0) {
    iceServers.push({
      urls: turnUrls,
      ...(turnUsername ? { username: turnUsername } : {}),
      ...(turnCredential ? { credential: turnCredential } : {}),
    });
  }

  return iceServers;
}
