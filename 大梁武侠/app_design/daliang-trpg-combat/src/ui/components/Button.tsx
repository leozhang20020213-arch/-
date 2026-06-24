import type { FC, ReactNode, ButtonHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "icon";
  size?: "sm" | "md";
  icon?: string;
  children?: ReactNode;
}

/**
 * Game-style button component.
 * - Toolbar buttons: variant="ghost" size="md" (36px, min 72px wide)
 * - Primary actions: variant="primary" size="md" (glowing border)
 * - Icon-only: variant="icon" (36×36, no text)
 */
export const Button: FC<ButtonProps> = ({
  variant = "secondary",
  size = "md",
  icon,
  children,
  className = "",
  ...rest
}) => {
  const cls = ["btn", `btn-${variant}`, `btn-${size}`, className].filter(Boolean).join(" ");

  return (
    <button type="button" className={cls} {...rest}>
      {icon && <img className="btn-icon" src={icon} alt="" aria-hidden="true" />}
      {children}
    </button>
  );
};
