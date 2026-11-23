// The frame's words: the service bar, the account spot and the Soon page. Each section keeps its own texts
// (anime/texts.ts).
import type { AccountErrorCode } from "./account/api";

/** Placeholder until you pick the site's name: change it here (and in index.html's <title>) */
export const SITE_NAME = "Anything Scout";

interface ShellTexts {
  sections: string; // the service bar, for screen readers
  games: string;
  anime: string;
  manga: string;
  soon: string;
  soonMangaTitle: string;
  soonManga: string;
  account: AccountTexts;
}

interface AccountTexts {
  menu: string; // the account button, for screen readers
  signIn: string;
  createAccount: string;
  username: string;
  warning: string; // always under the username box
  errors: Record<AccountErrorCode, string>;
  ask: (n: number) => string;
  add: string;
  leave: string;
  changePicture: string;
  removePicture: string;
  signOut: string;
  synced: (ago: string) => string;
  notSynced: string;
  offline: string;
  syncProblem: string;
  tooBig: string;
  unsynced: (n: number) => string;
  signOutAnyway: string;
  cancel: string;
  ended: string;
  endedShort: string;
  ok: string;
  pictureTooLarge: string;
  notAnImage: string;
  close: string;
  ago: { now: string; min: (n: number) => string; hour: (n: number) => string; day: (n: number) => string };
}

export const SHELL_TEXTS: Record<"en" | "ja", ShellTexts> = {
  en: {
    sections: "Sections",
    games: "Games",
    anime: "Anime",
    manga: "Manga & Comics",
    soon: "Soon",
    soonMangaTitle: "Manga & Comics is coming",
    soonManga:
      "Manga data is researched (64,833 titles, plus links from 3,273 anime to their source manga). It will get its own section here, with the same account and look.",
    account: {
      menu: "Account",
      signIn: "Sign in",
      createAccount: "Create account",
      username: "Username",
      warning: "Anyone who knows your username can open this account. Don't use your real name or anything private.",
      errors: {
        unknown: "No account with that name.",
        taken: "That name is taken.",
        bad_name: "2–20 letters, numbers, _ or -.",
        too_many: "Too many tries. Wait a few minutes.",
        offline: "Can't reach the site. Check your connection.",
        no_storage: "This browser can't save your sign-in (private window?).",
        signed_out: "You were signed out. Sign in again to keep syncing.",
        too_big: "Watch together list is too big to sync",
        server: "Something went wrong. Try again.",
      },
      ask: (n) => `This browser has ${n} ${n === 1 ? "rating" : "ratings"} your account doesn't.`,
      add: "Add them to your account",
      leave: "Leave them out",
      changePicture: "Change picture",
      removePicture: "Remove picture",
      signOut: "Sign out",
      synced: (ago) => `Synced ${ago}`,
      notSynced: "Not synced yet",
      offline: "Offline: changes will sync later",
      syncProblem: "Couldn't sync: the site had a problem. It will try again.",
      tooBig: "Watch together list is too big to sync",
      unsynced: (n) => `${n} ${n === 1 ? "change hasn't" : "changes haven't"} synced yet. Sign out anyway?`,
      signOutAnyway: "Sign out anyway",
      cancel: "Cancel",
      ended: "You were signed out. Sign in again to keep syncing.",
      endedShort: "Signed out",
      ok: "OK",
      pictureTooLarge: "Picture too large",
      notAnImage: "That file isn't a picture",
      close: "Close",
      ago: { now: "just now", min: (n) => `${n} min ago`, hour: (n) => `${n} h ago`, day: (n) => `${n} ${n === 1 ? "day" : "days"} ago` },
    },
  },
  ja: {
    sections: "セクション",
    games: "ゲーム",
    anime: "アニメ",
    manga: "マンガ・コミック",
    soon: "準備中",
    soonMangaTitle: "マンガ・コミックは準備中です",
    soonManga:
      "マンガのデータは調査済み（64,833作品、アニメ3,273作品から原作マンガへのつながり）。同じアカウント・同じデザインで、ここに専用セクションができます。",
    account: {
      menu: "アカウント",
      signIn: "ログイン",
      createAccount: "アカウント作成",
      username: "ユーザー名",
      warning: "ユーザー名を知っている人は誰でもこのアカウントを開けます。本名や個人的な情報は使わないでください。",
      errors: {
        unknown: "その名前のアカウントはありません。",
        taken: "その名前は使われています。",
        bad_name: "2〜20文字の文字・数字・_・-",
        too_many: "試行が多すぎます。数分待ってください。",
        offline: "接続できません。通信を確認してください。",
        no_storage: "このブラウザはログインを保存できません（プライベートウィンドウ？）",
        signed_out: "ログアウトされました。同期を続けるには、もう一度ログインしてください。",
        too_big: "「みんなで観る」のリストが大きすぎて同期できません",
        server: "問題が発生しました。もう一度お試しください。",
      },
      ask: (n) => `このブラウザには、アカウントにない評価が${n}件あります。`,
      add: "アカウントに追加",
      leave: "追加しない",
      changePicture: "画像を変更",
      removePicture: "画像を削除",
      signOut: "ログアウト",
      synced: (ago) => `同期：${ago}`,
      notSynced: "まだ同期していません",
      offline: "オフライン：変更はあとで同期されます",
      syncProblem: "同期できませんでした（サイト側の問題）。あとでもう一度試します。",
      tooBig: "「みんなで観る」のリストが大きすぎて同期できません",
      unsynced: (n) => `${n}件の変更がまだ同期されていません。ログアウトしますか？`,
      signOutAnyway: "ログアウトする",
      cancel: "キャンセル",
      ended: "ログアウトされました。同期を続けるには、もう一度ログインしてください。",
      endedShort: "ログアウト済み",
      ok: "OK",
      pictureTooLarge: "画像が大きすぎます",
      notAnImage: "画像ファイルではありません",
      close: "閉じる",
      ago: { now: "たった今", min: (n) => `${n}分前`, hour: (n) => `${n}時間前`, day: (n) => `${n}日前` },
    },
  },
};
