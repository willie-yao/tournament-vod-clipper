export interface YouTubeChannel {
  id: string;
  title: string;
}

export interface YouTubeSession {
  sessionId: string;
  channelId: string;
}

export type YouTubeStatus =
  | {
      state: 'connected';
      channel: YouTubeChannel;
      sessionId: string;
      message: string;
    }
  | {
      state:
        | 'not-configured'
        | 'disconnected'
        | 'connecting'
        | 'reconnect-required'
        | 'storage-error';
      message: string;
    };
