// Bridge exposed by electron/preload.js. Undefined in plain browser (web) mode.
type DesktopWindowState = { maximized: boolean; fullscreen: boolean; focused: boolean };

interface Window {
  desktop?: {
    isDesktop: true;
    platform: string;
    window: {
      state(): Promise<DesktopWindowState>;
      minimize(): Promise<void>;
      toggleMaximize(): Promise<void>;
      toggleFullscreen(): Promise<void>;
      close(): Promise<void>;
      onState(cb: (s: DesktopWindowState) => void): () => void;
    };
  };
}
