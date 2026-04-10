import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

import {
  initializeApp,
  deleteApp
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";

import { app, db } from "./firebase-config.js";

const DISTRITO_FIXO = "Esplanada";

const state = {
  user: null,
  interessados: [],
  series: [],
  usuarios: [],
  locais: [],
  activeSection: "dashboardSection"
};

const statusOptions = [
  "Todos",
  "Ativo",
  "Pausado",
  "Desinteressado",
  "Concluído",
  "Pronto para apelo",
  "Pronto para batismo"
];

const interestOptions = ["Todos", "Alto", "Médio", "Baixo"];

/* =========================
   ELEMENTOS
========================= */
const pageTitle = document.getElementById("pageTitle");
const globalMessage = document.getElementById("globalMessage");
const loadingOverlay = document.getElementById("loadingOverlay");

const metricsGrid = document.getElementById("metricsGrid");
const recentList = document.getElementById("recentList");
const attentionList = document.getElementById("attentionList");

const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const interestFilter = document.getElementById("interestFilter");
const serieFilter = document.getElementById("serieFilter");

const interessadosTable = document.getElementById("interessadosTable");
const seriesList = document.getElementById("seriesList");
const usuariosList = document.getElementById("usuariosList");
const locaisList = document.getElementById("locaisList");

const interessadoModalBackdrop = document.getElementById("interessadoModalBackdrop");
const closeInteressadoModalBtn = document.getElementById("closeInteressadoModalBtn");
const interessadoModalTitle = document.getElementById("interessadoModalTitle");

const interessadoForm = document.getElementById("interessadoForm");
const interessadoId = document.getElementById("interessadoId");
const nome = document.getElementById("nome");
const telefone = document.getElementById("telefone");
const endereco = document.getElementById("endereco");
const igreja = document.getElementById("igreja");
const distrito = document.getElementById("distrito");
const instrutor = document.getElementById("instrutor"); // responsável
const serieId = document.getElementById("serieId");
const estudoAtual = document.getElementById("estudoAtual");
const progressoPreview = document.getElementById("progressoPreview");
const status = document.getElementById("status");
const interesse = document.getElementById("interesse");
const ultimoContato = document.getElementById("ultimoContato");
const obsRapidas = document.getElementById("obsRapidas");
const observacoes = document.getElementById("observacoes");
const resetFormBtn = document.getElementById("resetFormBtn");

const openInteressadoModalBtn = document.getElementById("openInteressadoModalBtn");
const openInteressadoModalBtn2 = document.getElementById("openInteressadoModalBtn2");

const serieForm = document.getElementById("serieForm");
const novaSerieNome = document.getElementById("novaSerieNome");
const novaSerieTotal = document.getElementById("novaSerieTotal");

const localForm = document.getElementById("localForm");
const novoLocalNome = document.getElementById("novoLocalNome");
const novoLocalTipo = document.getElementById("novoLocalTipo");

const userForm = document.getElementById("userForm");
const novoUsuarioNome = document.getElementById("novoUsuarioNome");
const novoUsuarioPerfil = document.getElementById("novoUsuarioPerfil");
const novoUsuarioIgreja = document.getElementById("novoUsuarioIgreja");
const novoUsuarioDistrito = document.getElementById("novoUsuarioDistrito");
const novoUsuarioUsername = document.getElementById("novoUsuarioUsername");
const novoUsuarioSenhaLocal = document.getElementById("novoUsuarioSenhaLocal");
const novoUsuarioEmail = document.getElementById("novoUsuarioEmail");
const novoUsuarioSenha = document.getElementById("novoUsuarioSenha");

const novoUsuarioUsernameGroup = document.getElementById("novoUsuarioUsernameGroup");
const novoUsuarioSenhaLocalGroup = document.getElementById("novoUsuarioSenhaLocalGroup");
const novoUsuarioEmailGroup = document.getElementById("novoUsuarioEmailGroup");
const novoUsuarioSenhaGroup = document.getElementById("novoUsuarioSenhaGroup");

/* =========================
   HELPERS
========================= */
function showLoading() {
  loadingOverlay?.classList.remove("hidden");
}

function hideLoading() {
  loadingOverlay?.classList.add("hidden");
}

function showMessage(message, type = "info") {
  if (!globalMessage) return;
  globalMessage.textContent = message;
  globalMessage.classList.remove("hidden", "success", "error", "info");
  globalMessage.classList.add(type);
}

function clearMessage() {
  if (!globalMessage) return;
  globalMessage.textContent = "";
  globalMessage.classList.add("hidden");
  globalMessage.classList.remove("success", "error", "info");
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeText(text = "") {
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function slug(text = "") {
  return normalizeText(text).replace(/\s+/g, "-");
}

function isAdmin() {
  return state.user?.perfil === "admin";
}

function isDistrital() {
  return state.user?.perfil === "distrital";
}

function isLocal() {
  return state.user?.perfil === "local";
}

function isMembro() {
  return state.user?.perfil === "membro";
}

function canManageSeries() {
  return isAdmin();
}

function canManageLocais() {
  return isAdmin();
}

function canSeeUsersSection() {
  return isAdmin() || isDistrital() || isLocal();
}

function canCreateUsers() {
  return isAdmin() || isDistrital() || isLocal();
}

function getAllowedProfilesToCreate() {
  if (isAdmin()) return ["admin", "distrital", "local", "membro"];
  if (isDistrital()) return ["local", "membro"];
  if (isLocal()) return ["membro"];
  return [];
}

function formatRole(role = "") {
  switch (role) {
    case "admin":
      return "Administrador";
    case "distrital":
      return "Líder Distrital";
    case "local":
      return "Líder Local";
    case "membro":
      return "Membro";
    default:
      return role || "-";
  }
}

function calcProgress(estudoAtualValue, totalEstudosValue) {
  const atual = Math.max(0, Number(estudoAtualValue || 0));
  const total = Math.max(1, Number(totalEstudosValue || 1));
  const capped = Math.min(atual, total);
  const porcentagem = Math.round((capped / total) * 100);
  const faltantes = Math.max(0, total - capped);
  return { capped, total, porcentagem, faltantes };
}

function daysSince(dateStr) {
  if (!dateStr) return 999;
  const today = new Date();
  const date = new Date(`${dateStr}T00:00:00`);
  const diff = today - date;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function isAtRisk(item) {
  return (
    (item.status === "Pausado" ||
      item.status === "Desinteressado" ||
      daysSince(item.ultimoContato) > 14) &&
    item.status !== "Concluído"
  );
}

function isDecision(item) {
  return item.status === "Pronto para apelo" || item.status === "Pronto para batismo";
}

function sortByUpdatedDesc(arr) {
  return [...arr].sort((a, b) => {
    const aTime = new Date(a.atualizadoEm || a.updatedAt || 0).getTime();
    const bTime = new Date(b.atualizadoEm || b.updatedAt || 0).getTime();
    return bTime - aTime;
  });
}

function sortByName(arr) {
  return [...arr].sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
}

function getSerieById(id) {
  return state.series.find((s) => s.id === id);
}

function getLocalById(id) {
  return state.locais.find((l) => l.id === id);
}

function getUserById(id) {
  return state.usuarios.find((u) => u.id === id);
}

function getCurrentUserLocalId() {
  return state.user?.igrejaId || state.user?.localId || "";
}

function getCurrentUserLocalName() {
  return state.user?.igrejaNome || state.user?.localNome || state.user?.igreja || "";
}

function getSectionTitle(sectionId) {
  const map = {
    dashboardSection: "Dashboard",
    interessadosSection: "Interessados",
    usuariosSection: "Usuários",
    locaisSection: "Locais",
    catalogoSection: "Catálogo de Estudos"
  };
  return map[sectionId] || "Esplanada Viva";
}

function getAllowedSections() {
  const base = ["dashboardSection", "interessadosSection"];
  if (canSeeUsersSection()) base.push("usuariosSection");
  if (canManageLocais()) base.push("locaisSection");
  if (canManageSeries()) base.push("catalogoSection");
  return base;
}

function setSection(sectionId) {
  const allowed = getAllowedSections();
  const safeSection = allowed.includes(sectionId) ? sectionId : "dashboardSection";

  state.activeSection = safeSection;

  document.querySelectorAll(".page-section").forEach((section) => {
    section.classList.toggle("active", section.id === safeSection);
  });

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.section === safeSection);
  });

  if (pageTitle) {
    pageTitle.textContent = getSectionTitle(safeSection);
  }
}

function applyRoleUI() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    const section = btn.dataset.section;
    const allowed = getAllowedSections().includes(section);
    btn.style.display = allowed ? "" : "none";
  });

  document.querySelectorAll(".admin-only").forEach((el) => {
    el.style.display = isAdmin() ? "" : "none";
  });

  document.querySelectorAll(".admin-or-distrital").forEach((el) => {
    el.style.display = isAdmin() || isDistrital() ? "" : "none";
  });

  document.querySelectorAll(".local-only").forEach((el) => {
    el.style.display = isLocal() ? "" : "none";
  });

  document.querySelectorAll(".membro-only").forEach((el) => {
    el.style.display = isMembro() ? "" : "none";
  });

  if (!getAllowedSections().includes(state.activeSection)) {
    state.activeSection = "dashboardSection";
  }

  setSection(state.activeSection);
}

function buildEmailAuth(username, igrejaId) {
  const safeUsername = normalizeText(username).replace(/[^a-z0-9._-]/g, "");
  const safeChurch = String(igrejaId || "").replace(/[^a-zA-Z0-9]/g, "");
  return `${safeUsername}__${safeChurch}@app.esplanadaviva.local`;
}

/* =========================
   FIRESTORE LOAD
========================= */
async function loadSeries() {
  const snap = await getDocs(collection(db, "series"));
  state.series = snap.docs.map((item) => ({
    id: item.id,
    ...item.data()
  }));
}

async function loadLocais() {
  const snap = await getDocs(collection(db, "locais"));
  state.locais = snap.docs
    .map((item) => ({
      id: item.id,
      ...item.data()
    }))
    .filter((item) => item.ativo !== false);
}

async function loadUsuarios() {
  let snap;

  if (isAdmin() || isDistrital()) {
    snap = await getDocs(collection(db, "usuarios"));
    state.usuarios = snap.docs
      .map((item) => ({
        id: item.id,
        ...item.data()
      }))
      .filter((item) => item.ativo !== false);
    return;
  }

  if (isLocal()) {
    const localId = getCurrentUserLocalId();
    snap = await getDocs(
      query(collection(db, "usuarios"), where("igrejaId", "==", localId))
    );
    state.usuarios = snap.docs
      .map((item) => ({
        id: item.id,
        ...item.data()
      }))
      .filter((item) => item.ativo !== false);
    return;
  }

  if (isMembro()) {
    state.usuarios = state.user ? [state.user] : [];
    return;
  }

  state.usuarios = [];
}

async function loadInteressados() {
  const snap = await getDocs(collection(db, "interessados"));
  let data = snap.docs.map((item) => ({
    id: item.id,
    ...item.data()
  }));

  if (isAdmin() || isDistrital()) {
    state.interessados = data;
    return;
  }

  if (isLocal()) {
    const localId = getCurrentUserLocalId();
    data = data.filter((item) => item.igrejaId === localId);
    state.interessados = data;
    return;
  }

  if (isMembro()) {
    data = data.filter((item) => item.criadoPorId === state.user.uid);
    state.interessados = data;
    return;
  }

  state.interessados = [];
}

async function refreshData() {
  if (!state.user) return;

  showLoading();
  clearMessage();

  try {
    await Promise.all([
      loadLocais(),
      loadSeries(),
      loadUsuarios(),
      loadInteressados()
    ]);
    renderAll();
  } catch (error) {
    console.error("Erro ao carregar dados:", error);
    showMessage("Não foi possível carregar os dados do sistema.", "error");
  } finally {
    hideLoading();
  }
}

/* =========================
   FILTROS
========================= */
function getVisibleInteressados() {
  return sortByUpdatedDesc(state.interessados);
}

function getFilteredInteressados() {
  let data = getVisibleInteressados();

  const search = normalizeText(searchInput?.value || "");
  const selectedStatus = statusFilter?.value || "Todos";
  const selectedInterest = interestFilter?.value || "Todos";
  const selectedSerie = serieFilter?.value || "Todas";

  if (search) {
    data = data.filter((item) => {
      return (
        normalizeText(item.nome).includes(search) ||
        normalizeText(item.telefone).includes(search) ||
        normalizeText(item.igrejaNome || item.igreja).includes(search) ||
        normalizeText(item.responsavelNome || "").includes(search) ||
        normalizeText(item.criadoPorNome || "").includes(search) ||
        normalizeText(item.serieNome || "").includes(search)
      );
    });
  }

  if (selectedStatus !== "Todos") {
    data = data.filter((item) => item.status === selectedStatus);
  }

  if (selectedInterest !== "Todos") {
    data = data.filter((item) => item.interesse === selectedInterest);
  }

  if (selectedSerie !== "Todas") {
    data = data.filter((item) => item.serieId === selectedSerie);
  }

  return data;
}

/* =========================
   RENDER FORM BASICO
========================= */
function renderStatusAndInterestOptions() {
  status.innerHTML = statusOptions
    .filter((item) => item !== "Todos")
    .map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`)
    .join("");

  interesse.innerHTML = interestOptions
    .filter((item) => item !== "Todos")
    .map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`)
    .join("");
}

function renderFilters() {
  if (statusFilter) {
    const current = statusFilter.value || "Todos";
    statusFilter.innerHTML = statusOptions
      .map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`)
      .join("");
    statusFilter.value = current;
  }

  if (interestFilter) {
    const current = interestFilter.value || "Todos";
    interestFilter.innerHTML = interestOptions
      .map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`)
      .join("");
    interestFilter.value = current;
  }

  if (serieFilter) {
    const current = serieFilter.value || "Todas";
    serieFilter.innerHTML =
      `<option value="Todas">Todas as séries</option>` +
      sortByName(state.series)
        .map((serie) => `<option value="${serie.id}">${escapeHtml(serie.nome)}</option>`)
        .join("");
    serieFilter.value = current;
  }
}

function renderSerieOptions() {
  if (!serieId) return;

  const current = serieId.value || "";
  serieId.innerHTML =
    `<option value="">Selecionar série</option>` +
    sortByName(state.series)
      .map((serie) => `<option value="${serie.id}">${escapeHtml(serie.nome)} (${serie.totalEstudos})</option>`)
      .join("");

  if (current) {
    serieId.value = current;
  }
}

function renderLocalOptions(targetSelect, { onlyCurrent = false, includeEmpty = true } = {}) {
  if (!targetSelect) return;

  let locais = [...state.locais];

  if (onlyCurrent) {
    const localId = getCurrentUserLocalId();
    locais = locais.filter((item) => item.id === localId);
  }

  locais = sortByName(locais);

  targetSelect.innerHTML =
    `${includeEmpty ? '<option value="">Selecionar igreja</option>' : ""}` +
    locais.map((item) => `<option value="${item.id}">${escapeHtml(item.nome)}</option>`).join("");
}

function renderInteressadoLocalOptions(selectedId = "") {
  if (!igreja) return;

  if (isLocal() || isMembro()) {
    renderLocalOptions(igreja, { onlyCurrent: true });
    igreja.value = getCurrentUserLocalId();
    igreja.disabled = true;
    return;
  }

  renderLocalOptions(igreja);
  igreja.disabled = false;

  if (selectedId) {
    igreja.value = selectedId;
  }
}

function getResponsibleUsersForCurrentContext() {
  if (isAdmin() || isDistrital()) {
    return sortByName(state.usuarios.filter((u) => u.ativo !== false));
  }

  if (isLocal()) {
    const localId = getCurrentUserLocalId();
    return sortByName(
      state.usuarios.filter((u) => u.ativo !== false && u.igrejaId === localId)
    );
  }

  if (isMembro()) {
    return state.user ? [state.user] : [];
  }

  return [];
}

function renderResponsavelOptions(selectedId = "") {
  if (!instrutor) return;

  const users = getResponsibleUsersForCurrentContext();

  instrutor.innerHTML =
    `<option value="">Selecionar responsável</option>` +
    users.map((u) => `<option value="${u.id}">${escapeHtml(u.nome)}</option>`).join("");

  if (isMembro()) {
    instrutor.value = state.user?.uid || "";
    instrutor.disabled = true;
    return;
  }

  instrutor.disabled = false;

  if (selectedId) {
    instrutor.value = selectedId;
  }
}

function updateProgressPreview() {
  const serie = getSerieById(serieId.value);
  const total = serie ? Number(serie.totalEstudos) : 0;
  const atual = Number(estudoAtual.value || 0);
  const progress = calcProgress(atual, total || 1);

  if (!total) {
    progressoPreview.textContent = "0 de 0 • 0% • faltam 0";
    return;
  }

  progressoPreview.textContent =
    `${Math.min(atual, total)} de ${total} • ${progress.porcentagem}% • faltam ${Math.max(0, total - Math.min(atual, total))}`;
}

/* =========================
   MODAL INTERESSADO
========================= */
function openInteressadoModal() {
  interessadoModalBackdrop?.classList.remove("hidden");
}

function closeInteressadoModal() {
  interessadoModalBackdrop?.classList.add("hidden");
}

function resetInteressadoForm() {
  interessadoForm?.reset();
  interessadoId.value = "";
  interessadoModalTitle.textContent = "Novo interessado";

  renderInteressadoLocalOptions();
  renderResponsavelOptions();
  renderSerieOptions();
  renderStatusAndInterestOptions();

  if (distrito) {
    distrito.value = DISTRITO_FIXO;
    distrito.readOnly = true;
  }

  status.value = "Ativo";
  interesse.value = "Médio";
  ultimoContato.value = new Date().toISOString().slice(0, 10);
  estudoAtual.value = 0;

  updateProgressPreview();
}

function fillInteressadoForm(item) {
  interessadoId.value = item.id;
  nome.value = item.nome || "";
  telefone.value = item.telefone || "";
  endereco.value = item.endereco || "";

  renderInteressadoLocalOptions(item.igrejaId || "");
  if (!igreja.disabled) {
    igreja.value = item.igrejaId || "";
  }

  renderResponsavelOptions(item.responsavelId || "");
  renderSerieOptions();
  serieId.value = item.serieId || "";

  estudoAtual.value = item.estudoAtual ?? 0;
  renderStatusAndInterestOptions();
  status.value = item.status || "Ativo";
  interesse.value = item.interesse || "Médio";
  ultimoContato.value = item.ultimoContato || "";
  observacoes.value = item.observacoes || "";

  if (distrito) {
    distrito.value = DISTRITO_FIXO;
    distrito.readOnly = true;
  }

  interessadoModalTitle.textContent = "Editar interessado";
  updateProgressPreview();
}

/* =========================
   DASHBOARD / TABELAS
========================= */
function renderMetrics() {
  const data = getVisibleInteressados();

  const metrics = [
    {
      label: "Total de interessados",
      value: data.length,
      className: "metric-card soft-blue"
    },
    {
      label: "Ativos",
      value: data.filter((item) => item.status === "Ativo").length,
      className: "metric-card soft-green"
    },
    {
      label: "Em risco",
      value: data.filter(isAtRisk).length,
      className: "metric-card soft-yellow"
    },
    {
      label: "Concluídos",
      value: data.filter((item) => item.status === "Concluído").length,
      className: "metric-card soft-green"
    },
    {
      label: "Prontos para decisão",
      value: data.filter(isDecision).length,
      className: "metric-card soft-blue"
    }
  ];

  metricsGrid.innerHTML = metrics
    .map(
      (item) => `
        <div class="${item.className}">
          <span class="metric-label">${escapeHtml(item.label)}</span>
          <strong class="metric-value">${item.value}</strong>
        </div>
      `
    )
    .join("");
}

function renderRecentList() {
  const data = getVisibleInteressados().slice(0, 6);

  if (!data.length) {
    recentList.innerHTML = `<div class="empty-state">Nenhum interessado encontrado.</div>`;
    return;
  }

  recentList.innerHTML = data
    .map((item) => {
      const p = calcProgress(item.estudoAtual, item.totalEstudos);

      return `
        <article class="stack-item">
          <div class="stack-item-top">
            <h4>${escapeHtml(item.nome)}</h4>
            <span class="tiny-muted">${escapeHtml(item.responsavelNome || "-")}</span>
          </div>
          <p class="stack-item-sub">
            ${escapeHtml(item.igrejaNome || "Sem igreja")} • ${escapeHtml(item.serieNome || "Sem série")}
          </p>
          <div class="progress-meta">
            ${p.capped} de ${p.total} • ${p.porcentagem}% • faltam ${p.faltantes}
          </div>
          <div class="progress-bar">
            <span style="width:${p.porcentagem}%"></span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderAttentionList() {
  const data = getVisibleInteressados()
    .filter((item) => isAtRisk(item) || isDecision(item))
    .slice(0, 8);

  if (!data.length) {
    attentionList.innerHTML = `<div class="empty-state">Nenhum caso crítico no momento.</div>`;
    return;
  }

  attentionList.innerHTML = data
    .map((item) => {
      const note = isAtRisk(item)
        ? `Último contato há ${daysSince(item.ultimoContato)} dias`
        : "Pronto para decisão espiritual";

      return `
        <article class="stack-item">
          <div class="stack-item-top">
            <h4>${escapeHtml(item.nome)}</h4>
          </div>
          <p class="stack-item-sub">${escapeHtml(note)}</p>
          <div class="pill-row">
            <span class="pill status-${slug(item.status)}">${escapeHtml(item.status)}</span>
            <span class="pill interest-${slug(item.interesse)}">${escapeHtml(item.interesse)}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderInteressadosTable() {
  const data = getFilteredInteressados();

  if (!data.length) {
    interessadosTable.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">Nenhum registro encontrado.</div>
        </td>
      </tr>
    `;
    return;
  }

  interessadosTable.innerHTML = data
    .map((item) => {
      const p = calcProgress(item.estudoAtual, item.totalEstudos);

      return `
        <tr>
          <td>
            <strong>${escapeHtml(item.nome)}</strong><br>
            <span class="tiny-muted">${escapeHtml(item.igrejaNome || "Sem igreja")} • ${escapeHtml(item.distrito || DISTRITO_FIXO)}</span>
          </td>
          <td>${escapeHtml(item.responsavelNome || item.criadoPorNome || "-")}</td>
          <td>${escapeHtml(item.serieNome || "-")}</td>
          <td>
            <div class="progress-meta">${p.capped} de ${p.total} • ${p.porcentagem}%</div>
            <div class="progress-bar compact">
              <span style="width:${p.porcentagem}%"></span>
            </div>
          </td>
          <td><span class="pill status-${slug(item.status)}">${escapeHtml(item.status)}</span></td>
          <td><span class="pill interest-${slug(item.interesse)}">${escapeHtml(item.interesse)}</span></td>
          <td>
            <div class="action-row">
              <button class="btn btn-secondary btn-sm" data-edit-interessado="${item.id}">Editar</button>
              <button class="btn btn-danger btn-sm" data-delete-interessado="${item.id}">Excluir</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderSeriesList() {
  if (!seriesList) return;

  if (!state.series.length) {
    seriesList.innerHTML = `<div class="empty-state">Nenhuma série cadastrada.</div>`;
    return;
  }

  seriesList.innerHTML = sortByName(state.series)
    .map((serie) => {
      const controls = canManageSeries()
        ? `
          <div class="action-row">
            <button class="btn btn-secondary btn-sm" data-edit-serie="${serie.id}">Editar</button>
            <button class="btn btn-danger btn-sm" data-delete-serie="${serie.id}">Excluir</button>
          </div>
        `
        : "";

      return `
        <article class="stack-item">
          <div class="stack-item-top">
            <h4>${escapeHtml(serie.nome)}</h4>
          </div>
          <p class="stack-item-sub">Total de estudos: <strong>${serie.totalEstudos}</strong></p>
          ${controls}
        </article>
      `;
    })
    .join("");
}

function getVisibleUsersList() {
  if (isAdmin() || isDistrital()) {
    return sortByName(state.usuarios);
  }

  if (isLocal()) {
    const localId = getCurrentUserLocalId();
    return sortByName(state.usuarios.filter((u) => u.igrejaId === localId));
  }

  return [];
}

function renderUsuariosList() {
  if (!usuariosList) return;

  if (!canSeeUsersSection()) {
    usuariosList.innerHTML = `<div class="empty-state">Sem permissão para visualizar usuários.</div>`;
    return;
  }

  const visible = getVisibleUsersList();

  if (!visible.length) {
    usuariosList.innerHTML = `<div class="empty-state">Nenhum usuário cadastrado.</div>`;
    return;
  }

  usuariosList.innerHTML = visible
    .map((usuario) => {
      const loginInfo = ["admin", "distrital"].includes(usuario.perfil)
        ? (usuario.email || usuario.emailAuth || "-")
        : (usuario.username || "-");

      return `
        <article class="stack-item">
          <div class="stack-item-top">
            <h4>${escapeHtml(usuario.nome || "Sem nome")}</h4>
            <span class="tiny-muted">${escapeHtml(formatRole(usuario.perfil))}</span>
          </div>
          <p class="stack-item-sub">
            ${escapeHtml(loginInfo)} • ${escapeHtml(usuario.igrejaNome || "Sem igreja")} • ${escapeHtml(usuario.distrito || DISTRITO_FIXO)}
          </p>
          <div class="pill-row">
            <span class="pill ${usuario.ativo ? "status-ativo" : "status-desinteressado"}">
              ${usuario.ativo ? "Ativo" : "Inativo"}
            </span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderLocaisList() {
  if (!locaisList) return;

  if (!canManageLocais()) {
    locaisList.innerHTML = `<div class="empty-state">Apenas administradores podem gerenciar locais.</div>`;
    return;
  }

  if (!state.locais.length) {
    locaisList.innerHTML = `<div class="empty-state">Nenhum local cadastrado.</div>`;
    return;
  }

  locaisList.innerHTML = sortByName(state.locais)
    .map((local) => {
      return `
        <article class="stack-item">
          <div class="stack-item-top">
            <h4>${escapeHtml(local.nome)}</h4>
            <span class="tiny-muted">${escapeHtml(local.tipo || "igreja")}</span>
          </div>
          <p class="stack-item-sub">${escapeHtml(DISTRITO_FIXO)}</p>
          <div class="action-row">
            <button class="btn btn-secondary btn-sm" data-edit-local="${local.id}">Editar</button>
            <button class="btn btn-danger btn-sm" data-delete-local="${local.id}">Excluir</button>
          </div>
        </article>
      `;
    })
    .join("");
}

/* =========================
   FORM USUARIOS
========================= */
function renderUserProfileOptions() {
  if (!novoUsuarioPerfil) return;

  const allowed = getAllowedProfilesToCreate();
  const labels = {
    admin: "Administrador",
    distrital: "Líder Distrital",
    local: "Líder Local",
    membro: "Membro"
  };

  const current = novoUsuarioPerfil.value;
  novoUsuarioPerfil.innerHTML = allowed
    .map((profile) => `<option value="${profile}">${labels[profile]}</option>`)
    .join("");

  if (allowed.includes(current)) {
    novoUsuarioPerfil.value = current;
  } else if (allowed.length) {
    novoUsuarioPerfil.value = allowed[0];
  }

  updateUserFormByProfile();
}

function renderUserLocalOptions() {
  if (!novoUsuarioIgreja) return;

  let locais = [...state.locais];

  if (isLocal()) {
    const localId = getCurrentUserLocalId();
    locais = locais.filter((item) => item.id === localId);
  }

  locais = sortByName(locais);

  novoUsuarioIgreja.innerHTML =
    `<option value="">Selecionar igreja</option>` +
    locais.map((item) => `<option value="${item.id}">${escapeHtml(item.nome)}</option>`).join("");

  if (isLocal() && locais[0]) {
    novoUsuarioIgreja.value = locais[0].id;
    novoUsuarioIgreja.disabled = true;
  } else {
    novoUsuarioIgreja.disabled = false;
  }
}

function updateUserFormByProfile() {
  const profile = novoUsuarioPerfil?.value || "membro";
  const globalAccount = profile === "admin" || profile === "distrital";
  const localAccount = profile === "local" || profile === "membro";

  if (novoUsuarioUsernameGroup) {
    novoUsuarioUsernameGroup.style.display = localAccount ? "" : "none";
  }

  if (novoUsuarioSenhaLocalGroup) {
    novoUsuarioSenhaLocalGroup.style.display = localAccount ? "" : "none";
  }

  if (novoUsuarioEmailGroup) {
    novoUsuarioEmailGroup.style.display = globalAccount ? "" : "none";
  }

  if (novoUsuarioSenhaGroup) {
    novoUsuarioSenhaGroup.style.display = globalAccount ? "" : "none";
  }

  if (novoUsuarioUsername) {
    novoUsuarioUsername.required = localAccount;
    if (!localAccount) novoUsuarioUsername.value = "";
  }

  if (novoUsuarioSenhaLocal) {
    novoUsuarioSenhaLocal.required = localAccount;
    if (!localAccount) novoUsuarioSenhaLocal.value = "";
  }

  if (novoUsuarioEmail) {
    novoUsuarioEmail.required = globalAccount;
    if (!globalAccount) novoUsuarioEmail.value = "";
  }

  if (novoUsuarioSenha) {
    novoUsuarioSenha.required = globalAccount;
    if (!globalAccount) novoUsuarioSenha.value = "";
  }

  if (novoUsuarioIgreja) {
    novoUsuarioIgreja.required = localAccount;
  }
}

/* =========================
   CRUD INTERESSADOS
========================= */
function getSelectedResponsavel() {
  const responsavelId = instrutor.value;
  if (!responsavelId) {
    throw new Error("Selecione o responsável.");
  }

  const user = getUserById(responsavelId);

  if (!user) {
    throw new Error("Responsável inválido.");
  }

  return user;
}

function getSelectedInteressadoLocal() {
  const localId = igreja.value;
  if (!localId) {
    throw new Error("Selecione a igreja.");
  }

  const local = getLocalById(localId);

  if (!local) {
    throw new Error("Igreja inválida.");
  }

  return local;
}

async function handleInteressadoSubmit(event) {
  event.preventDefault();
  clearMessage();

  try {
    const recordId = interessadoId.value.trim();
    const selectedSerie = getSerieById(serieId.value);

    if (!selectedSerie) {
      throw new Error("Selecione uma série válida.");
    }

    if (!nome.value.trim()) {
      throw new Error("Informe o nome do interessado.");
    }

    const selectedLocal = getSelectedInteressadoLocal();
    const selectedResponsavel = getSelectedResponsavel();
    const progress = calcProgress(estudoAtual.value, selectedSerie.totalEstudos);

    if ((isLocal() || isMembro()) && selectedLocal.id !== getCurrentUserLocalId()) {
      throw new Error("Você só pode cadastrar interessados na sua igreja.");
    }

    if (isMembro() && selectedResponsavel.id !== state.user.uid) {
      throw new Error("Membro só pode registrar com ele mesmo como responsável.");
    }

    const payload = {
      nome: nome.value.trim(),
      telefone: telefone.value.trim(),
      endereco: endereco.value.trim(),
      igrejaId: selectedLocal.id,
      igrejaNome: selectedLocal.nome,
      igrejaTipo: selectedLocal.tipo || "igreja",
      distrito: DISTRITO_FIXO,
      responsavelId: selectedResponsavel.id,
      responsavelNome: selectedResponsavel.nome,
      responsavelPerfil: selectedResponsavel.perfil,
      criadoPorId: state.user.uid,
      criadoPorNome: state.user.nome,
      criadoPorPerfil: state.user.perfil,
      serieId: selectedSerie.id,
      serieNome: selectedSerie.nome,
      estudoAtual: progress.capped,
      totalEstudos: selectedSerie.totalEstudos,
      porcentagem: progress.porcentagem,
      faltantes: progress.faltantes,
      status: status.value,
      interesse: interesse.value,
      observacoes: observacoes.value.trim(),
      ultimoContato: ultimoContato.value || "",
      atualizadoEm: new Date().toISOString(),
      updatedAt: serverTimestamp()
    };

    showLoading();

    if (recordId) {
      const existing = state.interessados.find((item) => item.id === recordId);

      if (!existing) {
        throw new Error("Registro não encontrado.");
      }

      if (isMembro() && existing.criadoPorId !== state.user.uid) {
        throw new Error("Você não pode editar registro de outro usuário.");
      }

      if (isLocal() && existing.igrejaId !== getCurrentUserLocalId()) {
        throw new Error("Você não pode editar registro de outra igreja.");
      }

      await updateDoc(doc(db, "interessados", recordId), payload);
      showMessage("Interessado atualizado com sucesso.", "success");
    } else {
      payload.criadoEm = new Date().toISOString();
      payload.createdAt = serverTimestamp();

      await addDoc(collection(db, "interessados"), payload);
      showMessage("Interessado cadastrado com sucesso.", "success");
    }

    await refreshData();
    closeInteressadoModal();
    resetInteressadoForm();
  } catch (error) {
    console.error("Erro ao salvar interessado:", error);
    showMessage(error.message || "Não foi possível salvar o interessado.", "error");
  } finally {
    hideLoading();
  }
}

async function editInteressado(id) {
  const item = state.interessados.find((row) => row.id === id);
  if (!item) return;

  if (isMembro() && item.criadoPorId !== state.user.uid) {
    showMessage("Você não pode editar esse registro.", "error");
    return;
  }

  if (isLocal() && item.igrejaId !== getCurrentUserLocalId()) {
    showMessage("Você não pode editar registro de outra igreja.", "error");
    return;
  }

  fillInteressadoForm(item);
  openInteressadoModal();
}

async function deleteInteressado(id) {
  const item = state.interessados.find((row) => row.id === id);
  if (!item) return;

  if (isMembro() && item.criadoPorId !== state.user.uid) {
    showMessage("Você não pode excluir esse registro.", "error");
    return;
  }

  if (isLocal() && item.igrejaId !== getCurrentUserLocalId()) {
    showMessage("Você não pode excluir registro de outra igreja.", "error");
    return;
  }

  const confirmed = window.confirm(`Excluir o registro de "${item.nome}"?`);
  if (!confirmed) return;

  try {
    showLoading();
    await deleteDoc(doc(db, "interessados", id));
    showMessage("Interessado excluído com sucesso.", "success");
    await refreshData();
  } catch (error) {
    console.error("Erro ao excluir interessado:", error);
    showMessage("Não foi possível excluir o interessado.", "error");
  } finally {
    hideLoading();
  }
}

/* =========================
   CRUD SERIES
========================= */
async function handleSerieSubmit(event) {
  event.preventDefault();
  clearMessage();

  if (!canManageSeries()) {
    showMessage("Apenas administradores podem gerenciar séries.", "error");
    return;
  }

  try {
    const nomeSerie = novaSerieNome.value.trim();
    const totalEstudos = Number(novaSerieTotal.value);

    if (!nomeSerie) {
      throw new Error("Informe o nome da série.");
    }

    if (!Number.isFinite(totalEstudos) || totalEstudos < 1) {
      throw new Error("Informe um total de estudos válido.");
    }

    const duplicate = state.series.find(
      (serie) => normalizeText(serie.nome) === normalizeText(nomeSerie)
    );

    if (duplicate) {
      throw new Error("Já existe uma série com esse nome.");
    }

    showLoading();

    await addDoc(collection(db, "series"), {
      nome: nomeSerie,
      totalEstudos,
      ativo: true,
      criadoPor: state.user.uid,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    serieForm.reset();
    showMessage("Série criada com sucesso.", "success");
    await refreshData();
  } catch (error) {
    console.error("Erro ao criar série:", error);
    showMessage(error.message || "Não foi possível criar a série.", "error");
  } finally {
    hideLoading();
  }
}

async function editSerie(id) {
  if (!canManageSeries()) {
    showMessage("Apenas administradores podem editar séries.", "error");
    return;
  }

  const serie = getSerieById(id);
  if (!serie) return;

  const novoNome = window.prompt("Editar nome da série:", serie.nome);
  if (novoNome === null) return;

  const nomeFinal = novoNome.trim();
  if (!nomeFinal) {
    showMessage("O nome da série não pode ficar vazio.", "error");
    return;
  }

  const novoTotal = window.prompt("Editar total de estudos:", String(serie.totalEstudos));
  if (novoTotal === null) return;

  const totalFinal = Number(novoTotal);
  if (!Number.isFinite(totalFinal) || totalFinal < 1) {
    showMessage("O total de estudos precisa ser válido.", "error");
    return;
  }

  const duplicate = state.series.find(
    (item) => item.id !== id && normalizeText(item.nome) === normalizeText(nomeFinal)
  );

  if (duplicate) {
    showMessage("Já existe outra série com esse nome.", "error");
    return;
  }

  try {
    showLoading();

    await updateDoc(doc(db, "series", id), {
      nome: nomeFinal,
      totalEstudos: totalFinal,
      atualizadoEm: new Date().toISOString(),
      updatedAt: serverTimestamp()
    });

    const impacted = state.interessados.filter((item) => item.serieId === id);

    await Promise.all(
      impacted.map(async (item) => {
        const progress = calcProgress(item.estudoAtual, totalFinal);
        await updateDoc(doc(db, "interessados", item.id), {
          serieNome: nomeFinal,
          totalEstudos: totalFinal,
          estudoAtual: progress.capped,
          porcentagem: progress.porcentagem,
          faltantes: progress.faltantes,
          atualizadoEm: new Date().toISOString(),
          updatedAt: serverTimestamp()
        });
      })
    );

    showMessage("Série atualizada com sucesso.", "success");
    await refreshData();
  } catch (error) {
    console.error("Erro ao editar série:", error);
    showMessage("Não foi possível editar a série.", "error");
  } finally {
    hideLoading();
  }
}

async function deleteSerie(id) {
  if (!canManageSeries()) {
    showMessage("Apenas administradores podem excluir séries.", "error");
    return;
  }

  const serie = getSerieById(id);
  if (!serie) return;

  const inUse = state.interessados.some((item) => item.serieId === id);
  if (inUse) {
    showMessage("Essa série está vinculada a interessados e não pode ser excluída agora.", "error");
    return;
  }

  const confirmed = window.confirm(`Excluir a série "${serie.nome}"?`);
  if (!confirmed) return;

  try {
    showLoading();
    await deleteDoc(doc(db, "series", id));
    showMessage("Série excluída com sucesso.", "success");
    await refreshData();
  } catch (error) {
    console.error("Erro ao excluir série:", error);
    showMessage("Não foi possível excluir a série.", "error");
  } finally {
    hideLoading();
  }
}

/* =========================
   CRUD LOCAIS
========================= */
async function handleLocalFormSubmit(event) {
  event.preventDefault();
  clearMessage();

  if (!canManageLocais()) {
    showMessage("Apenas administradores podem gerenciar locais.", "error");
    return;
  }

  try {
    const nomeValue = novoLocalNome.value.trim();
    const tipoValue = novoLocalTipo.value;

    if (!nomeValue) {
      throw new Error("Informe o nome do local.");
    }

    const duplicate = state.locais.find(
      (item) => normalizeText(item.nome) === normalizeText(nomeValue)
    );

    if (duplicate) {
      throw new Error("Já existe um local com esse nome.");
    }

    showLoading();

    await addDoc(collection(db, "locais"), {
      nome: nomeValue,
      tipo: tipoValue || "igreja",
      distrito: DISTRITO_FIXO,
      ativo: true,
      criadoPor: state.user.uid,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    localForm.reset();
    showMessage("Local criado com sucesso.", "success");
    await refreshData();
  } catch (error) {
    console.error("Erro ao criar local:", error);
    showMessage(error.message || "Não foi possível criar o local.", "error");
  } finally {
    hideLoading();
  }
}

async function editLocal(id) {
  if (!canManageLocais()) {
    showMessage("Apenas administradores podem editar locais.", "error");
    return;
  }

  const local = getLocalById(id);
  if (!local) return;

  const novoNome = window.prompt("Editar nome do local:", local.nome);
  if (novoNome === null) return;

  const nomeFinal = novoNome.trim();
  if (!nomeFinal) {
    showMessage("O nome do local não pode ficar vazio.", "error");
    return;
  }

  const novoTipo = window.prompt("Editar tipo do local (igreja/grupo):", local.tipo || "igreja");
  if (novoTipo === null) return;

  const tipoFinal = novoTipo.trim() || "igreja";

  const duplicate = state.locais.find(
    (item) => item.id !== id && normalizeText(item.nome) === normalizeText(nomeFinal)
  );

  if (duplicate) {
    showMessage("Já existe outro local com esse nome.", "error");
    return;
  }

  try {
    showLoading();

    await updateDoc(doc(db, "locais", id), {
      nome: nomeFinal,
      tipo: tipoFinal,
      distrito: DISTRITO_FIXO,
      atualizadoEm: new Date().toISOString(),
      updatedAt: serverTimestamp()
    });

    await Promise.all([
      ...state.usuarios
        .filter((u) => u.igrejaId === id)
        .map((u) =>
          updateDoc(doc(db, "usuarios", u.id), {
            igrejaNome: nomeFinal,
            localNome: nomeFinal,
            igreja: nomeFinal,
            distrito: DISTRITO_FIXO,
            atualizadoEm: new Date().toISOString(),
            updatedAt: serverTimestamp()
          })
        ),
      ...state.interessados
        .filter((i) => i.igrejaId === id)
        .map((i) =>
          updateDoc(doc(db, "interessados", i.id), {
            igrejaNome: nomeFinal,
            igrejaTipo: tipoFinal,
            distrito: DISTRITO_FIXO,
            atualizadoEm: new Date().toISOString(),
            updatedAt: serverTimestamp()
          })
        )
    ]);

    showMessage("Local atualizado com sucesso.", "success");
    await refreshData();
  } catch (error) {
    console.error("Erro ao editar local:", error);
    showMessage("Não foi possível editar o local.", "error");
  } finally {
    hideLoading();
  }
}

async function deleteLocal(id) {
  if (!canManageLocais()) {
    showMessage("Apenas administradores podem excluir locais.", "error");
    return;
  }

  const local = getLocalById(id);
  if (!local) return;

  const inUse =
    state.usuarios.some((u) => u.igrejaId === id) ||
    state.interessados.some((i) => i.igrejaId === id);

  if (inUse) {
    showMessage("Esse local está vinculado a usuários ou interessados.", "error");
    return;
  }

  const confirmed = window.confirm(`Excluir o local "${local.nome}"?`);
  if (!confirmed) return;

  try {
    showLoading();
    await deleteDoc(doc(db, "locais", id));
    showMessage("Local excluído com sucesso.", "success");
    await refreshData();
  } catch (error) {
    console.error("Erro ao excluir local:", error);
    showMessage("Não foi possível excluir o local.", "error");
  } finally {
    hideLoading();
  }
}

/* =========================
   CRUD USUARIOS
========================= */
function validateUserCreationByRole(profile) {
  const allowed = getAllowedProfilesToCreate();

  if (!allowed.includes(profile)) {
    throw new Error("Você não pode criar esse tipo de usuário.");
  }
}

async function createGlobalUserWithSecondaryApp({ nome, email, senha, perfil }) {
  const secondaryName = `secondary-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const secondaryApp = initializeApp(app.options, secondaryName);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      email,
      senha
    );

    const uid = credential.user.uid;

    await setDoc(doc(db, "usuarios", uid), {
      nome,
      email,
      emailAuth: email,
      perfil,
      username: "",
      senhaLocal: "",
      igrejaId: "",
      igrejaNome: "",
      distrito: DISTRITO_FIXO,
      ativo: true,
      criadoPor: state.user.uid,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    await signOut(secondaryAuth);
    await deleteApp(secondaryApp);

    return uid;
  } catch (error) {
    try {
      await signOut(secondaryAuth);
    } catch (_) {}
    try {
      await deleteApp(secondaryApp);
    } catch (_) {}
    throw error;
  }
}

async function createLocalOrMembroUserWithSecondaryApp({
  nome,
  perfil,
  igrejaId,
  igrejaNome,
  username,
  senha
}) {
  const secondaryName = `secondary-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const secondaryApp = initializeApp(app.options, secondaryName);
  const secondaryAuth = getAuth(secondaryApp);

  const emailAuth = buildEmailAuth(username, igrejaId);

  try {
    const credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      emailAuth,
      senha
    );

    const uid = credential.user.uid;

    await setDoc(doc(db, "usuarios", uid), {
      nome,
      email: "",
      emailAuth,
      perfil,
      username,
      senhaLocal: "",
      igrejaId,
      igrejaNome,
      distrito: DISTRITO_FIXO,
      ativo: true,
      criadoPor: state.user.uid,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    await signOut(secondaryAuth);
    await deleteApp(secondaryApp);

    return uid;
  } catch (error) {
    try {
      await signOut(secondaryAuth);
    } catch (_) {}
    try {
      await deleteApp(secondaryApp);
    } catch (_) {}
    throw error;
  }
}

async function ensureUniqueUsernameInChurch(username, igrejaId) {
  const q = query(
    collection(db, "usuarios"),
    where("username", "==", username),
    where("igrejaId", "==", igrejaId),
    limit(1)
  );

  const snap = await getDocs(q);
  return snap.empty;
}

async function handleUserFormSubmit(event) {
  event.preventDefault();
  clearMessage();

  if (!canCreateUsers()) {
    showMessage("Você não pode criar usuários.", "error");
    return;
  }

  const nomeValue = novoUsuarioNome.value.trim();
  const perfilValue = novoUsuarioPerfil.value;

  try {
    validateUserCreationByRole(perfilValue);

    if (!nomeValue) {
      throw new Error("Informe o nome do usuário.");
    }

    showLoading();

    if (perfilValue === "admin" || perfilValue === "distrital") {
      const emailValue = novoUsuarioEmail.value.trim();
      const senhaValue = novoUsuarioSenha.value;

      if (!emailValue || !senhaValue) {
        throw new Error("Preencha e-mail e senha.");
      }

      await createGlobalUserWithSecondaryApp({
        nome: nomeValue,
        email: emailValue,
        senha: senhaValue,
        perfil: perfilValue
      });

      userForm.reset();
      renderUserProfileOptions();
      showMessage("Usuário global criado com sucesso.", "success");
      await refreshData();
      return;
    }

    const igrejaIdValue = novoUsuarioIgreja.value;
    const usernameValue = normalizeText(novoUsuarioUsername.value);
    const senhaLocalValue = novoUsuarioSenhaLocal.value;

    if (!igrejaIdValue) {
      throw new Error("Selecione a igreja.");
    }

    if (!usernameValue) {
      throw new Error("Informe o usuário.");
    }

    if (!senhaLocalValue) {
      throw new Error("Informe a senha.");
    }

    const local = getLocalById(igrejaIdValue);
    if (!local) {
      throw new Error("Igreja inválida.");
    }

    if (isLocal() && igrejaIdValue !== getCurrentUserLocalId()) {
      throw new Error("Você só pode criar usuários da sua igreja.");
    }

    const usernameIsFree = await ensureUniqueUsernameInChurch(usernameValue, igrejaIdValue);
    if (!usernameIsFree) {
      throw new Error("Esse usuário já existe nessa igreja.");
    }

    await createLocalOrMembroUserWithSecondaryApp({
      nome: nomeValue,
      perfil: perfilValue,
      igrejaId: local.id,
      igrejaNome: local.nome,
      username: usernameValue,
      senha: senhaLocalValue
    });

    userForm.reset();
    renderUserProfileOptions();
    showMessage("Usuário criado com sucesso.", "success");
    await refreshData();
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    showMessage(error.message || "Não foi possível criar o usuário.", "error");
  } finally {
    hideLoading();
  }
}

/* =========================
   EVENTOS
========================= */
function bindStaticEvents() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetSection = btn.dataset.section;
      setSection(targetSection);
    });
  });

  openInteressadoModalBtn?.addEventListener("click", () => {
    resetInteressadoForm();
    openInteressadoModal();
  });

  openInteressadoModalBtn2?.addEventListener("click", () => {
    resetInteressadoForm();
    openInteressadoModal();
  });

  closeInteressadoModalBtn?.addEventListener("click", closeInteressadoModal);

  interessadoModalBackdrop?.addEventListener("click", (event) => {
    if (event.target === interessadoModalBackdrop) {
      closeInteressadoModal();
    }
  });

  interessadoForm?.addEventListener("submit", handleInteressadoSubmit);
  resetFormBtn?.addEventListener("click", resetInteressadoForm);

  serieForm?.addEventListener("submit", handleSerieSubmit);
  localForm?.addEventListener("submit", handleLocalFormSubmit);
  userForm?.addEventListener("submit", handleUserFormSubmit);

  serieId?.addEventListener("change", updateProgressPreview);
  estudoAtual?.addEventListener("input", updateProgressPreview);

  obsRapidas?.addEventListener("change", (event) => {
    const value = event.target.value;
    if (!value) return;

    observacoes.value = observacoes.value.trim()
      ? `${observacoes.value.trim()} ${value}`
      : value;

    event.target.value = "";
  });

  searchInput?.addEventListener("input", renderInteressadosTable);
  statusFilter?.addEventListener("change", renderInteressadosTable);
  interestFilter?.addEventListener("change", renderInteressadosTable);
  serieFilter?.addEventListener("change", renderInteressadosTable);

  interessadosTable?.addEventListener("click", async (event) => {
    const editBtn = event.target.closest("[data-edit-interessado]");
    const deleteBtn = event.target.closest("[data-delete-interessado]");

    if (editBtn) {
      await editInteressado(editBtn.dataset.editInteressado);
    }

    if (deleteBtn) {
      await deleteInteressado(deleteBtn.dataset.deleteInteressado);
    }
  });

  seriesList?.addEventListener("click", async (event) => {
    const editBtn = event.target.closest("[data-edit-serie]");
    const deleteBtn = event.target.closest("[data-delete-serie]");

    if (editBtn) {
      await editSerie(editBtn.dataset.editSerie);
    }

    if (deleteBtn) {
      await deleteSerie(deleteBtn.dataset.deleteSerie);
    }
  });

  locaisList?.addEventListener("click", async (event) => {
    const editBtn = event.target.closest("[data-edit-local]");
    const deleteBtn = event.target.closest("[data-delete-local]");

    if (editBtn) {
      await editLocal(editBtn.dataset.editLocal);
    }

    if (deleteBtn) {
      await deleteLocal(deleteBtn.dataset.deleteLocal);
    }
  });

  novoUsuarioPerfil?.addEventListener("change", updateUserFormByProfile);
}

/* =========================
   AUTH READY
========================= */
window.addEventListener("auth-ready", async (event) => {
  const detail = event.detail;

  if (!detail?.ready) return;

  if (!detail?.profile) {
    state.user = null;
    state.interessados = [];
    state.series = [];
    state.usuarios = [];
    state.locais = [];
    return;
  }

  state.user = {
    uid: detail.profile.uid || detail.profile.id || detail.firebaseUser?.uid || "",
    ...detail.profile
  };

  const allowedPerfis = ["admin", "distrital", "local", "membro"];
  if (!allowedPerfis.includes(state.user.perfil)) {
    showMessage("Perfil sem acesso ao sistema.", "error");
    return;
  }

  applyRoleUI();
  await refreshData();
});

/* =========================
   RENDER FINAL
========================= */
function renderAll() {
  renderFilters();
  renderSerieOptions();
  renderInteressadoLocalOptions();
  renderResponsavelOptions();
  renderStatusAndInterestOptions();
  renderUserProfileOptions();
  renderUserLocalOptions();
  updateProgressPreview();

  if (novoUsuarioDistrito) {
    novoUsuarioDistrito.value = DISTRITO_FIXO;
    novoUsuarioDistrito.readOnly = true;
  }

  if (distrito) {
    distrito.value = DISTRITO_FIXO;
    distrito.readOnly = true;
  }

  renderMetrics();
  renderRecentList();
  renderAttentionList();
  renderInteressadosTable();
  renderSeriesList();
  renderUsuariosList();
  renderLocaisList();

  applyRoleUI();
}

/* =========================
   START
========================= */
bindStaticEvents();
renderFilters();
renderStatusAndInterestOptions();
renderSerieOptions();
updateProgressPreview();

/* =========================
   DEBUG
========================= */
window.esplanadaApp = {
  state,
  refreshData,
  editInteressado,
  deleteInteressado,
  editSerie,
  deleteSerie,
  editLocal,
  deleteLocal
};
