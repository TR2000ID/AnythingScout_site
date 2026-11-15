// Every word the site shows, in English and Japanese. Pages call useTexts() and get the right one.
// Game titles are not here: they come from the data (Settings → Game titles picks which one).
import type { Store } from "./lib/data";
import type { Tier } from "./lib/recommend";

const en = {
  lang: "en",
  nav: {
    forYou: "For you",
    sales: "Steam sales",
    myGames: "My games",
    liked: "Liked",
    okay: "Okay",
    disliked: "Disliked",
    hidden: "Hidden",
    settings: "Settings",
    about: "About",
    openMenu: "Open menu",
    closeMenu: "Close menu",
  },
  side: {
    rate: "Rate games you've played",
    platform: "Platform",
    mode: "Recommend by",
    modeHints: { players: "Loved by fans of your games", tags: "Similar genre, style and mood" },
    notOn: (platform: string) => `Not available on ${platform}`,
    notYet: (platform: string) => `Coming later on ${platform}`,
  },
  search: {
    placeholder: "Search in English or 日本語",
    shortcut: "Press / to search",
    none: (q: string) => `No games found for “${q}”`,
    loading: "Loading games…",
  },
  tiers: {
    loved: "Loved it",
    liked: "Liked it",
    okay: "It was okay",
    disliked: "Didn't like it",
    hidden: "Hidden",
  } satisfies Record<Tier, string>,
  tierShort: {
    loved: "Loved",
    liked: "Liked",
    okay: "Okay",
    disliked: "Disliked",
    hidden: "Hidden",
  } satisfies Record<Tier, string>,
  rate: "Rate",
  removeRating: "Remove rating",
  hide: "Hide",
  hideHint: "Hide: not interested or already played. Doesn't change your taste.",
  unhide: "Unhide",
  undo: "Undo",
  toast: {
    rated: (title: string, tier: string) => `${title}: ${tier}`,
    hidden: (title: string) => `Hid ${title}`,
    removed: (title: string) => `Removed your rating for ${title}`,
  },
  modes: { players: "Players also liked", tags: "More like these" },
  match: (pct: number) => `${pct}% match`,
  meta: (year: number, positive: number) => `${year} · ${positive}% positive`,
  metaConsoles: (year: number, consoles: string) => `${year} · ${consoles}`,
  // Xbox 360 games that run on today's Xbox. Short, to fit on a card: the details popup says it in full
  backcompat: "360 · back-compat",
  reasonPlayers: (pct: number, title: string) =>
    pct >= 1 ? `${pct}% of ${title} fans liked this` : `Liked by ${title} fans`,
  // Consoles have no reviews: their links come from what people played (see export_web.py)
  reasonPlayed: (pct: number, title: string) =>
    pct >= 1 ? `${pct}% of ${title} players also played this` : `Played by ${title} players`,
  progress: { playstation: "trophies", xbox: "achievements" } as Record<string, string>,
  reasonTags: (title: string, tags: string[]) => (tags.length ? `Like ${title}: ${tags.join(", ")}` : `Like ${title}`),
  forYou: {
    title: "Recommended for you",
    basedOn: (n: number) => `Based on ${n} rated ${n === 1 ? "game" : "games"}`,
    edit: "Edit",
    notePlayers: (until: string) =>
      `Games that players who liked yours also liked, from 41M Steam reviews up to ${until}. Newer games only appear in More like these.`,
    noteConsole: (platform: string, players: string, progress: string, until: string) =>
      `Games that ${platform} players who played yours also played, especially ones they played further than most. From ${players} players' libraries and ${progress}, up to ${until}.`,
    tagsLater: (platform: string) => `More like these, cover art and Japanese titles for ${platform} come later.`,
    noteTags: "Games whose tags (genre, style, mood) are closest to the ones you liked.",
    startTitle: "Start with games you know",
    startBody: "Search for games you've played, or rate some popular ones below. Picks appear as soon as you like one.",
    needLike: "Like at least one game to get picks. Okay games count a little, and disliked games are just kept out of your picks.",
    popular: (platform: string) => `Popular on ${platform}`,
    noMatches: "No matches with these filters.",
    clearFilters: "Clear filters",
    showMore: "Show more",
    soonTag: "Soon",
    soonTitle: (platform: string) => `${platform} picks are on the way`,
    soonBody: {
      playstation:
        "Recommendations for PS5 and PS4 games are being built from real players' libraries and trophy progress.",
      xbox:
        "Recommendations for Xbox Series X|S, Xbox One and backward-compatible Xbox 360 games are being built from real players' libraries and achievements.",
      switch:
        "Switch 2 and Switch games will get More like these, which matches games by genre and style. Nintendo has no public player data, so Switch won't have Players also liked.",
    },
    soonFoot: "Ratings you make on any platform are saved and will shape these picks too.",
    onlyTags: "Switch only has More like these: Nintendo has no public player data.",
  },
  price: {
    free: "Free",
    notSold: (store: string) => `Not sold in the ${store}`,
    ends: (day: string) => `Sale ends ${day}`,
    store: { us: "US store", jp: "Japanese store" } as Record<Store, string>,
  },
  sales: {
    title: "Steam sales",
    lead: (n: string, store: string, when: string) => `${n} games on sale in the ${store} · prices from ${when}`,
    changeStore: "Change store",
    minLabel: "Discount",
    anyCut: "Any discount",
    atLeast: (pct: number) => `${pct}%+ off`,
    sortLabel: "Sort",
    sort: { match: "Best match", discount: "Biggest discount", popular: "Most reviewed" },
    noteMatch: (mode: string) => `Best matches for your taste first (${mode}), then the most reviewed.`,
    noteSort: { discount: "Biggest discounts first.", popular: "Most reviewed games first." },
    noteNoTaste: "Like a game to sort sales by your taste.",
    noteStale: "Prices are from the last update: check Steam before you buy.",
    none: "No games on sale match these filters.",
    noPrices: "Steam prices haven't been collected yet.",
  },
  update: {
    button: "Update now",
    running: (elapsed: string) => `Updating… ${elapsed}`,
    estimating: "Working out the time left…",
    left: (minutes: number) => (minutes < 1 ? "Less than a minute left" : `About ${minutes} min left`),
    hint: "Update now collects new games, prices and sales from Steam (about 10 minutes). Windows also runs it every morning.",
    done: (summary: string) => `Updated. ${summary}`,
    failed: "The update failed. Yesterday's data is still in place.",
  },
  filters: {
    button: "Filters",
    released: "Released",
    from: "From",
    to: "To",
    any: "Any",
    japanese: "Japanese language support",
    japanesePartial: "Language info is missing for many games on this platform.",
    onSale: "On sale now",
    reset: "Reset",
  },
  rated: {
    title: "My games",
    likedTitle: "Liked",
    likedEmpty: "Games you love or like show up here. They pull similar games up in your picks.",
    okayTitle: "Okay",
    okayEmpty: "Games that were just okay show up here. They won't be recommended to you again, and they count a little toward your taste.",
    dislikedTitle: "Disliked",
    dislikedEmpty: "Games you didn't like show up here. They're never recommended to you.",
    hiddenTitle: "Hidden",
    hiddenEmpty: "Games you hide never show up in your picks, and they don't change your taste.",
    missing: (n: number) =>
      `${n} rated ${n === 1 ? "game isn't" : "games aren't"} in today's game list (for example a new game the daily update dropped), so ${n === 1 ? "it can't" : "they can't"} be shown.`,
    removeMissing: "Remove those ratings",
  },
  dialog: {
    close: "Close",
    why: "Why this?",
    reasonPlayers: (pct: number, title: string) =>
      pct >= 1
        ? `${pct}% of players who liked ${title} also liked this.`
        : `Players who liked ${title} also liked this.`,
    reasonPlayed: (pct: number, title: string) =>
      pct >= 1
        ? `${pct}% of players who played ${title} also played this.`
        : `Players who played ${title} also played this.`,
    reasonTags: (title: string, tags: string[]) =>
      tags.length ? `Shares ${tags.join(", ")} with ${title}.` : `Its tags are close to ${title}.`,
    reviews: (positive: number, n: string) => `${positive}% positive of ${n} reviews`,
    players: (n: string) => `${n} players in the data`,
    rateOnly: {
      playstation: (consoles: string) =>
        `${consoles} game: rating it shapes your picks, but it isn't recommended, because a PS5 can't play ${consoles} games.`,
      xbox: () =>
        "Xbox 360 game: rating it shapes your picks, but it isn't recommended, because it isn't backward compatible: today's Xbox can't play it.",
    } as Record<string, (consoles: string) => string>,
    backcompat: "Xbox 360 game that runs on Xbox Series X|S and Xbox One (backward compatible).",
    tags: "Tags",
    store: (store: string) => `Open in ${store}`,
    japanese: "Japanese supported",
  },
  settings: {
    title: "Settings",
    language: "Language",
    languageHint: "Menus and text on the site.",
    titles: "Game titles",
    titlesHint: "日本語 shows the Japanese store name when a game has one.",
    store: "Steam prices",
    storeHint: "Which Steam store's prices and sales to show.",
    storeUs: "US $",
    storeJp: "日本 ¥",
    ratings: "Your ratings",
    ratingsHint: (n: number) =>
      `${n} ${n === 1 ? "game" : "games"} rated. Saved in this browser only. Sign-in to keep them on every device comes in v1.1.`,
    removeAll: "Remove all ratings",
    confirmRemove: "Remove all your ratings? This can't be undone.",
    data: "Data",
    dataSteam: (until: string, updated: string) =>
      `Steam: players data up to ${until}. Store data, prices and sales updated ${updated}.`,
    dataDaily: "Updated every day.",
    dataConsole: (platform: string, players: string, progress: string, until: string) =>
      `${platform}: ${players} players' libraries and ${progress}, up to ${until}.`,
    dataSoon: "Switch: coming soon.",
  },
  // The one-time copy of Game Scout ratings (/games/carry#..., made by tools/read_game_ratings.py)
  carry: {
    title: "Bring your Game Scout ratings",
    none: "This link has no ratings in it. Make a new one with tools/read_game_ratings.py.",
    same: (n: number) => `Your ${n} ${n === 1 ? "rating is" : "ratings are"} already here.`,
    ask: (here: number, incoming: number) =>
      `This site already has ${here} different game ${here === 1 ? "rating" : "ratings"}. Replace with the ${incoming} from Game Scout?`,
    replace: "Replace",
    keep: "Keep these",
    kept: "Nothing changed: the ratings already here stay.",
    done: (n: number) => `Copied ${n} ${n === 1 ? "rating" : "ratings"} and your settings.`,
    failed: "Copying didn't work (your browser may be blocking saved data). Nothing was changed.",
    open: "Open My games",
  },
  about: {
    title: "About Game Scout",
    intro:
      "Game Scout recommends games based on the ones you've enjoyed, for Steam, PlayStation, Xbox and Switch. You keep one list of ratings, and switch platforms to see what to play on each.",
    howTitle: "How picks work",
    howPlayers:
      "Players also liked: every game you liked “votes” for the games its players liked most. On Steam this comes from 41 million real reviews. PlayStation and Xbox have no reviews, so it comes from about 46,000 players' libraries on each: a game someone played counts, and a game they played further than most players counts six times as much.",
    howTags:
      "More like these: builds a taste profile from the tags of the games you liked (genre, style, mood) and finds the closest matches.",
    howRatings:
      "Loved games count twice as much as liked ones, and okay games count a little: you played them, which says something about your taste. Disliked games are never recommended, but they don't push similar games down. In the data, people who disliked a game still liked games like it more often than not, so pushing them down made picks worse. Hidden games are just left out.",
    statusTitle: "Platforms",
    statusSteam: "Steam: ready, with prices and sales from the US and Japanese stores.",
    statusConsoles:
      "PlayStation and Xbox: Players also liked is ready. More like these, cover art and Japanese titles come later. PS3, Vita and Xbox 360 games can be rated (they shape your picks), but only Xbox 360 games that run on today's Xbox (backward compatible) are recommended.",
    statusSoon: "Switch: coming soon.",
    dataTitle: "Data",
    dataSteam: "Steam reviews and tags: “Game Recommendations on Steam” by Anton Kozyriev on Kaggle.",
    dataPrices:
      "Steam prices, sales and games newer than the reviews: the Steam store, updated every day. Prices can be up to a day old, so check Steam before you buy.",
    dataConsoles:
      "PlayStation and Xbox player data: “Gaming Profiles 2025” by Artyom Kruglov on Kaggle (CC0). Names of the games that dataset leaves out: its source project, GameStatsHub (CC0). Xbox 360 games that run on today's Xbox: Wikipedia's “List of backward-compatible games for Xbox One and Series X/S” (CC BY-SA 4.0).",
    privacyTitle: "Your data",
    privacy: "Your ratings are saved in this browser only. Nothing is sent anywhere.",
    notAffiliated:
      "Game Scout is a personal project. It is not affiliated with Valve, Sony, Microsoft or Nintendo. Game names and cover art belong to their owners.",
  },
  loading: "Loading…",
  loadError: "Couldn't load the game data. Try reloading the page.",
};

export type Texts = typeof en;

const ja: Texts = {
  lang: "ja",
  nav: {
    forYou: "おすすめ",
    sales: "Steamセール",
    myGames: "マイゲーム",
    liked: "好き",
    okay: "まあまあ",
    disliked: "好きじゃない",
    hidden: "非表示",
    settings: "設定",
    about: "このサイトについて",
    openMenu: "メニューを開く",
    closeMenu: "メニューを閉じる",
  },
  side: {
    rate: "プレイしたゲームを評価",
    platform: "プラットフォーム",
    mode: "おすすめの基準",
    modeHints: { players: "好きなゲームのファンに人気", tags: "ジャンル・スタイル・雰囲気が近い" },
    notOn: (platform) => `${platform}では使えません`,
    notYet: (platform) => `${platform}は今後対応予定`,
  },
  search: {
    placeholder: "日本語・Englishで検索",
    shortcut: "/ キーで検索",
    none: (q) => `「${q}」に一致するゲームはありません`,
    loading: "ゲームを読み込み中…",
  },
  tiers: {
    loved: "大好き",
    liked: "好き",
    okay: "まあまあ",
    disliked: "好きじゃない",
    hidden: "非表示",
  },
  tierShort: {
    loved: "大好き",
    liked: "好き",
    okay: "まあまあ",
    disliked: "好きじゃない",
    hidden: "非表示",
  },
  rate: "評価",
  removeRating: "評価を取り消す",
  hide: "非表示",
  hideHint: "非表示：興味なし・プレイ済み。好みには影響しません。",
  unhide: "表示に戻す",
  undo: "元に戻す",
  toast: {
    rated: (title, tier) => `${title}：${tier}`,
    hidden: (title) => `${title} を非表示にしました`,
    removed: (title) => `${title} の評価を取り消しました`,
  },
  modes: { players: "プレイヤーの好み", tags: "似ているゲーム" },
  match: (pct) => `一致度 ${pct}%`,
  meta: (year, positive) => `${year}年 · 好評 ${positive}%`,
  metaConsoles: (year, consoles) => `${year}年 · ${consoles}`,
  backcompat: "360（後方互換）",
  reasonPlayers: (pct, title) => (pct >= 1 ? `「${title}」好きの${pct}%が高評価` : `「${title}」好きに人気`),
  reasonPlayed: (pct, title) => (pct >= 1 ? `「${title}」プレイヤーの${pct}%がプレイ` : `「${title}」プレイヤーに人気`),
  progress: { playstation: "トロフィー", xbox: "実績" },
  reasonTags: (title, tags) => (tags.length ? `「${title}」に近い：${tags.join("、")}` : `「${title}」に近い`),
  forYou: {
    title: "あなたへのおすすめ",
    basedOn: (n) => `評価した${n}本のゲームから`,
    edit: "編集",
    notePlayers: (until) =>
      `あなたが好きなゲームを高評価したプレイヤーが、ほかに高評価したゲームです（${until}までのSteamレビュー4,100万件）。新しいゲームは「似ているゲーム」にだけ表示されます。`,
    noteConsole: (platform, players, progress, until) =>
      `あなたのゲームをプレイした${platform}のプレイヤーが、ほかにプレイしたゲームです（ほかの人より深く遊んだゲームを重視）。${players}人のライブラリと${progress}から（${until}まで）。`,
    tagsLater: (platform) => `${platform}の「似ているゲーム」、カバー画像、日本語タイトルは今後対応予定です。`,
    noteTags: "好きなゲームとタグ（ジャンル・雰囲気・スタイル）が近いゲームです。",
    startTitle: "知っているゲームから始めましょう",
    startBody: "プレイしたゲームを検索するか、下の人気ゲームを評価してください。1本「好き」にするとすぐにおすすめが出ます。",
    needLike: "おすすめを出すには、1本以上「好き」にしてください。「まあまあ」は少しだけ効き、「好きじゃない」はおすすめに出なくなるだけです。",
    popular: (platform) => `${platform}の人気ゲーム`,
    noMatches: "この条件に合うゲームはありません。",
    clearFilters: "条件をクリア",
    showMore: "もっと見る",
    soonTag: "準備中",
    soonTitle: (platform) => `${platform}のおすすめは準備中です`,
    soonBody: {
      playstation: "PS5・PS4のおすすめを、実際のプレイヤーのライブラリとトロフィーの進み具合から作っています。",
      xbox: "Xbox Series X|S・Xbox One・後方互換のXbox 360のおすすめを、実際のプレイヤーのライブラリと実績から作っています。",
      switch:
        "Switch 2・Switchは「似ているゲーム」（ジャンルやスタイルで探す）に対応予定です。任天堂はプレイヤーデータを公開していないため、「プレイヤーの好み」はありません。",
    },
    soonFoot: "どのプラットフォームでつけた評価も保存され、ここのおすすめにも反映されます。",
    onlyTags: "Switchは「似ているゲーム」のみです（任天堂はプレイヤーデータを公開していません）。",
  },
  price: {
    free: "無料",
    notSold: (store) => `${store}では販売なし`,
    ends: (day) => `${day}までセール`,
    store: { us: "米国ストア", jp: "日本ストア" },
  },
  sales: {
    title: "Steamセール",
    lead: (n, store, when) => `${store}でセール中：${n}本 · ${when}時点の価格`,
    changeStore: "ストアを変更",
    minLabel: "割引率",
    anyCut: "すべて",
    atLeast: (pct) => `${pct}%オフ以上`,
    sortLabel: "並び順",
    sort: { match: "好みに近い順", discount: "割引率順", popular: "レビュー数順" },
    noteMatch: (mode) => `好みに近いゲーム（${mode}）から順に、そのあとはレビューが多い順です。`,
    noteSort: { discount: "割引率が大きい順です。", popular: "レビューが多い順です。" },
    noteNoTaste: "ゲームを「好き」にすると、好みに近い順に並べられます。",
    noteStale: "価格は最後の更新時点のものです。購入前にSteamで確認してください。",
    none: "この条件に合うセール中のゲームはありません。",
    noPrices: "Steamの価格はまだ取得されていません。",
  },
  update: {
    button: "今すぐ更新",
    running: (elapsed) => `更新中… ${elapsed}`,
    estimating: "残り時間を計算中…",
    left: (minutes) => (minutes < 1 ? "残り1分未満" : `残り約${minutes}分`),
    hint: "「今すぐ更新」で、Steamから新しいゲーム・価格・セールを取得します（約10分）。Windowsが毎朝も自動で実行します。",
    done: (summary) => `更新しました。${summary}`,
    failed: "更新に失敗しました。前回のデータはそのまま使えます。",
  },
  filters: {
    button: "絞り込み",
    released: "発売年",
    from: "から",
    to: "まで",
    any: "指定なし",
    japanese: "日本語対応",
    japanesePartial: "このプラットフォームは、言語情報がないゲームが多くあります。",
    onSale: "セール中のみ",
    reset: "リセット",
  },
  rated: {
    title: "マイゲーム",
    likedTitle: "好き",
    likedEmpty: "「大好き」「好き」にしたゲームがここに表示されます。似たゲームがおすすめの上位に来ます。",
    okayTitle: "まあまあ",
    okayEmpty: "「まあまあ」にしたゲームがここに表示されます。もうおすすめには出ませんが、好みには少しだけ反映されます。",
    dislikedTitle: "好きじゃない",
    dislikedEmpty: "「好きじゃない」にしたゲームがここに表示されます。おすすめには出ません。",
    hiddenTitle: "非表示",
    hiddenEmpty: "非表示にしたゲームはおすすめに出ません。好みにも影響しません。",
    missing: (n: number) => `評価したゲームのうち${n}本が今日のゲーム一覧にないため、表示できません（毎日の更新で外れた新作など）。`,
    removeMissing: "その評価を削除",
  },
  dialog: {
    close: "閉じる",
    why: "おすすめの理由",
    reasonPlayers: (pct, title) =>
      pct >= 1
        ? `「${title}」を高評価したプレイヤーの${pct}%が、このゲームも高評価しています。`
        : `「${title}」を高評価したプレイヤーが、このゲームも高評価しています。`,
    reasonPlayed: (pct, title) =>
      pct >= 1
        ? `「${title}」をプレイした人の${pct}%が、このゲームもプレイしています。`
        : `「${title}」をプレイした人が、このゲームもプレイしています。`,
    reasonTags: (title, tags) =>
      tags.length ? `「${title}」と共通のタグ：${tags.join("、")}` : `「${title}」とタグが近いゲームです。`,
    reviews: (positive, n) => `レビュー${n}件中 好評 ${positive}%`,
    players: (n) => `データ内のプレイヤー ${n}人`,
    rateOnly: {
      playstation: (consoles) =>
        `${consoles}のゲーム：評価するとおすすめに反映されますが、PS5では${consoles}のゲームを遊べないため、おすすめには出ません。`,
      xbox: () =>
        "Xbox 360のゲーム：評価するとおすすめに反映されますが、後方互換に対応しておらず今のXboxでは遊べないため、おすすめには出ません。",
    },
    backcompat: "Xbox Series X|SとXbox Oneで遊べるXbox 360のゲームです（後方互換）。",
    tags: "タグ",
    store: (store) => `${store}で見る`,
    japanese: "日本語対応",
  },
  settings: {
    title: "設定",
    language: "表示言語",
    languageHint: "メニューやサイトの文章の言語です。",
    titles: "ゲームのタイトル",
    titlesHint: "日本語を選ぶと、日本のストア名があるゲームはその名前で表示します。",
    store: "Steamの価格",
    storeHint: "どのSteamストアの価格とセールを表示するかを選びます。",
    storeUs: "米国 $",
    storeJp: "日本 ¥",
    ratings: "あなたの評価",
    ratingsHint: (n) =>
      `${n}本を評価済み。このブラウザにだけ保存されています。どの端末でも使えるログイン機能はv1.1で追加予定です。`,
    removeAll: "評価をすべて削除",
    confirmRemove: "評価をすべて削除しますか？元に戻せません。",
    data: "データ",
    dataSteam: (until, updated) => `Steam：プレイヤーデータは${until}まで。ストア情報・価格・セールは${updated}更新。`,
    dataDaily: "毎日更新されます。",
    dataConsole: (platform, players, progress, until) =>
      `${platform}：${players}人のライブラリと${progress}（${until}まで）。`,
    dataSoon: "Switch：準備中。",
  },
  carry: {
    title: "Game Scoutの評価を引き継ぐ",
    none: "このリンクには評価が入っていません。tools/read_game_ratings.py で作り直してください。",
    same: (n: number) => `${n}件の評価はすでにここにあります。`,
    ask: (here: number, incoming: number) =>
      `このサイトには別のゲーム評価が${here}件あります。Game Scoutの${incoming}件で置き換えますか？`,
    replace: "置き換える",
    keep: "今のままにする",
    kept: "変更はありません。今の評価はそのままです。",
    done: (n: number) => `${n}件の評価と設定をコピーしました。`,
    failed: "コピーできませんでした（ブラウザが保存を止めている可能性があります）。何も変更していません。",
    open: "マイゲームを開く",
  },
  about: {
    title: "Game Scoutについて",
    intro:
      "Game Scoutは、あなたが楽しんだゲームをもとに、Steam・PlayStation・Xbox・Switchのゲームをおすすめします。評価リストはひとつだけ。プラットフォームを切り替えて、それぞれで遊ぶゲームを探せます。",
    howTitle: "おすすめの仕組み",
    howPlayers:
      "プレイヤーの好み：好きなゲームそれぞれが、そのゲームのプレイヤーに人気のゲームに「投票」します。Steamでは実際のレビュー4,100万件を使っています。PlayStationとXboxにはレビューがないため、それぞれ約46,000人のライブラリを使います。プレイしたゲームが1票、ほかの人より深く遊んだゲームは6票です。",
    howTags: "似ているゲーム：好きなゲームのタグ（ジャンル・スタイル・雰囲気）から好みを割り出し、いちばん近いゲームを探します。",
    howRatings:
      "「大好き」は「好き」の2倍効き、「まあまあ」も少しだけ効きます（遊んだこと自体が好みを表すため）。「好きじゃない」のゲームはおすすめに出ませんが、似たゲームを下げることはしません。データでは、あるゲームを好きじゃなかった人も、それに似たゲームは好きなことが多く、下げるとおすすめの精度が落ちたためです。「非表示」は除外するだけです。",
    statusTitle: "プラットフォーム",
    statusSteam: "Steam：対応済み（米国・日本ストアの価格とセール付き）。",
    statusConsoles:
      "PlayStation・Xbox：「プレイヤーの好み」に対応。「似ているゲーム」、カバー画像、日本語タイトルは今後対応予定です。PS3・Vita・Xbox 360のゲームは評価でき、おすすめに反映されます。おすすめに出るのは、Xbox 360のゲームのうち今のXboxで遊べるもの（後方互換）だけです。",
    statusSoon: "Switch：準備中。",
    dataTitle: "データ",
    dataSteam: "Steamのレビューとタグ：Kaggle「Game Recommendations on Steam」（Anton Kozyriev）。",
    dataPrices:
      "Steamの価格・セール・レビューデータより新しいゲーム：Steamストア（毎日更新）。価格は最大1日前のものなので、購入前にSteamで確認してください。",
    dataConsoles:
      "PlayStation・Xboxのプレイヤーデータ：Kaggle「Gaming Profiles 2025」（Artyom Kruglov、CC0）。このデータセットに名前がないゲームの名前：元のプロジェクトGameStatsHub（CC0）。今のXboxで遊べるXbox 360のゲーム：Wikipedia「List of backward-compatible games for Xbox One and Series X/S」（CC BY-SA 4.0）。",
    privacyTitle: "あなたのデータ",
    privacy: "評価はこのブラウザにだけ保存され、どこにも送信されません。",
    notAffiliated:
      "Game Scoutは個人のプロジェクトです。Valve・Sony・Microsoft・任天堂とは関係ありません。ゲーム名とカバーアートは各権利者に帰属します。",
  },
  loading: "読み込み中…",
  loadError: "ゲームデータを読み込めませんでした。ページを再読み込みしてください。",
};

export const TEXTS = { en, ja };
