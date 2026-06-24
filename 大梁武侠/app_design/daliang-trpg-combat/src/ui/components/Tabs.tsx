import type { FC } from "react";

export interface TabItem {
  id: string;
  label: string;
  icon?: string;
}

export interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  variant?: "underline" | "pills";
  className?: string;
}

/**
 * Tab bar component.
 * - underline: bottom-border active indicator (for drawer headers)
 * - pills: pill-shaped active indicator (for compact filters)
 */
export const Tabs: FC<TabsProps> = ({
  items,
  activeId,
  onChange,
  variant = "underline",
  className = "",
}) => {
  const cls = ["tabs", `tabs--${variant}`, className].filter(Boolean).join(" ");

  return (
    <div className={cls} role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          className={`tab${item.id === activeId ? " active" : ""}`}
          role="tab"
          aria-selected={item.id === activeId}
          onClick={() => onChange(item.id)}
          type="button"
        >
          {item.icon && <img className="btn-icon" src={item.icon} alt="" aria-hidden="true" />}
          {item.label}
        </button>
      ))}
    </div>
  );
};
