import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useDialogFocus } from "../hooks/useDialogFocus";

export function NutritionSheet({
  title,
  subtitle,
  children,
  onClose,
  busy = false,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  footer?: ReactNode;
}) {
  const ref = useDialogFocus(() => {
    if (!busy) onClose();
  });
  const content = (
    <div
      className="nutrition-sheet-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="nutrition-sheet"
        role="dialog"
        aria-modal="true"
        aria-busy={busy}
        aria-labelledby="nutrition-sheet-title"
        tabIndex={-1}
        ref={ref}
      >
        <div className="nutrition-sheet-handle" aria-hidden="true" />
        <header>
          <div>
            <h2 id="nutrition-sheet-title">{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="nutrition-icon-button"
            aria-label="Fechar edição"
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <div className="nutrition-sheet-content">{children}</div>
        {footer ? <div className="nutrition-sheet-footer">{footer}</div> : null}
      </section>
    </div>
  );
  return typeof document === "undefined"
    ? content
    : createPortal(content, document.body);
}
