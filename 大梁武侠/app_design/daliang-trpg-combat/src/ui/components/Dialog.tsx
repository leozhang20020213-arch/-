import { type FC, type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: number;
  maxWidth?: string;
  maxHeight?: string;
  actions?: ReactNode;
  variant?: "default" | "dm";
}

/**
 * Modal dialog with backdrop.
 * - Default: 360-420px wide, centered, max 30vw
 * - DM variant: 520px wide, max 60vh
 * - Closes on backdrop click and Escape key
 */
export const Dialog: FC<DialogProps> = ({
  open,
  onClose,
  title,
  children,
  actions,
  variant = "default",
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

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
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className={`dialog${variant === "dm" ? " dialog--dm" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog__header">
          <h2>{title}</h2>
          <button className="dialog__close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        <div className="dialog__body">{children}</div>
        {actions && <div className="dialog__footer">{actions}</div>}
      </div>
    </div>,
    document.body,
  );
};
