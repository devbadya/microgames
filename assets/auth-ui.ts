/**
 * UI controller for the local auth modal and header chip.
 *
 * Renders/sees the markup that lives in `index.html`, but never reaches into
 * `auth.ts` storage internals. Keeping these layers separate means the auth
 * core stays unit-testable and the UI can be replaced wholesale without
 * touching the security-sensitive code paths.
 *
 * All user-controlled strings use `textContent` (never `innerHTML`) so a
 * compromised localStorage entry (or a malicious i18n placeholder) cannot
 * inject HTML into the page.
 */

import {
  AuthService,
  evaluatePasswordStrength,
  type LoginError,
  type Session,
  type StoredUser,
  type ValidationError,
} from "./auth";
import { translate, type UiKey } from "./i18n";

type Tab = "signin" | "register";

type ModalRefs = {
  modal: HTMLDialogElement;
  closeBtn: HTMLButtonElement;
  heading: HTMLElement;
  lead: HTMLElement;
  tabSignIn: HTMLButtonElement;
  tabRegister: HTMLButtonElement;
  formSignIn: HTMLFormElement;
  formRegister: HTMLFormElement;
  signInError: HTMLElement;
  registerError: HTMLElement;
  signInUsername: HTMLInputElement;
  signInPassword: HTMLInputElement;
  signInSubmit: HTMLButtonElement;
  registerUsername: HTMLInputElement;
  registerEmail: HTMLInputElement;
  registerPassword: HTMLInputElement;
  registerConfirm: HTMLInputElement;
  registerSubmit: HTMLButtonElement;
  strengthBar: HTMLElement;
  strengthLabel: HTMLElement;
};

type HeaderRefs = {
  signedOut: HTMLButtonElement;
  signedIn: HTMLElement;
  chipName: HTMLElement;
  chipMenu: HTMLButtonElement;
  signOutBtn: HTMLButtonElement;
  toast: HTMLElement;
};

const ERROR_KEYS: Record<ValidationError, UiKey> = {
  username_required: "accountErrorUsernameRequired",
  username_invalid: "accountErrorUsernameInvalid",
  username_taken: "accountErrorUsernameTaken",
  email_invalid: "accountErrorEmailInvalid",
  password_too_short: "accountErrorPasswordShort",
  password_weak: "accountErrorPasswordWeak",
  password_mismatch: "accountErrorPasswordMismatch",
};

const LOGIN_ERROR_KEYS: Record<Exclude<LoginError, "account_locked">, UiKey> = {
  credentials_invalid: "accountErrorCredentials",
  username_required: "accountErrorUsernameRequired",
  password_required: "accountErrorPasswordRequired",
};

function findEl<T extends HTMLElement>(selector: string): T | null {
  return document.querySelector(selector) as T | null;
}

function readModalRefs(): ModalRefs | null {
  const modal = findEl<HTMLDialogElement>("#authModal");
  if (!modal) return null;
  const closeBtn = modal.querySelector<HTMLButtonElement>("[data-auth-close]");
  const heading = modal.querySelector<HTMLElement>(".authModalTitle");
  const lead = modal.querySelector<HTMLElement>(".authModalLead");
  const tabSignIn = modal.querySelector<HTMLButtonElement>('[data-auth-tab="signin"]');
  const tabRegister = modal.querySelector<HTMLButtonElement>('[data-auth-tab="register"]');
  const formSignIn = modal.querySelector<HTMLFormElement>('[data-auth-form="signin"]');
  const formRegister = modal.querySelector<HTMLFormElement>('[data-auth-form="register"]');
  const signInError = modal.querySelector<HTMLElement>('[data-auth-error="signin"]');
  const registerError = modal.querySelector<HTMLElement>('[data-auth-error="register"]');
  const signInUsername = modal.querySelector<HTMLInputElement>("#authSignInUsername");
  const signInPassword = modal.querySelector<HTMLInputElement>("#authSignInPassword");
  const signInSubmit = modal.querySelector<HTMLButtonElement>("[data-auth-submit-signin]");
  const registerUsername = modal.querySelector<HTMLInputElement>("#authRegUsername");
  const registerEmail = modal.querySelector<HTMLInputElement>("#authRegEmail");
  const registerPassword = modal.querySelector<HTMLInputElement>("#authRegPassword");
  const registerConfirm = modal.querySelector<HTMLInputElement>("#authRegConfirm");
  const registerSubmit = modal.querySelector<HTMLButtonElement>(
    "[data-auth-submit-register]",
  );
  const strengthBar = modal.querySelector<HTMLElement>(".authStrengthBarFill");
  const strengthLabel = modal.querySelector<HTMLElement>(".authStrengthValue");

  if (
    !closeBtn ||
    !heading ||
    !lead ||
    !tabSignIn ||
    !tabRegister ||
    !formSignIn ||
    !formRegister ||
    !signInError ||
    !registerError ||
    !signInUsername ||
    !signInPassword ||
    !signInSubmit ||
    !registerUsername ||
    !registerEmail ||
    !registerPassword ||
    !registerConfirm ||
    !registerSubmit ||
    !strengthBar ||
    !strengthLabel
  ) {
    return null;
  }

  return {
    modal,
    closeBtn,
    heading,
    lead,
    tabSignIn,
    tabRegister,
    formSignIn,
    formRegister,
    signInError,
    registerError,
    signInUsername,
    signInPassword,
    signInSubmit,
    registerUsername,
    registerEmail,
    registerPassword,
    registerConfirm,
    registerSubmit,
    strengthBar,
    strengthLabel,
  };
}

function readHeaderRefs(): HeaderRefs | null {
  const signedOut = findEl<HTMLButtonElement>("#authSignedOutBtn");
  const signedIn = findEl<HTMLElement>("#authSignedInChip");
  if (!signedOut || !signedIn) return null;
  const chipName = signedIn.querySelector<HTMLElement>(".authChipName");
  const chipMenu = signedIn.querySelector<HTMLButtonElement>(".authChipBtn");
  const signOutBtn = signedIn.querySelector<HTMLButtonElement>("[data-auth-signout]");
  const toast = findEl<HTMLElement>("#authToast");
  if (!chipName || !chipMenu || !signOutBtn || !toast) return null;
  return { signedOut, signedIn, chipName, chipMenu, signOutBtn, toast };
}

function setBusy(btn: HTMLButtonElement, busy: boolean): void {
  btn.disabled = busy;
  btn.setAttribute("aria-busy", String(busy));
}

function activateTab(refs: ModalRefs, tab: Tab): void {
  const isSignIn = tab === "signin";
  refs.tabSignIn.setAttribute("aria-selected", String(isSignIn));
  refs.tabSignIn.classList.toggle("authTab--active", isSignIn);
  refs.tabRegister.setAttribute("aria-selected", String(!isSignIn));
  refs.tabRegister.classList.toggle("authTab--active", !isSignIn);
  refs.formSignIn.hidden = !isSignIn;
  refs.formRegister.hidden = isSignIn;
  refs.lead.textContent = translate(
    isSignIn ? "accountModalLeadSignIn" : "accountModalLeadRegister",
  );
  if (isSignIn) refs.signInUsername.focus();
  else refs.registerUsername.focus();
}

function showError(el: HTMLElement, message: string): void {
  el.textContent = message;
  el.hidden = !message;
}

function clearError(el: HTMLElement): void {
  el.textContent = "";
  el.hidden = true;
}

function lockedMessage(lockedUntil: number, now: number): string {
  const minutes = Math.max(1, Math.ceil((lockedUntil - now) / 60_000));
  return translate("accountErrorLocked", { minutes: String(minutes) });
}

function showStrength(refs: ModalRefs, raw: string): void {
  if (!raw) {
    refs.strengthBar.style.width = "0%";
    refs.strengthBar.dataset.score = "0";
    refs.strengthLabel.textContent = "—";
    return;
  }
  const { score, label } = evaluatePasswordStrength(raw);
  const pct = (score / 4) * 100;
  refs.strengthBar.style.width = `${pct}%`;
  refs.strengthBar.dataset.score = String(score);
  refs.strengthLabel.textContent = translate(`accountStrength_${label}` as UiKey);
}

function describeUser(user: StoredUser | null): string {
  if (!user) return "";
  return user.username;
}

export type AuthUiHandle = {
  refresh: () => void;
  open: (tab?: Tab) => void;
  close: () => void;
};

export function initAuthUi(authService: AuthService): AuthUiHandle | null {
  const modalRefs = readModalRefs();
  const headerRefs = readHeaderRefs();
  if (!modalRefs || !headerRefs) return null;

  let toastTimer: number | null = null;

  function showToast(message: string): void {
    headerRefs!.toast.textContent = message;
    headerRefs!.toast.classList.add("authToast--visible");
    if (toastTimer !== null) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      headerRefs!.toast.classList.remove("authToast--visible");
    }, 2800);
  }

  function refresh(): void {
    const session = authService.getActiveSession();
    const user = session ? authService.getActiveUser() : null;
    if (session && user) {
      headerRefs!.signedOut.hidden = true;
      headerRefs!.signedIn.hidden = false;
      headerRefs!.chipName.textContent = describeUser(user);
      headerRefs!.chipMenu.setAttribute(
        "aria-label",
        translate("accountChipLabel", { username: user.username }),
      );
      document.body.classList.add("isAuthenticated");
    } else {
      headerRefs!.signedOut.hidden = false;
      headerRefs!.signedIn.hidden = true;
      document.body.classList.remove("isAuthenticated");
    }
  }

  function open(tab: Tab = authService.hasAccounts() ? "signin" : "register"): void {
    clearError(modalRefs!.signInError);
    clearError(modalRefs!.registerError);
    modalRefs!.formSignIn.reset();
    modalRefs!.formRegister.reset();
    showStrength(modalRefs!, "");
    activateTab(modalRefs!, tab);
    if (typeof modalRefs!.modal.showModal === "function") {
      try {
        modalRefs!.modal.showModal();
      } catch {
        modalRefs!.modal.setAttribute("open", "");
      }
    } else {
      modalRefs!.modal.setAttribute("open", "");
    }
  }

  function close(): void {
    if (modalRefs!.modal.open) {
      modalRefs!.modal.close();
    } else {
      modalRefs!.modal.removeAttribute("open");
    }
  }

  modalRefs.closeBtn.addEventListener("click", () => close());
  modalRefs.modal.addEventListener("close", () => {
    /* native close handled */
  });
  modalRefs.modal.addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });

  modalRefs.tabSignIn.addEventListener("click", () => activateTab(modalRefs, "signin"));
  modalRefs.tabRegister.addEventListener("click", () => activateTab(modalRefs, "register"));

  // password show/hide toggles
  document.querySelectorAll<HTMLButtonElement>("[data-auth-toggle-password]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-auth-toggle-password");
      if (!targetId) return;
      const input = document.getElementById(targetId) as HTMLInputElement | null;
      if (!input) return;
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.setAttribute("aria-pressed", String(!showing));
      btn.setAttribute(
        "aria-label",
        translate(showing ? "accountTogglePasswordShow" : "accountTogglePasswordHide"),
      );
    });
  });

  modalRefs.registerPassword.addEventListener("input", () => {
    showStrength(modalRefs, modalRefs.registerPassword.value);
  });

  // sign in submission
  modalRefs.formSignIn.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError(modalRefs.signInError);
    setBusy(modalRefs.signInSubmit, true);
    try {
      const result = await authService.login({
        username: modalRefs.signInUsername.value,
        password: modalRefs.signInPassword.value,
      });
      if (result.ok) {
        const username = result.session.username;
        modalRefs.signInPassword.value = "";
        close();
        refresh();
        showToast(translate("accountWelcome", { username }));
      } else if (result.error === "account_locked") {
        showError(modalRefs.signInError, lockedMessage(result.lockedUntil ?? 0, Date.now()));
      } else {
        const key = LOGIN_ERROR_KEYS[result.error];
        showError(modalRefs.signInError, translate(key));
      }
    } finally {
      setBusy(modalRefs.signInSubmit, false);
    }
  });

  // registration submission
  modalRefs.formRegister.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError(modalRefs.registerError);
    setBusy(modalRefs.registerSubmit, true);
    try {
      const result = await authService.register({
        username: modalRefs.registerUsername.value,
        email: modalRefs.registerEmail.value,
        password: modalRefs.registerPassword.value,
        confirmPassword: modalRefs.registerConfirm.value,
      });
      if (result.ok) {
        const username = (result.session as Session).username;
        modalRefs.registerPassword.value = "";
        modalRefs.registerConfirm.value = "";
        close();
        refresh();
        showToast(translate("accountWelcomeNew", { username }));
      } else {
        const first = result.errors[0];
        showError(modalRefs.registerError, translate(ERROR_KEYS[first]));
      }
    } finally {
      setBusy(modalRefs.registerSubmit, false);
    }
  });

  // header buttons
  headerRefs.signedOut.addEventListener("click", () =>
    open(authService.hasAccounts() ? "signin" : "register"),
  );

  headerRefs.signOutBtn.addEventListener("click", () => {
    authService.logout();
    refresh();
    showToast(translate("accountSignedOutToast"));
  });

  document.querySelectorAll<HTMLElement>("[data-auth-switch-tab]").forEach((el) => {
    el.addEventListener("click", () => {
      const target = el.getAttribute("data-auth-switch-tab") as Tab | null;
      if (target === "signin" || target === "register") activateTab(modalRefs, target);
    });
  });

  refresh();

  return { refresh, open, close };
}
