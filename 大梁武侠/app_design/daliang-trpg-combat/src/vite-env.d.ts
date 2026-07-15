/// <reference types="vite/client" />

declare module "*.hdr" {
  const src: string;
  export default src;
}

declare module "*.jpg" {
  const src: string;
  export default src;
}

interface DesktopWindowState {
  maximized: boolean;
  fullScreen: boolean;
}

interface DaliangDesktopApi {
  readonly isDesktop: true;
  minimize: () => void;
  toggleMaximize: () => void;
  toggleFullScreen: () => void;
  close: () => void;
  getWindowState: () => Promise<DesktopWindowState>;
  onWindowState: (listener: (state: DesktopWindowState) => void) => () => void;
  storage: {
    read: (key: "combat" | "session" | "campaign") => unknown;
    write: (key: "combat" | "session" | "campaign", value: unknown) => Promise<boolean>;
    clear: (key: "combat" | "session" | "campaign") => Promise<boolean>;
  };
  lanHost: {
    start: (port?: number) => Promise<{ running: true; port: number; localUrl: string; networkUrls: string[]; protocolVersion: number }>;
    stop: () => Promise<{ running: false }>;
  };
}

interface Window {
  daliangDesktop?: DaliangDesktopApi;
}
