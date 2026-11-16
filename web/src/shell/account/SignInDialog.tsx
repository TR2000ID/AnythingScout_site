// Sign in / Create account: one dialog, two tabs, one username box. On a browser that already has ratings the
// account doesn't, the same dialog then asks once whether to add them.
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { SHELL_TEXTS } from "../texts";
import { AccountError } from "./api";
import { runner, type SignInStep } from "./runner";

type Lang = "en" | "ja";
type Mode = "signin" | "create";

export function SignInDialog({ lang, open, onOpenChange }: { lang: Lang; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        {open && <SignInBody lang={lang} close={() => onOpenChange(false)} />}
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SignInBody({ lang, close }: { lang: Lang; close: () => void }) {
  const t = SHELL_TEXTS[lang].account;
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ask, setAsk] = useState<Extract<SignInStep, { kind: "ask" }> | null>(null);

  const fail = (err: unknown) => setError(t.errors[err instanceof AccountError ? err.code : "server"]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const step = await runner().signInFlow(name, mode);
      if (step.kind === "ask") setAsk(step);
      else close();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function choose(choice: "add" | "leave") {
    if (!ask || busy) return;
    setBusy(true);
    setError(null);
    try {
      await ask.resolve(choice);
      close();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  const label = mode === "signin" ? t.signIn : t.createAccount;

  return (
    <Dialog.Content className="dialog dialog-small account-dialog" aria-describedby={undefined}>
      <Dialog.Close className="icon-button dialog-close" aria-label={t.close}>
        <X size={18} />
      </Dialog.Close>
      <div className="dialog-body">
        {ask ? (
          <>
            <Dialog.Title className="dialog-title">{label}</Dialog.Title>
            <p className="account-ask">{t.ask(ask.missing)}</p>
            <div className="account-actions">
              <button className="button button-primary" onClick={() => void choose("add")} disabled={busy}>
                {t.add}
              </button>
              <button className="button" onClick={() => void choose("leave")} disabled={busy}>
                {t.leave}
              </button>
            </div>
          </>
        ) : (
          <>
            <Dialog.Title className="dialog-title">{label}</Dialog.Title>
            <div className="segmented account-modes" role="tablist">
              {(["signin", "create"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  className={mode === m ? "is-on" : undefined}
                  onClick={() => {
                    setMode(m);
                    setError(null);
                  }}
                >
                  {m === "signin" ? t.signIn : t.createAccount}
                </button>
              ))}
            </div>
            <form className="account-form" onSubmit={(e) => void submit(e)}>
              <label className="field-label" htmlFor="account-name">
                {t.username}
              </label>
              <input
                id="account-name"
                className="text-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={40}
                autoFocus
              />
              <p className="field-hint">{t.warning}</p>
              {error && (
                <p className="notice notice-error" role="alert">
                  {error}
                </p>
              )}
              <button className="button button-primary" type="submit" disabled={busy || !name.trim()}>
                {label}
              </button>
            </form>
          </>
        )}
      </div>
    </Dialog.Content>
  );
}
