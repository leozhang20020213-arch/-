import { type FC, createContext, useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";

export interface ToastItem {
  id: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
}

interface ToastContextValue {
  addToast: (message: string, type?: ToastItem["type"]) => void;
}

const ToastContext = createContext<ToastContextValue>({
  addToast: () => {},
});

export const useToast = () => useContext(ToastContext);

/**
 * Toast notification system.
 * Usage:
 *   <ToastProvider>
 *     <App />
 *   </ToastProvider>
 *
 *   const { addToast } = useToast();
 *   addToast("此骰当前不可放入该槽位", "warning");
 */
export const ToastProvider: FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: ToastItem["type"] = "info") => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {createPortal(
        <div className="toast-container" aria-live="polite">
          {toasts.map((t) => (
            <ToastEntry key={t.id} toast={t} onClose={() => removeToast(t.id)} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
};

const TYPE_ICONS: Record<string, string> = {
  info: "ℹ",
  success: "✓",
  warning: "⚠",
  error: "✕",
};

const ToastEntry: FC<{ toast: ToastItem; onClose: () => void }> = ({ toast, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`toast toast--${toast.type ?? "info"}`} role="alert">
      <span className="toast__icon">{TYPE_ICONS[toast.type ?? "info"]}</span>
      <span>{toast.message}</span>
      <button className="toast__close" onClick={onClose} aria-label="关闭">
        ✕
      </button>
    </div>
  );
};
