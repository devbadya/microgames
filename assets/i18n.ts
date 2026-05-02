/** UI locale — English / German with localStorage persistence */

export type SupportedLang = "en" | "de";

export const STORAGE_KEY = "microgames.locale";

export function normalizeLang(code: unknown): SupportedLang {
  const s = String(code ?? "").toLowerCase().slice(0, 8);
  if (s.startsWith("de")) return "de";
  return "en";
}

export function readStoredLang(): SupportedLang | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === "en" || raw === "de" ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredLang(lang: SupportedLang): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
}

export function detectInitialLang(): SupportedLang {
  const st = readStoredLang();
  if (st) return st;
  return normalizeLang(navigator.language);
}

const UI = {
  en: {
    pageTitle:
      "Microgames — arcade-style browser mini games",
    metaDesc:
      "Fast, playable mini games right in your browser — no install. Keyboard, taps, endless runs and classics.",
    skipToGames: "Skip to games",
    navGames: "Games",
    brandSub: "Instant browser games",
    heroEyebrow: "Browser · HTML5 · PlayCanvas",
    heroTitle: "Tiny games. Big grins.",
    heroLead:
      "Snack-sized browser games built to load instantly and keep you coming back. Jump, stack, dodge — keyboard or touch.",
    badgeInstant: "No install",
    badgeFree: "Free to play",
    badgeOpenSource: "Open source-friendly",
    searchLabel: "Search games",
    searchPlaceholder: "Search by name, genre, vibe…",
    sectionHeading: "Games",
    sectionLead: "Pick a title — all run instantly in-page.",
    playCta: "Play now",
    minShort: "min",
    footerSource: "Source on GitHub",
    footerTagline:
      "Built for speed, fairness, and a bit of nostalgia. Contributions welcome.",

    statusLoading: "Loading games…",
    statusError: "Could not load games. Check games.json or your connection.",
    searchStatusFiltered: "{visible} / {total} games shown",

    settingsOpenAria: "Open menu",
    settingsCloseAria: "Close menu",
    settingsTitle: "Menu",
    settingsSubtitle: "Preferences, accessibility, references",
    settingsLangHeading: "Language",
    settingsLangLead: "The whole site remembers your choice.",

    legalCardTitle: "Legal & judiciary reference",
    legalCardLead:
      "Brief context about how courts are organised in Germany and Germany’s place in EU judicial comparisons — for orientation only.",
    legalToggleShow: "Germany & EU justice overview",
    legalToggleHide: "Hide overview",
    legalP1:
      "Germany’s judiciary is organised federally. Ordinary civil and criminal litigation runs through local and regional courts (Amtsgerichte, Landgerichte) and higher regional courts (Oberlandesgerichte) up to the Federal Court of Justice (Bundesgerichtshof). The Bundesverfassungsgericht rules on constitutional issues under Germany’s Grundgesetz (Basic Law).",
    legalP2:
      "Comparisons of justice systems commonly look at indicators such as efficiency, quality of decisions, resource use, and independence. Public bodies regularly publish updates on their own cycles — numbers and rankings evolve year to year.",
    legalLinkEu: "EU Justice Scoreboard (European Commission)",
    legalLinkCoe: "CEPEJ (Council of Europe)",
    legalLinkBmjv: "German Federal Ministry of Justice (Bundesministerium der Justiz)",
    legalLinkBverfG: "Bundesverfassungsgericht",
    legalLinkEuBul: "— comparative efficiency, quality & independence benchmarks.",
    legalLinkCoeBul: "— CEPEJ methodology & country evaluations.",
    legalLinkBmjvBul: "— national policy portal.",
    legalLinkBverfGBul: "— official court site.",
    legalDisclaimer:
      "This overview is not legal advice. For binding obligations, verify with qualified counsel and official sources.",

    notFoundTitle: "Page not found",
    notFoundLead: "This URL doesn’t map to anything we ship.",
    notFoundHome: "Back to home",

    ariaPlayGame: "Play {title}",

    accountSignIn: "Sign in",
    accountCreate: "Create account",
    accountSignOut: "Sign out",
    accountMenuOpen: "Open account menu",
    accountChipLabel: "Signed in as {username}",
    accountModalHeading: "Your account",
    accountModalLeadSignIn:
      "Sign in to save your progress on this device. Accounts live only in your browser — nothing is sent to a server.",
    accountModalLeadRegister:
      "Create a local account to keep your handle on this device. Your password never leaves the browser.",
    accountTabSignIn: "Sign in",
    accountTabRegister: "Create account",
    accountFieldUsername: "Username",
    accountFieldUsernameHint: "3–32 letters, numbers, dashes or underscores.",
    accountFieldEmail: "Email",
    accountFieldEmailHint: "Used only for account recovery hints — never sent anywhere.",
    accountFieldPassword: "Password",
    accountFieldPasswordHint: "At least 10 characters, mix letters, numbers and symbols.",
    accountFieldConfirm: "Confirm password",
    accountTogglePasswordShow: "Show password",
    accountTogglePasswordHide: "Hide password",
    accountSubmitSignIn: "Sign in",
    accountSubmitRegister: "Create account & sign in",
    accountSwitchToRegister: "No account yet? Create one.",
    accountSwitchToLogin: "Already have an account? Sign in.",
    accountModalClose: "Close account dialog",
    accountErrorUsernameRequired: "Please enter a username.",
    accountErrorUsernameInvalid: "Use 3–32 letters, numbers, “-” or “_”.",
    accountErrorUsernameTaken: "That username is already in use on this device.",
    accountErrorEmailInvalid: "Enter a valid email address.",
    accountErrorPasswordShort: "Password must be at least 10 characters.",
    accountErrorPasswordWeak: "Add upper/lower case, numbers and a symbol.",
    accountErrorPasswordMismatch: "Passwords do not match.",
    accountErrorPasswordRequired: "Please enter your password.",
    accountErrorCredentials: "Username or password is incorrect.",
    accountErrorLocked: "Too many attempts. Try again in {minutes} min.",
    accountStrengthLabel: "Password strength",
    accountStrength_very_weak: "Very weak",
    accountStrength_weak: "Weak",
    accountStrength_fair: "Fair",
    accountStrength_strong: "Strong",
    accountStrength_excellent: "Excellent",
    accountWelcome: "Welcome back, {username}.",
    accountWelcomeNew: "Account created — welcome, {username}.",
    accountSignedOutToast: "Signed out.",
    accountInfoLocalOnly:
      "100% local — credentials are stored only in this browser. Clearing site data removes them.",
  },
  de: {
    pageTitle: "Microgames — kleine Arcade-Spiele im Browser",
    metaDesc:
      "Schnelle, spielbare Minispiele ohne Installation — direkt im Browser. Tastatur oder Touch.",
    skipToGames: "Zu den Spielen springen",
    navGames: "Spiele",
    brandSub: "Sofort im Browser spielbar",
    heroEyebrow: "Browser · HTML5 · PlayCanvas",
    heroTitle: "Mini-Games mit Maxi-Spaß.",
    heroLead:
      "Kurze Sessions, echte Hooks: Puzzle, Arcade und Reflex mit Tempo-Momenten direkt im Browser.",

    badgeInstant: "Ohne Installation",
    badgeFree: "Kostenlos spielbar",
    badgeOpenSource: "Community-freundlich",

    searchLabel: "Spiele durchsuchen",
    searchPlaceholder: "Nach Titel, Genre, Stichwort…",
    sectionHeading: "Spiele",
    sectionLead:
      "Einfach anklicken — alles läuft direkt in der Seite.",
    playCta: "Los geht's",
    minShort: "Min.",
    footerSource: "Quelltext auf GitHub",
    footerTagline:
      "Gebaut für Tempo und Fairness mit einem Hauch Retro. Mitmachen erwünscht.",

    statusLoading: "Spiele laden…",
    statusError:
      "Spiele konnten nicht geladen werden. Prüfen Sie games.json oder die Verbindung.",
    searchStatusFiltered: "{visible} von {total} Spielen angezeigt",

    settingsOpenAria: "Menü öffnen",
    settingsCloseAria: "Menü schließen",
    settingsTitle: "Menü",
    settingsSubtitle: "Einstellungen, Barrierefreiheit, Referenzen",
    settingsLangHeading: "Sprache",
    settingsLangLead: "Die gesamte Website merkt sich Ihre Auswahl.",

    legalCardTitle: "Rechtlicher & juristischer Orientierungsrahmen",
    legalCardLead:
      "Orientierung zum Aufbau deutscher Gerichte und deutschlandbezogener Daten in EU-Rechtsstatistik‑Vergleichen — ohne Rechtsberatung.",
    legalToggleShow: "Überblick Deutschland & EU (Justiz)",
    legalToggleHide: "Überblick ausblenden",

    legalP1:
      "Die deutsche Gerichtsbarkeit ist föderal gegliedert: Zivil- und Strafrecht verlaufen vor Amts- und Landgerichten, Oberlandesgerichte und beim Bundesgerichtshof bis zur höchsten Instanz bei ordentlicher Gerichtsbarkeit. Das Bundesverfassungsgericht entscheidet verfassungsrechtlich zur Grundlage des Grundgesetzes.",

    legalP2:
      "Ländervergleiche der Justiz betrachten u. a. Effizienz, Entscheidungsqualität und Unabhängigkeit der Rechtspflege. Daten werden von Ämtern und Organisationen jährlich bzw. thematisch neu veröffentlicht und sind jeweils an der Quelle gültig.",

    legalLinkEu: "EU Justice Scoreboard (Europäische Kommission)",
    legalLinkCoe: "CEPEJ (Europarat)",
    legalLinkBmjv:
      "Bundesministerium der Justiz (BMJ)",
    legalLinkBverfG: "Bundesverfassungsgericht",
    legalLinkEuBul: "— vergleichende Kennzahlen (Effizienz, Qualität, Unabhängigkeit).",
    legalLinkCoeBul: "— Methodik und Landesberichte der CEPEJ.",
    legalLinkBmjvBul: "— nationaler Policy-Kanal.",
    legalLinkBverfGBul: "— offizielle Institution.",
    legalDisclaimer:
      "Keine Rechtsberatung. Für verbindliche Auskünfte konsultieren Sie qualifizierte Beratung und die verlinkten Originalquellen.",

    notFoundTitle: "Seite nicht gefunden",
    notFoundLead: "Unter dieser Adresse liegt nichts Bereitgestelltes.",
    notFoundHome: "Zur Startseite",

    ariaPlayGame: "{title} starten",

    accountSignIn: "Anmelden",
    accountCreate: "Konto erstellen",
    accountSignOut: "Abmelden",
    accountMenuOpen: "Kontomenü öffnen",
    accountChipLabel: "Angemeldet als {username}",
    accountModalHeading: "Ihr Konto",
    accountModalLeadSignIn:
      "Melden Sie sich an, um Fortschritte auf diesem Gerät zu speichern. Konten existieren nur im Browser — nichts wird an einen Server gesendet.",
    accountModalLeadRegister:
      "Erstellen Sie ein lokales Konto, um Ihren Namen auf diesem Gerät zu behalten. Ihr Passwort verlässt den Browser nicht.",
    accountTabSignIn: "Anmelden",
    accountTabRegister: "Konto erstellen",
    accountFieldUsername: "Benutzername",
    accountFieldUsernameHint: "3–32 Zeichen: Buchstaben, Zahlen, „-“ oder „_“.",
    accountFieldEmail: "E-Mail",
    accountFieldEmailHint: "Nur für Wiederherstellungs-Hinweise — wird nirgendwohin gesendet.",
    accountFieldPassword: "Passwort",
    accountFieldPasswordHint: "Mindestens 10 Zeichen mit Buchstaben, Zahlen und einem Sonderzeichen.",
    accountFieldConfirm: "Passwort bestätigen",
    accountTogglePasswordShow: "Passwort anzeigen",
    accountTogglePasswordHide: "Passwort verbergen",
    accountSubmitSignIn: "Anmelden",
    accountSubmitRegister: "Konto erstellen & anmelden",
    accountSwitchToRegister: "Noch kein Konto? Jetzt erstellen.",
    accountSwitchToLogin: "Schon ein Konto? Anmelden.",
    accountModalClose: "Kontodialog schließen",
    accountErrorUsernameRequired: "Bitte einen Benutzernamen eingeben.",
    accountErrorUsernameInvalid: "Verwenden Sie 3–32 Zeichen: Buchstaben, Zahlen, „-“ oder „_“.",
    accountErrorUsernameTaken: "Dieser Benutzername ist bereits auf diesem Gerät vergeben.",
    accountErrorEmailInvalid: "Bitte eine gültige E-Mail eingeben.",
    accountErrorPasswordShort: "Das Passwort muss mindestens 10 Zeichen lang sein.",
    accountErrorPasswordWeak: "Buchstaben, Zahlen und ein Sonderzeichen ergänzen.",
    accountErrorPasswordMismatch: "Die Passwörter stimmen nicht überein.",
    accountErrorPasswordRequired: "Bitte das Passwort eingeben.",
    accountErrorCredentials: "Benutzername oder Passwort ist falsch.",
    accountErrorLocked: "Zu viele Versuche. Bitte in {minutes} Min. erneut versuchen.",
    accountStrengthLabel: "Passwortstärke",
    accountStrength_very_weak: "Sehr schwach",
    accountStrength_weak: "Schwach",
    accountStrength_fair: "Mittel",
    accountStrength_strong: "Stark",
    accountStrength_excellent: "Hervorragend",
    accountWelcome: "Willkommen zurück, {username}.",
    accountWelcomeNew: "Konto erstellt — willkommen, {username}.",
    accountSignedOutToast: "Abgemeldet.",
    accountInfoLocalOnly:
      "100 % lokal — die Zugangsdaten werden nur in diesem Browser gespeichert. Beim Löschen der Site-Daten verschwinden sie.",
  },
} satisfies Record<SupportedLang, Record<string, string>>;

export type UiKey = keyof (typeof UI)["en"];

let currentLang: SupportedLang = "en";

export function getLang(): SupportedLang {
  return currentLang;
}

export function setLang(lang: SupportedLang): void {
  currentLang = lang;
  writeStoredLang(lang);
  document.documentElement.lang = lang === "de" ? "de" : "en";
}

export function initLang(htmlDoc: HTMLElement): SupportedLang {
  currentLang = detectInitialLang();
  htmlDoc.lang = currentLang === "de" ? "de" : "en";
  return currentLang;
}

export function translate(key: UiKey, vars?: Record<string, string>): string {
  const v = UI[currentLang]?.[key] ?? UI.en[key];
  const raw = typeof v === "string" ? v : String(key);
  return vars ? fillTemplate(raw, vars) : raw;
}

/** Simple placeholder like `{title}` */
export function fillTemplate(raw: string, vars: Record<string, string>): string {
  let s = raw;
  for (const [k, v] of Object.entries(vars)) {
    s = s.split(`{${k}}`).join(v);
  }
  return s;
}

/** Apply `[data-i18n="key"]` textContent (use `data-i18n-attr-placeholder` separately if needed). */
export function applyDataI18n(root: ParentNode): void {
  const nodes = root.querySelectorAll("[data-i18n]");
  for (const el of nodes) {
    const key = el.getAttribute("data-i18n") as UiKey | null;
    if (!key || !(key in UI.en)) continue;
    if (el.hasAttribute("data-i18n-keep-children")) continue;
    el.textContent = translate(key);
  }

  root.querySelectorAll<HTMLAnchorElement>("a[data-i18n]").forEach((a) => {
    const aria = a.getAttribute("data-i18n-aria-label");
    if (!aria || !(aria in UI.en)) return;
    a.setAttribute("aria-label", translate(aria as UiKey));
  });

  root.querySelectorAll<HTMLMetaElement>('meta[data-i18n-content][name="description"]').forEach((m) => {
    const key = m.getAttribute("data-i18n-content") as UiKey | null;
    if (key && key in UI.en) {
      m.setAttribute("content", translate(key));
    }
  });

  root.querySelectorAll<HTMLButtonElement>('button[data-i18n-aria]').forEach((b) => {
    const ak = b.getAttribute("data-i18n-aria") as UiKey | null;
    if (ak && ak in UI.en) b.setAttribute("aria-label", translate(ak));
  });

  root.querySelectorAll<HTMLInputElement>("input[data-i18n-placeholder]").forEach((input) => {
    const key = input.getAttribute("data-i18n-placeholder") as UiKey | null;
    if (key && key in UI.en) input.placeholder = translate(key);
  });
}

export function setDocumentTitleFromKey(titleKey: UiKey): void {
  document.title = translate(titleKey);
}

export function humanGameCount(lang: SupportedLang, n: number): string {
  if (lang === "de") {
    return `${n} ${n === 1 ? "Spiel" : "Spiele"}`;
  }
  return `${n} game${n === 1 ? "" : "s"}`;
}

export function searchResultLine(visible: number, total: number, queryTrimmed: string): string {
  const lang = getLang();
  const q = queryTrimmed.trim();
  if (!q || visible === total) {
    return humanGameCount(lang, total);
  }
  return translate("searchStatusFiltered", {
    visible: String(visible),
    total: String(total),
  });
}
