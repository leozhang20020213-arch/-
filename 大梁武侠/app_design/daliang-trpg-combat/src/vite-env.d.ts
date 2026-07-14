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
}

interface Window {
  daliangDesktop?: DaliangDesktopApi;
}
