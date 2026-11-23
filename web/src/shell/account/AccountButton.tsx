// The account spot at the right end of the service bar.
//   signed out: a quiet "Sign in" text button
//   signed in:  picture (or the first letter in a circle) + username → menu: sync status, Change picture,
//               Remove picture, Sign out (asks first when changes haven't synced yet)
//   ended:      the server no longer knows this sign-in → "You were signed out" with Sign in / OK
import * as Dialog from "@radix-ui/react-dialog";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { useEffect, useRef, useState } from "react";
import { SHELL_TEXTS } from "../texts";
import { useAccount, type AccountState } from "./account";
import { AccountError, pictureUrl } from "./api";
import { PictureError, shrinkPicture } from "./picture";
import { runner, type SignOutStep } from "./runner";
import { SignInDialog } from "./SignInDialog";

type Lang = "en" | "ja";
type Texts = (typeof SHELL_TEXTS)["en"]["account"];

export function ago(iso: string, t: Texts, now = Date.now()): string {
  const minutes = Math.floor((now - Date.parse(iso)) / 60_000);
  if (minutes < 1) return t.ago.now;
  if (minutes < 60) return t.ago.min(minutes);
  if (minutes < 24 * 60) return t.ago.hour(Math.floor(minutes / 60));
  return t.ago.day(Math.floor(minutes / (24 * 60)));
}

function statusLine(account: Extract<AccountState, { state: "signed_in" }>, t: Texts): string {
  if (account.status === "offline") return t.offline;
  if (account.status === "problem") return t.syncProblem;
  if (account.status === "too_big") return t.tooBig;
  return account.synced ? t.synced(ago(account.synced, t)) : t.notSynced;
}

export function Avatar({ name, pictureAt }: { name: string; pictureAt: string | null }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [pictureAt]);
  if (pictureAt && !broken)
    return <img className="avatar" src={pictureUrl(name, pictureAt)} alt="" width={28} height={28} onError={() => setBroken(true)} />;
  return (
    <span className="avatar avatar-letter" aria-hidden="true">
      {[...name][0]?.toUpperCase()}
    </span>
  );
}

export function AccountButton({ lang }: { lang: Lang }) {
  const t = SHELL_TEXTS[lang].account;
  const account = useAccount();
  const [dialog, setDialog] = useState(false);
  const [confirm, setConfirm] = useState<Extract<SignOutStep, { kind: "unsynced" }> | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 5000);
    return () => clearTimeout(timer);
  }, [flash]);

  const problem = (err: unknown) =>
    setFlash(
      err instanceof PictureError
        ? err.code === "too_large"
          ? t.pictureTooLarge
          : t.notAnImage
        : t.errors[err instanceof AccountError ? err.code : "server"],
    );

  async function pickPicture(picked: File | undefined) {
    if (!picked) return;
    try {
      await runner().setPicture(await shrinkPicture(picked));
    } catch (err) {
      problem(err);
    }
  }

  async function signOut() {
    const step = await runner().signOutFlow();
    if (step.kind === "unsynced") setConfirm(step);
  }

  const signInDialog = <SignInDialog lang={lang} open={dialog} onOpenChange={setDialog} />;

  if (account.state === "signed_out")
    return (
      <div className="account-spot">
        <button className="text-button account-signin" onClick={() => setDialog(true)}>
          {t.signIn}
        </button>
        {signInDialog}
      </div>
    );

  if (account.state === "ended")
    return (
      <div className="account-spot">
        <Menu.Root>
          <Menu.Trigger className="text-button account-trigger">{t.endedShort}</Menu.Trigger>
          <Menu.Portal>
            <Menu.Content className="menu account-menu" align="end" sideOffset={8}>
              <p className="account-status">{t.ended}</p>
              <Menu.Separator className="menu-separator" />
              <Menu.Item className="menu-item" onSelect={() => setDialog(true)}>
                <span className="menu-item-plain">{t.signIn}</span>
              </Menu.Item>
              <Menu.Item className="menu-item" onSelect={() => runner().dismissEnded()}>
                <span className="menu-item-plain">{t.ok}</span>
              </Menu.Item>
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
        {signInDialog}
      </div>
    );

  return (
    <div className="account-spot">
      {flash && (
        <span className="account-flash" role="alert">
          {flash}
        </span>
      )}
      <Menu.Root>
        <Menu.Trigger className="account-trigger" aria-label={`${t.menu}: ${account.name}`}>
          <Avatar name={account.name} pictureAt={account.pictureAt} />
          <span className="account-name">{account.name}</span>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content className="menu account-menu" align="end" sideOffset={8}>
            <div className="account-menu-head">
              <span className="account-menu-name">{account.name}</span>
              <span className={`account-status${account.status === "ok" ? "" : " is-warning"}`}>{statusLine(account, t)}</span>
            </div>
            <Menu.Separator className="menu-separator" />
            <Menu.Item className="menu-item" onSelect={() => file.current?.click()}>
              <span className="menu-item-plain">{t.changePicture}</span>
            </Menu.Item>
            {account.pictureAt && (
              <Menu.Item className="menu-item" onSelect={() => void runner().removePicture().catch(problem)}>
                <span className="menu-item-plain">{t.removePicture}</span>
              </Menu.Item>
            )}
            <Menu.Separator className="menu-separator" />
            <Menu.Item className="menu-item" onSelect={() => void signOut()}>
              <span className="menu-item-plain">{t.signOut}</span>
            </Menu.Item>
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>
      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void pickPicture(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Dialog.Root open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog dialog-small account-dialog" aria-describedby={undefined}>
            <div className="dialog-body">
              <Dialog.Title className="dialog-title">{t.signOut}</Dialog.Title>
              <p className="account-ask">{confirm ? t.unsynced(confirm.count) : ""}</p>
              <div className="account-actions">
                <button
                  className="button button-danger"
                  onClick={() => {
                    const step = confirm;
                    setConfirm(null);
                    void step?.force();
                  }}
                >
                  {t.signOutAnyway}
                </button>
                <Dialog.Close className="button">{t.cancel}</Dialog.Close>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
