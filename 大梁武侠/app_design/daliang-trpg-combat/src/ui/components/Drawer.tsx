import { type FC, type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: number;
  variant?: "default" | "dm";
  footer?: ReactNode;
}

/**
 * Slide-in drawer from the right edge.
 * - Default: 380px wide, max 30vw — overlays without resizing center content
 * - DM variant: 520px wide — for enemy library, full logs, hidden info management
 * - Closes on overlay click and Escape key
 */
export const Drawer: FC<DrawerProps> = ({
  open,
  onClose,
  title,
  children,
  variant = "default",
  footer,
}) => {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <>
      <div className="drawer-overlay" onClick={onClose} aria-hidden="true" />
      <div
        className={`drawer${variant === "dm" ? " drawer--dm" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="drawer__header">
          <h2>{title}</h2>
          <button className="drawer__close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        <div className="drawer__body">{children}</div>
        {footer && <div className="drawer__footer">{footer}</div>}
      </div>
    </>,
    document.body,
  );
};
