// The messages at the bottom ("Frieren: Liked it · Undo"). They disappear after 6 seconds.
import { X } from "lucide-react";
import { useStore } from "../state/createStore";
import { useTexts } from "../state/settings";
import { dismissToast, toastStore } from "../state/ui";

export function Toasts() {
  const t = useTexts();
  const toasts = useStore(toastStore);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast">
          <span className="toast-text">{toast.text}</span>
          {toast.undo && (
            <button
              className="toast-undo"
              onClick={() => {
                toast.undo!();
                dismissToast(toast.id);
              }}
            >
              {t.undo}
            </button>
          )}
          <button className="toast-close" aria-label={t.dialog.close} onClick={() => dismissToast(toast.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
