import { useState, useRef, type ReactNode } from "react";
import { Plus } from "lucide-react";

export function Field({
  label,
  name,
  type = "number",
  value,
  required = false,
  min = 0,
  max = 100000,
  maxLength = 2000,
}: {
  label: string;
  name: string;
  type?: string;
  value?: string | number | null;
  required?: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
}) {
  return (
    <label>
      {label}
      {type === "textarea" ? (
        <textarea
          name={name}
          defaultValue={value ?? ""}
          required={required}
          maxLength={maxLength}
          rows={3}
        />
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={value ?? ""}
          required={required}
          min={type === "number" ? min : undefined}
          max={type === "number" ? max : undefined}
          step={type === "number" ? "any" : undefined}
          inputMode={type === "number" ? "decimal" : undefined}
          maxLength={maxLength}
        />
      )}
    </label>
  );
}
export function SaveButton({ label }: { label: string }) {
  return (
    <button className="button button-primary button-wide" type="submit">
      <Plus size={16} />
      {label}
    </button>
  );
}
export function LocalForm({
  children,
  onSave,
  success,
}: {
  children: ReactNode;
  onSave: (data: FormData) => Promise<void>;
  success?: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (lock.current) return;
        const data = new FormData(event.currentTarget);
        lock.current = true;
        setBusy(true);
        setError("");
        void onSave(data)
          .then(() => success?.())
          .catch((cause: unknown) =>
            setError(
              cause instanceof Error
                ? cause.message
                : "Não foi possível salvar.",
            ),
          )
          .finally(() => {
            lock.current = false;
            setBusy(false);
          });
      }}
    >
      <fieldset disabled={busy} className="nutrition-fieldset">
        {children}
        {error ? (
          <p className="nutrition-warning" role="alert">
            {error}
          </p>
        ) : null}
      </fieldset>
    </form>
  );
}
