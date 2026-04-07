import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

import { auth, db } from "./firebase-config.js";

const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const authMessage = document.getElementById("authMessage");
const globalMessage = document.getElementById("globalMessage");
const logoutBtn = document.getElementById("logoutBtn");

const authScreen = document.getElementById("authScreen");
const appScreen = document.getElementById("appScreen");
const loadingOverlay = document.getElementById("loadingOverlay");

const loggedUserName = document.getElementById("loggedUserName");
const loggedUserRole = document.getElementById("loggedUserRole");
const userAvatar = document.getElementById("userAvatar");

const authStore = {
  firebaseUser: null,
  profile: null,
  ready: false
};

window.authStore = authStore;

function showLoading() {
  loadingOverlay?.classList.remove("hidden");
}

function hideLoading() {
  loadingOverlay?.classList.add("hidden");
}

function showMessage(target, message, type = "error") {
  if (!target) return;
  target.textContent = message;
  target.classList.remove("hidden", "success", "error", "info");
  target.classList.add(type);
}

function hideMessage(target) {
  if (!target) return;
  target.textContent = "";
  target.classList.add("hidden");
  target.classList.remove("success", "error", "info");
}

function getInitials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "EV";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatRole(role = "") {
  if (role === "admin") return "Administrador";
  if (role === "instrutor") return "Instrutor";
  return "Sem perfil";
}

function applyUserUI(profile) {
  if (!profile) return;

  if (loggedUserName) loggedUserName.textContent = profile.nome || "Usuário";
  if (loggedUserRole) loggedUserRole.textContent = formatRole(profile.perfil);
  if (userAvatar) userAvatar.textContent = getInitials(profile.nome || "EV");

  const isAdmin = profile.perfil === "admin";

  document.querySelectorAll(".admin-only").forEach((el) => {
    el.style.display = isAdmin ? "" : "none";
  });
}

function showAuthScreen() {
  authScreen?.classList.remove("hidden");
  appScreen?.classList.add("hidden");
}

function showAppScreen() {
  authScreen?.classList.add("hidden");
  appScreen?.classList.remove("hidden");
}

function clearAuthStore() {
  authStore.firebaseUser = null;
  authStore.profile = null;
  authStore.ready = true;
}

function setAuthStore(firebaseUser, profile) {
  authStore.firebaseUser = firebaseUser;
  authStore.profile = profile;
  authStore.ready = true;
}

function dispatchAuthReady() {
  window.dispatchEvent(
    new CustomEvent("auth-ready", {
      detail: {
        firebaseUser: authStore.firebaseUser,
        profile: authStore.profile,
        ready: authStore.ready
      }
    })
  );
}

async function fetchUserProfile(uid) {
  const ref = doc(db, "usuarios", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Perfil do usuário não encontrado no banco.");
  }

  const data = snap.data();

  if (!data.ativo) {
    throw new Error("Seu acesso está inativo. Fale com o administrador.");
  }

  return {
    uid,
    ...data
  };
}

function mapFirebaseAuthError(error) {
  const code = error?.code || "";

  switch (code) {
    case "auth/invalid-email":
      return "E-mail inválido.";
    case "auth/missing-password":
      return "Digite sua senha.";
    case "auth/invalid-credential":
      return "E-mail ou senha incorretos.";
    case "auth/user-disabled":
      return "Este usuário foi desativado.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Tente novamente mais tarde.";
    case "auth/network-request-failed":
      return "Falha de conexão. Verifique sua internet.";
    default:
      return error?.message || "Não foi possível entrar.";
  }
}

async function handleLogin(event) {
  event.preventDefault();
  hideMessage(authMessage);

  const email = loginEmail?.value.trim() || "";
  const password = loginPassword?.value || "";

  if (!email || !password) {
    showMessage(authMessage, "Preencha e-mail e senha.", "error");
    return;
  }

  try {
    showLoading();
    await setPersistence(auth, browserLocalPersistence);
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error("Erro no login:", error);
    showAuthScreen();
    showMessage(authMessage, mapFirebaseAuthError(error), "error");
    hideLoading();
  }
}

async function handleLogout() {
  try {
    showLoading();
    await signOut(auth);
  } catch (error) {
    console.error("Erro ao sair:", error);
    showMessage(globalMessage, "Não foi possível encerrar a sessão.", "error");
    hideLoading();
  }
}

function bootstrapAuth() {
  showLoading();

  onAuthStateChanged(auth, async (user) => {
    try {
      hideMessage(authMessage);

      if (!user) {
        clearAuthStore();
        if (loginForm) loginForm.reset();
        hideMessage(globalMessage);
        showAuthScreen();
        dispatchAuthReady();
        return;
      }

      const profile = await fetchUserProfile(user.uid);

      setAuthStore(user, profile);
      applyUserUI(profile);
      showAppScreen();
      showMessage(globalMessage, `Bem-vindo, ${profile.nome || "usuário"}.`, "success");
      dispatchAuthReady();
    } catch (error) {
      console.error("Erro ao validar sessão:", error);

      clearAuthStore();
      await signOut(auth).catch(() => {});
      showAuthScreen();
      showMessage(
        authMessage,
        error?.message || "Sua sessão não pôde ser validada.",
        "error"
      );
      dispatchAuthReady();
    } finally {
      hideLoading();
    }
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", handleLogin);
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", handleLogout);
}

bootstrapAuth();

export {
  authStore,
  handleLogout,
  fetchUserProfile
};