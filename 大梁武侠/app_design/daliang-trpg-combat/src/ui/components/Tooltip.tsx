import { type FC, type ReactNode, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";

export interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
}

/**
 * Hover tooltip with configurable delay and position.
 * Wraps children in a span to capture mouse events.
 * Renders via portal to avoid clipping by overflow:hidden parents.
 * Default delay: 400ms.
 */
export const Tooltip: FC<TooltipProps> = ({
  content,
  children,
  position = "top",
  delay = 400,
}) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      let x = rect.left + rect.width / 2;
      let y = rect.top;

      if (position === "bottom") y = rect.bottom;
      else if (position === "left") x = rect.left;
      else if (position === "right") x = rect.right;

      setCoords({ x, y });
      timerRef.current = setTimeout(() => setVisible(true), delay);
    },
    [delay, position],
  );

  const hide = useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  const style: React.CSSProperties = {
    left: `${coords.x}px`,
    top: `${coords.y}px`,
    transform:
      position === "top"
        ? "translate(-50%, -100%)"
        : position === "bottom"
          ? "translate(-50%, 4px)"
          : position === "left"
            ? "translate(-100%, -50%)"
            : "translate(4px, -50%)",
  };

  return (
    <span className="tooltip-container" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible &&
        createPortal(
          <div className="tooltip" style={style}>
            {content}
          </div>,
          document.body,
        )}
    </span>
  );
};
