export type MotionSpeed = 0.5 | 1 | 1.5 | 2;

/** Single source of truth for UI and dice presentation timing. */
export class MotionController {
  static speed: MotionSpeed = 1;

  static configure(speed: MotionSpeed, root: HTMLElement = document.documentElement) {
    this.speed = speed;
    const multiplier = 1 / speed;
    root.style.setProperty("--motion-rate", String(multiplier));
    root.style.setProperty("--motion-fast", `${Math.round(120 * multiplier)}ms`);
    root.style.setProperty("--motion-standard", `${Math.round(200 * multiplier)}ms`);
    root.style.setProperty("--motion-slow", `${Math.round(420 * multiplier)}ms`);
    root.style.setProperty("--motion-feedback", `${Math.round(900 * multiplier)}ms`);
    root.dataset.motionSpeed = String(speed);
  }

  static duration(milliseconds: number) {
    return Math.max(0, Math.round(milliseconds / this.speed));
  }
}
