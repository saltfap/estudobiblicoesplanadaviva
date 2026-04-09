import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  query,
  where,
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

const DEFAULT_LOCAIS = [
  { nome: "Bonsucesso", tipo: "igreja" },
  { nome: "Baraúna", tipo: "igreja" },
  { nome: "Carambeí Central", tipo: "igreja" },
  { nome: "Jardim Eldorado", tipo: "igreja" },
  { nome: "Jardim Esplanada", tipo: "igreja" },
  { nome: "Jardim Planalto", tipo: "igreja" },
  { nome: "Los Angeles", tipo: "igreja" },
  { nome: "Tânia Mara", tipo: "igreja" },
  { nome: "Vila Borato", tipo: "igreja" },
  { nome: "Vila Romana", tipo: "igreja" }
];

const state = {
  user: null,
  interessados: [],
  series: [],
  usuarios: [],
  locais: [],
  instrutores: [],
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

// novos blocos, opcionais até o index ser ajustado
const locaisList = document.getElementById("locaisList");
const localForm = document.getElementById("localForm");
const novoLocalNome = document.getElementById("novoLocalNome");
const novoLocalTipo = document.getElementById("novoLocalTipo");

const instrutoresList = document.getElementById("instrutoresList");
const instrutorForm = document.getElementById("instrutorForm");
const novoInstrutorNome = document.getElementById("novoInstrutorNome");
const novoInstrutorLocal = document.getElementById("novoInstrutorLocal");

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
const instrutor = document.getElementById("instrutor");
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

const userForm = document.getElementById("userForm");
const novoUsuarioNome = document.getElementById("novoUsuarioNome");
const novoUsuarioEmail = document.getElementById("novoUsuarioEmail");
const novoUsuarioSenha = document.getElementById("novoUsuarioSenha");
const novoUsuarioPerfil = document.getElementById("novoUsuarioPerfil");
const novoUsuarioIgreja = document.getElementById("novoUsuarioIgreja");
const novoUsuarioDistrito = document.getElementById("novoUsuarioDistrito");

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

function normalizeText(text) {
  return (text || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function slug(text) {
  return normalizeText(text).replace(/\s+/g, "-");
}

function isAdmin() {
  return state.user?.perfil === "admin";
}

function isLider() {
  return state.user?.perfil === "lider";
}

function canManageSeries() {
  return isAdmin();
}

function canManageUsers() {
  return isAdmin();
}

function canManageLocais() {
  return isAdmin();
}

function canManageInstrutores() {
  return isAdmin() || isLider();
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
  return (
    item.status === "Pronto para apelo" ||
    item.status === "Pronto para batismo"
  );
}

function sortByUpdatedDesc(arr) {
  return [...arr].sort((a, b) => {
    const aTime = new Date(a.atualizadoEm || 0).getTime();
    const bTime = new Date(b.atualizadoEm || 0).getTime();
    return bTime - aTime;
  });
}

function sortByName(arr) {
  return [...arr].sort((a, b) =>
    (a.nome || "").localeCompare(b.nome || "", "pt-BR")
  );
}

function getSerieById(id) {
  return state.series.find((s) => s.id === id);
}

function getLocalById(id) {
  return state.locais.find((l) => l.id === id);
}

function getInstrutorById(id) {
  return state.instrutores.find((i) => i.id === id);
}

function getCurrentUserLocalName() {
  return state.user?.localNome || state.user?.igreja || "";
}

function getCurrentUserLocalId() {
  return state.user?.localId || "";
}

function formatInstrutoresNomes(item) {
  if (Array.isArray(item.instrutorNomes) && item.instrutorNomes.length) {
    return item.instrutorNomes.join(", ");
  }
  if (item.instrutorNome) {
    return item.instrutorNome;
  }
  return "-";
}

function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function getVisibleInteressados() {
  let data = [...state.interessados];

  if (isAdmin()) {
    return sortByUpdatedDesc(data);
  }

  if (isLider()) {
    const localId = getCurrentUserLocalId();
    const localNome = normalizeText(getCurrentUserLocalName());

    data = data.filter((item) => {
      if (localId && item.localId === localId) return true;
      return normalizeText(item.localNome || item.igreja) === localNome;
    });
  }

  return sortByUpdatedDesc(data);
}

function getFilteredInteressados() {
  let data = getVisibleInteressados();

  const search = normalizeText(searchInput?.value || "");
  const selectedStatus = statusFilter?.value || "Todos";
  const selectedInterest = interestFilter?.value || "Todos";
  const selectedSerie = serieFilter?.value || "Todas";

  if (search) {
    data = data.filter((item) => {
      const instrutoresTexto = ensureArray(item.instrutorNomes).join(" ");
      return (
        normalizeText(item.nome).includes(search) ||
        normalizeText(item.telefone).includes(search) ||
        normalizeText(item.localNome || item.igreja).includes(search) ||
        normalizeText(item.distrito).includes(search) ||
        normalizeText(instrutoresTexto).includes(search) ||
        normalizeText(item.serieNome).includes(search)
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

function getSectionTitle(sectionId) {
  const map = {
    dashboardSection: "Dashboard",
    interessadosSection: "Interessados",
    catalogoSection: "Catálogo de Estudos",
    usuariosSection: "Usuários",
    locaisSection: "Locais",
    instrutoresSection: "Instrutores"
  };
  return map[sectionId] || "Esplanada Viva";
}

function setSection(sectionId) {
  state.activeSection = sectionId;

  document.querySelectorAll(".page-section").forEach((section) => {
    section.classList.toggle("active", section.id === sectionId);
  });

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.section === sectionId);
  });

  if (pageTitle) {
    pageTitle.textContent = getSectionTitle(sectionId);
  }
}

/* =========================
   MODAL
========================= */
function openInteressadoModal() {
  interessadoModalBackdrop?.classList.remove("hidden");
}

function closeInteressadoModal() {
  interessadoModalBackdrop?.classList.add("hidden");
}

function renderLocalField(selectedId = "") {
  if (!igreja) return;

  const visibleLocais = sortByName(
    canManageLocais() || isAdmin()
      ? state.locais
      : state.locais.filter((l) => {
          const localId = getCurrentUserLocalId();
          const localNome = normalizeText(getCurrentUserLocalName());
          if (localId) return l.id === localId;
          return normalizeText(l.nome) === localNome;
        })
  );

  const localLider = visibleLocais[0] || null;

  if (igreja.tagName === "SELECT") {
    igreja.innerHTML =
      `<option value="">Selecionar local</option>` +
      visibleLocais
        .map(
          (local) =>
            `<option value="${local.id}">${escapeHtml(local.nome)} (${escapeHtml(local.tipo || "igreja")})</option>`
        )
        .join("");

    if (isLider() && !isAdmin()) {
      igreja.disabled = true;
      if (localLider) {
        igreja.value = localLider.id;
      }
      return;
    }

    igreja.disabled = false;
    if (selectedId) {
      igreja.value = selectedId;
    }
    return;
  }

  // fallback para input até o index ser ajustado
  if (isLider() && !isAdmin()) {
    igreja.value = localLider?.nome || getCurrentUserLocalName();
    igreja.readOnly = true;
  } else {
    igreja.readOnly = false;
    if (selectedId) {
      const found = getLocalById(selectedId);
      igreja.value = found?.nome || "";
    }
  }
}

function renderInstrutorOptions(selectedIds = []) {
  if (!instrutor) return;

  const ids = ensureArray(selectedIds);

  let visibleInstrutores = [...state.instrutores];

  if (isLider() && !isAdmin()) {
    const localId = getCurrentUserLocalId();
    const localNome = normalizeText(getCurrentUserLocalName());

    visibleInstrutores = visibleInstrutores.filter((item) => {
      if (localId && item.localId === localId) return true;
      return normalizeText(item.localNome) === localNome;
    });
  }

  visibleInstrutores = sortByName(visibleInstrutores.filter((i) => i.ativo !== false));

  if (instrutor.tagName === "SELECT") {
    instrutor.disabled = false;

    if (instrutor.multiple) {
      instrutor.innerHTML = visibleInstrutores
        .map(
          (item) =>
            `<option value="${item.id}">${escapeHtml(item.nome)}</option>`
        )
        .join("");

      Array.from(instrutor.options).forEach((option) => {
        option.selected = ids.includes(option.value);
      });
      return;
    }

    instrutor.innerHTML =
      `<option value="">Selecionar instrutor</option>` +
      visibleInstrutores
        .map(
          (item) =>
            `<option value="${item.id}">${escapeHtml(item.nome)}</option>`
        )
        .join("");

    if (ids.length) {
      instrutor.value = ids[0];
    }
    return;
  }

  // fallback para input/text caso o HTML ainda esteja antigo
  const selectedNames = ids
    .map((id) => getInstrutorById(id)?.nome)
    .filter(Boolean);

  instrutor.value = selectedNames.join(", ");
}

function resetInteressadoForm() {
  interessadoForm?.reset();
  interessadoId.value = "";
  interessadoModalTitle.textContent = "Novo interessado";

  renderSerieOptions();
  renderLocalField();
  renderInstrutorOptions();
  renderStatusAndInterestOptions();

  if (distrito) {
    distrito.value = DISTRITO_FIXO;
    distrito.readOnly = true;
    distrito.disabled = true;
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

  renderLocalField(item.localId || "");
  if (igreja && igreja.tagName !== "SELECT") {
    igreja.value = item.localNome || item.igreja || "";
  }

  if (distrito) {
    distrito.value = DISTRITO_FIXO;
    distrito.readOnly = true;
    distrito.disabled = true;
  }

  renderInstrutorOptions(item.instrutorIds || item.instrutorId || []);
  renderSerieOptions();
  serieId.value = item.serieId || "";
  estudoAtual.value = item.estudoAtual ?? 0;
  renderStatusAndInterestOptions();
  status.value = item.status || "Ativo";
  interesse.value = item.interesse || "Médio";
  ultimoContato.value = item.ultimoContato || "";
  observacoes.value = item.observacoes || "";
  interessadoModalTitle.textContent = "Editar interessado";

  updateProgressPreview();
}

/* =========================
   RENDER
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
        .map(
          (serie) =>
            `<option value="${serie.id}">${escapeHtml(serie.nome)}</option>`
        )
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
      .map(
        (serie) =>
          `<option value="${serie.id}">${escapeHtml(serie.nome)} (${serie.totalEstudos})</option>`
      )
      .join("");

  if (current) {
    serieId.value = current;
  }
}

function renderNovoInstrutorLocalOptions() {
  if (!novoInstrutorLocal) return;

  const locais = isAdmin()
    ? sortByName(state.locais)
    : sortByName(
        state.locais.filter((l) => {
          const localId = getCurrentUserLocalId();
          const localNome = normalizeText(getCurrentUserLocalName());
          if (localId) return l.id === localId;
          return normalizeText(l.nome) === localNome;
        })
      );

  novoInstrutorLocal.innerHTML =
    `<option value="">Selecionar local</option>` +
    locais.map((local) => `<option value="${local.id}">${escapeHtml(local.nome)}</option>`).join("");

  if (isLider() && !isAdmin() && locais[0]) {
    novoInstrutorLocal.value = locais[0].id;
    novoInstrutorLocal.disabled = true;
  } else {
    novoInstrutorLocal.disabled = false;
  }
}

function renderNovoUsuarioLocalOptions() {
  if (!novoUsuarioIgreja || novoUsuarioIgreja.tagName !== "SELECT") return;

  const current = novoUsuarioIgreja.value || "";
  novoUsuarioIgreja.innerHTML =
    `<option value="">Selecionar local</option>` +
    sortByName(state.locais)
      .map((local) => `<option value="${local.id}">${escapeHtml(local.nome)}</option>`)
      .join("");

  if (current) {
    novoUsuarioIgreja.value = current;
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
            <span class="tiny-muted">${escapeHtml(formatInstrutoresNomes(item))}</span>
          </div>
          <p class="stack-item-sub">
            ${escapeHtml(item.localNome || item.igreja || "Sem local")} • ${escapeHtml(item.serieNome || "Sem série")}
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

  if (!interessadosTable) return;

  if (!data.length) {
    if (interessadosTable.tagName === "TBODY") {
      interessadosTable.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="empty-state">Nenhum registro encontrado.</div>
          </td>
        </tr>
      `;
    } else {
      interessadosTable.innerHTML = `<div class="empty-state">Nenhum registro encontrado.</div>`;
    }
    return;
  }

  const markup = data
    .map((item) => {
      const p = calcProgress(item.estudoAtual, item.totalEstudos);

      return `
        <tr>
          <td>
            <strong>${escapeHtml(item.nome)}</strong><br>
            <span class="tiny-muted">${escapeHtml(item.localNome || item.igreja || "Sem local")} • ${escapeHtml(DISTRITO_FIXO)}</span>
          </td>
          <td>${escapeHtml(formatInstrutoresNomes(item))}</td>
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

  if (interessadosTable.tagName === "TBODY") {
    interessadosTable.innerHTML = markup;
    return;
  }

  // fallback para futuro layout em cards/lista
  interessadosTable.innerHTML = data
    .map((item) => {
      const p = calcProgress(item.estudoAtual, item.totalEstudos);
      return `
        <article class="stack-item">
          <div class="stack-item-top">
            <h4>${escapeHtml(item.nome)}</h4>
            <span class="tiny-muted">${escapeHtml(item.localNome || item.igreja || "Sem local")}</span>
          </div>
          <p class="stack-item-sub">${escapeHtml(formatInstrutoresNomes(item))}</p>
          <div class="progress-meta">${p.capped} de ${p.total} • ${p.porcentagem}%</div>
          <div class="progress-bar"><span style="width:${p.porcentagem}%"></span></div>
          <div class="pill-row">
            <span class="pill status-${slug(item.status)}">${escapeHtml(item.status)}</span>
            <span class="pill interest-${slug(item.interesse)}">${escapeHtml(item.interesse)}</span>
          </div>
          <div class="action-row" style="margin-top:12px;">
            <button class="btn btn-secondary btn-sm" data-edit-interessado="${item.id}">Editar</button>
            <button class="btn btn-danger btn-sm" data-delete-interessado="${item.id}">Excluir</button>
          </div>
        </article>
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

function renderUsuariosList() {
  if (!usuariosList) return;

  if (!canManageUsers()) {
    usuariosList.innerHTML = `<div class="empty-state">Apenas administradores podem ver usuários.</div>`;
    return;
  }

  if (!state.usuarios.length) {
    usuariosList.innerHTML = `<div class="empty-state">Nenhum usuário cadastrado.</div>`;
    return;
  }

  usuariosList.innerHTML = sortByName(state.usuarios)
    .map((usuario) => {
      return `
        <article class="stack-item">
          <div class="stack-item-top">
            <h4>${escapeHtml(usuario.nome || "Sem nome")}</h4>
            <span class="tiny-muted">${escapeHtml(usuario.perfil || "-")}</span>
          </div>
          <p class="stack-item-sub">
            ${escapeHtml(usuario.email || "-")} • ${escapeHtml(usuario.localNome || usuario.igreja || "Sem local")} • ${escapeHtml(DISTRITO_FIXO)}
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

function renderInstrutoresList() {
  if (!instrutoresList) return;

  if (!canManageInstrutores()) {
    instrutoresList.innerHTML = `<div class="empty-state">Sem permissão para gerenciar instrutores.</div>`;
    return;
  }

  let data = [...state.instrutores];

  if (isLider() && !isAdmin()) {
    const localId = getCurrentUserLocalId();
    const localNome = normalizeText(getCurrentUserLocalName());

    data = data.filter((item) => {
      if (localId && item.localId === localId) return true;
      return normalizeText(item.localNome) === localNome;
    });
  }

  if (!data.length) {
    instrutoresList.innerHTML = `<div class="empty-state">Nenhum instrutor cadastrado.</div>`;
    return;
  }

  instrutoresList.innerHTML = sortByName(data)
    .map((item) => {
      return `
        <article class="stack-item">
          <div class="stack-item-top">
            <h4>${escapeHtml(item.nome)}</h4>
            <span class="tiny-muted">${escapeHtml(item.localNome || "-")}</span>
          </div>
          <p class="stack-item-sub">${escapeHtml(DISTRITO_FIXO)}</p>
          <div class="action-row">
            <button class="btn btn-secondary btn-sm" data-edit-instrutor="${item.id}">Editar</button>
            <button class="btn btn-danger btn-sm" data-delete-instrutor="${item.id}">Excluir</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderAll() {
  renderFilters();
  renderSerieOptions();
  renderLocalField();
  renderInstrutorOptions();
  renderNovoInstrutorLocalOptions();
  renderNovoUsuarioLocalOptions();
  renderStatusAndInterestOptions();
  updateProgressPreview();
  renderMetrics();
  renderRecentList();
  renderAttentionList();
  renderInteressadosTable();
  renderSeriesList();
  renderUsuariosList();
  renderLocaisList();
  renderInstrutoresList();
}

/* =========================
   FIRESTORE
========================= */
async function loadSeries() {
  const snap = await getDocs(collection(db, "series"));
  state.series = snap.docs.map((item) => ({
    id: item.id,
    ...item.data()
  }));
}

async function loadUsuarios() {
  if (!canManageUsers()) {
    state.usuarios = [];
    return;
  }

  const snap = await getDocs(collection(db, "usuarios"));
  state.usuarios = snap.docs.map((item) => ({
    id: item.id,
    ...item.data()
  }));
}

async function loadLocais() {
  const snap = await getDocs(collection(db, "locais"));
  state.locais = snap.docs.map((item) => ({
    id: item.id,
    ...item.data()
  }));
}

async function loadInstrutores() {
  let snap;

  if (isAdmin()) {
    snap = await getDocs(collection(db, "instrutores"));
  } else {
    const localId = getCurrentUserLocalId();
    if (localId) {
      snap = await getDocs(
        query(collection(db, "instrutores"), where("localId", "==", localId))
      );
    } else {
      snap = await getDocs(collection(db, "instrutores"));
    }
  }

  let data = snap.docs.map((item) => ({
    id: item.id,
    ...item.data()
  }));

  if (!isAdmin()) {
    const localNome = normalizeText(getCurrentUserLocalName());
    data = data.filter((item) => {
      const localId = getCurrentUserLocalId();
      if (localId && item.localId === localId) return true;
      return normalizeText(item.localNome) === localNome;
    });
  }

  state.instrutores = data;
}

async function loadInteressados() {
  if (isAdmin()) {
    const snap = await getDocs(collection(db, "interessados"));
    state.interessados = snap.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));
    return;
  }

  const localId = getCurrentUserLocalId();
  let snap;

  if (localId) {
    snap = await getDocs(
      query(collection(db, "interessados"), where("localId", "==", localId))
    );
  } else {
    snap = await getDocs(collection(db, "interessados"));
  }

  let data = snap.docs.map((item) => ({
    id: item.id,
    ...item.data()
  }));

  const localNome = normalizeText(getCurrentUserLocalName());
  data = data.filter((item) => {
    if (localId && item.localId === localId) return true;
    return normalizeText(item.localNome || item.igreja) === localNome;
  });

  state.interessados = data;
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
      loadInstrutores(),
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
   INTERESSADOS CRUD
========================= */
function resolveLocalData() {
  if (!igreja) {
    throw new Error("Campo de local não encontrado.");
  }

  if (igreja.tagName === "SELECT") {
    const selectedId = igreja.value;
    if (!selectedId) {
      throw new Error("Selecione um local.");
    }

    const local = getLocalById(selectedId);
    if (!local) {
      throw new Error("Local inválido.");
    }

    return {
      localId: local.id,
      localNome: local.nome,
      localTipo: local.tipo || "igreja"
    };
  }

  const raw = igreja.value.trim();

  if (!raw) {
    throw new Error("Informe o local.");
  }

  const local = state.locais.find((l) => normalizeText(l.nome) === normalizeText(raw));

  if (!local) {
    throw new Error("Selecione um local cadastrado válido.");
  }

  return {
    localId: local.id,
    localNome: local.nome,
    localTipo: local.tipo || "igreja"
  };
}

function resolveInstrutoresData() {
  if (!instrutor) {
    throw new Error("Campo de instrutor não encontrado.");
  }

  let selectedIds = [];

  if (instrutor.tagName === "SELECT" && instrutor.multiple) {
    selectedIds = Array.from(instrutor.selectedOptions).map((option) => option.value).filter(Boolean);
  } else if (instrutor.tagName === "SELECT") {
    selectedIds = instrutor.value ? [instrutor.value] : [];
  } else {
    const typedNames = instrutor.value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    selectedIds = typedNames
      .map((name) => state.instrutores.find((i) => normalizeText(i.nome) === normalizeText(name))?.id)
      .filter(Boolean);
  }

  if (!selectedIds.length) {
    throw new Error("Selecione pelo menos um instrutor.");
  }

  const selectedInstrutores = selectedIds
    .map((id) => getInstrutorById(id))
    .filter(Boolean);

  if (!selectedInstrutores.length) {
    throw new Error("Instrutor inválido.");
  }

  return {
    instrutorIds: selectedInstrutores.map((item) => item.id),
    instrutorNomes: selectedInstrutores.map((item) => item.nome)
  };
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

    const localData = resolveLocalData();
    const instrutoresData = resolveInstrutoresData();
    const progress = calcProgress(estudoAtual.value, selectedSerie.totalEstudos);

    const payload = {
      nome: nome.value.trim(),
      telefone: telefone.value.trim(),
      endereco: endereco.value.trim(),
      localId: localData.localId,
      localNome: localData.localNome,
      localTipo: localData.localTipo,
      igreja: localData.localNome, // compatibilidade visual antiga
      distrito: DISTRITO_FIXO,
      instrutorIds: instrutoresData.instrutorIds,
      instrutorNomes: instrutoresData.instrutorNomes,
      instrutorId: instrutoresData.instrutorIds[0] || "", // compatibilidade
      instrutorNome: instrutoresData.instrutorNomes[0] || "", // compatibilidade
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

      if (!isAdmin()) {
        const localId = getCurrentUserLocalId();
        const localNome = normalizeText(getCurrentUserLocalName());

        const sameLocal = localId
          ? existing.localId === localId
          : normalizeText(existing.localNome || existing.igreja) === localNome;

        if (!sameLocal) {
          throw new Error("Você não pode editar um registro de outro local.");
        }
      }

      await updateDoc(doc(db, "interessados", recordId), payload);
      showMessage("Interessado atualizado com sucesso.", "success");
    } else {
      payload.criadoPor = state.user.uid;
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

  if (!isAdmin()) {
    const localId = getCurrentUserLocalId();
    const localNome = normalizeText(getCurrentUserLocalName());

    const sameLocal = localId
      ? item.localId === localId
      : normalizeText(item.localNome || item.igreja) === localNome;

    if (!sameLocal) {
      showMessage("Você não pode editar esse registro.", "error");
      return;
    }
  }

  fillInteressadoForm(item);
  openInteressadoModal();
}

async function deleteInteressado(id) {
  const item = state.interessados.find((row) => row.id === id);
  if (!item) return;

  if (!isAdmin()) {
    const localId = getCurrentUserLocalId();
    const localNome = normalizeText(getCurrentUserLocalName());

    const sameLocal = localId
      ? item.localId === localId
      : normalizeText(item.localNome || item.igreja) === localNome;

    if (!sameLocal) {
      showMessage("Você não pode excluir esse registro.", "error");
      return;
    }
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
   SÉRIES CRUD
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

    serieForm?.reset();
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
          porcentagem: progress.porcentagem,
          faltantes: progress.faltantes,
          estudoAtual: progress.capped,
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
   LOCAIS CRUD
========================= */
async function handleLocalFormSubmit(event) {
  event.preventDefault();
  clearMessage();

  if (!canManageLocais()) {
    showMessage("Apenas administradores podem gerenciar locais.", "error");
    return;
  }

  try {
    const nomeValue = novoLocalNome?.value.trim();
    const tipoValue = (novoLocalTipo?.value || "igreja").trim();

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

    localForm?.reset();
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

    // atualização em cascata: interessados, instrutores, usuários
    await Promise.all([
      ...state.interessados
        .filter((item) => item.localId === id)
        .map((item) =>
          updateDoc(doc(db, "interessados", item.id), {
            localNome: nomeFinal,
            localTipo: tipoFinal,
            igreja: nomeFinal,
            distrito: DISTRITO_FIXO,
            atualizadoEm: new Date().toISOString(),
            updatedAt: serverTimestamp()
          })
        ),
      ...state.instrutores
        .filter((item) => item.localId === id)
        .map((item) =>
          updateDoc(doc(db, "instrutores", item.id), {
            localNome: nomeFinal,
            distrito: DISTRITO_FIXO,
            atualizadoEm: new Date().toISOString(),
            updatedAt: serverTimestamp()
          })
        ),
      ...state.usuarios
        .filter((item) => item.localId === id)
        .map((item) =>
          updateDoc(doc(db, "usuarios", item.id), {
            localNome: nomeFinal,
            igreja: nomeFinal,
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
    state.interessados.some((item) => item.localId === id) ||
    state.instrutores.some((item) => item.localId === id) ||
    state.usuarios.some((item) => item.localId === id);

  if (inUse) {
    showMessage("Esse local está vinculado a usuários, instrutores ou interessados.", "error");
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
   INSTRUTORES CRUD
========================= */
async function handleInstrutorFormSubmit(event) {
  event.preventDefault();
  clearMessage();

  if (!canManageInstrutores()) {
    showMessage("Sem permissão para cadastrar instrutores.", "error");
    return;
  }

  try {
    const nomeValue = novoInstrutorNome?.value.trim();
    const localId = novoInstrutorLocal?.value || getCurrentUserLocalId();

    if (!nomeValue) {
      throw new Error("Informe o nome do instrutor.");
    }

    if (!localId) {
      throw new Error("Selecione o local do instrutor.");
    }

    const local = getLocalById(localId);
    if (!local) {
      throw new Error("Local inválido.");
    }

    const duplicate = state.instrutores.find(
      (item) =>
        normalizeText(item.nome) === normalizeText(nomeValue) &&
        item.localId === localId
    );

    if (duplicate) {
      throw new Error("Já existe um instrutor com esse nome nesse local.");
    }

    showLoading();

    await addDoc(collection(db, "instrutores"), {
      nome: nomeValue,
      localId: local.id,
      localNome: local.nome,
      distrito: DISTRITO_FIXO,
      ativo: true,
      criadoPor: state.user.uid,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    instrutorForm?.reset();
    showMessage("Instrutor cadastrado com sucesso.", "success");
    await refreshData();
  } catch (error) {
    console.error("Erro ao criar instrutor:", error);
    showMessage(error.message || "Não foi possível criar o instrutor.", "error");
  } finally {
    hideLoading();
  }
}

async function editInstrutor(id) {
  if (!canManageInstrutores()) {
    showMessage("Sem permissão para editar instrutores.", "error");
    return;
  }

  const item = getInstrutorById(id);
  if (!item) return;

  if (isLider() && !isAdmin()) {
    const localId = getCurrentUserLocalId();
    const localNome = normalizeText(getCurrentUserLocalName());

    const sameLocal = localId
      ? item.localId === localId
      : normalizeText(item.localNome) === localNome;

    if (!sameLocal) {
      showMessage("Você não pode editar instrutor de outro local.", "error");
      return;
    }
  }

  const novoNome = window.prompt("Editar nome do instrutor:", item.nome);
  if (novoNome === null) return;

  const nomeFinal = novoNome.trim();
  if (!nomeFinal) {
    showMessage("O nome do instrutor não pode ficar vazio.", "error");
    return;
  }

  try {
    showLoading();

    await updateDoc(doc(db, "instrutores", id), {
      nome: nomeFinal,
      atualizadoEm: new Date().toISOString(),
      updatedAt: serverTimestamp()
    });

    // atualizar interessados que usam esse instrutor
    const impacted = state.interessados.filter((interessado) =>
      ensureArray(interessado.instrutorIds).includes(id)
    );

    await Promise.all(
      impacted.map(async (interessado) => {
        const nomesAtualizados = ensureArray(interessado.instrutorIds)
          .map((instrutorId) => {
            if (instrutorId === id) return nomeFinal;
            return getInstrutorById(instrutorId)?.nome || nomeFinal;
          });

        await updateDoc(doc(db, "interessados", interessado.id), {
          instrutorNomes: nomesAtualizados,
          instrutorNome: nomesAtualizados[0] || "",
          atualizadoEm: new Date().toISOString(),
          updatedAt: serverTimestamp()
        });
      })
    );

    showMessage("Instrutor atualizado com sucesso.", "success");
    await refreshData();
  } catch (error) {
    console.error("Erro ao editar instrutor:", error);
    showMessage("Não foi possível editar o instrutor.", "error");
  } finally {
    hideLoading();
  }
}

async function deleteInstrutor(id) {
  if (!canManageInstrutores()) {
    showMessage("Sem permissão para excluir instrutores.", "error");
    return;
  }

  const item = getInstrutorById(id);
  if (!item) return;

  if (isLider() && !isAdmin()) {
    const localId = getCurrentUserLocalId();
    const localNome = normalizeText(getCurrentUserLocalName());

    const sameLocal = localId
      ? item.localId === localId
      : normalizeText(item.localNome) === localNome;

    if (!sameLocal) {
      showMessage("Você não pode excluir instrutor de outro local.", "error");
      return;
    }
  }

  const inUse = state.interessados.some((interessado) =>
    ensureArray(interessado.instrutorIds).includes(id)
  );

  if (inUse) {
    showMessage("Esse instrutor está vinculado a interessados.", "error");
    return;
  }

  const confirmed = window.confirm(`Excluir o instrutor "${item.nome}"?`);
  if (!confirmed) return;

  try {
    showLoading();
    await deleteDoc(doc(db, "instrutores", id));
    showMessage("Instrutor excluído com sucesso.", "success");
    await refreshData();
  } catch (error) {
    console.error("Erro ao excluir instrutor:", error);
    showMessage("Não foi possível excluir o instrutor.", "error");
  } finally {
    hideLoading();
  }
}

/* =========================
   USUÁRIOS
========================= */
async function createUserWithSecondaryApp({ nome, email, senha, perfil, localId }) {
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
    const local = localId ? getLocalById(localId) : null;

    await setDoc(doc(db, "usuarios", uid), {
      nome,
      email,
      perfil,
      localId: local?.id || "",
      localNome: local?.nome || "",
      igreja: local?.nome || "",
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

function mapUserCreationError(error) {
  const code = error?.code || "";

  switch (code) {
    case "auth/email-already-in-use":
      return "Esse e-mail já está em uso.";
    case "auth/invalid-email":
      return "E-mail inválido.";
    case "auth/weak-password":
      return "A senha precisa ter pelo menos 6 caracteres.";
    default:
      return error?.message || "Não foi possível criar o usuário.";
  }
}

async function handleUserFormSubmit(event) {
  event.preventDefault();
  clearMessage();

  if (!canManageUsers()) {
    showMessage("Apenas administradores podem criar usuários.", "error");
    return;
  }

  const nomeValue = novoUsuarioNome?.value.trim();
  const emailValue = novoUsuarioEmail?.value.trim();
  const senhaValue = novoUsuarioSenha?.value;
  const perfilValue = novoUsuarioPerfil?.value;

  let localId = "";
  if (novoUsuarioIgreja) {
    if (novoUsuarioIgreja.tagName === "SELECT") {
      localId = novoUsuarioIgreja.value;
    } else {
      const found = state.locais.find(
        (item) => normalizeText(item.nome) === normalizeText(novoUsuarioIgreja.value)
      );
      localId = found?.id || "";
    }
  }

  if (!nomeValue || !emailValue || !senhaValue) {
    showMessage("Preencha nome, e-mail e senha.", "error");
    return;
  }

  if (!["admin", "lider"].includes(perfilValue)) {
    showMessage("Perfil inválido. Use admin ou lider.", "error");
    return;
  }

  if (perfilValue === "lider" && !localId) {
    showMessage("Selecione o local do líder.", "error");
    return;
  }

  try {
    showLoading();

    await createUserWithSecondaryApp({
      nome: nomeValue,
      email: emailValue,
      senha: senhaValue,
      perfil: perfilValue,
      localId
    });

    userForm?.reset();
    showMessage("Usuário criado com sucesso.", "success");
    await refreshData();
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    showMessage(mapUserCreationError(error), "error");
  } finally {
    hideLoading();
  }
}

/* =========================
   HELPERS ADMIN
========================= */
async function initializeDefaultLocais() {
  if (!isAdmin()) {
    showMessage("Apenas administradores podem inicializar locais.", "error");
    return;
  }

  try {
    showLoading();

    const existingMap = new Set(state.locais.map((item) => normalizeText(item.nome)));
    const missing = DEFAULT_LOCAIS.filter((item) => !existingMap.has(normalizeText(item.nome)));

    await Promise.all(
      missing.map((item) =>
        addDoc(collection(db, "locais"), {
          nome: item.nome,
          tipo: item.tipo,
          distrito: DISTRITO_FIXO,
          ativo: true,
          criadoPor: state.user.uid,
          criadoEm: new Date().toISOString(),
          atualizadoEm: new Date().toISOString(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
      )
    );

    showMessage("Locais padrão inicializados com sucesso.", "success");
    await refreshData();
  } catch (error) {
    console.error("Erro ao inicializar locais:", error);
    showMessage("Não foi possível inicializar os locais padrão.", "error");
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

      if (targetSection === "catalogoSection" && !canManageSeries()) return;
      if (targetSection === "usuariosSection" && !canManageUsers()) return;
      if (targetSection === "locaisSection" && !canManageLocais()) return;
      if (targetSection === "instrutoresSection" && !canManageInstrutores()) return;

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
  userForm?.addEventListener("submit", handleUserFormSubmit);
  localForm?.addEventListener("submit", handleLocalFormSubmit);
  instrutorForm?.addEventListener("submit", handleInstrutorFormSubmit);

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

  instrutoresList?.addEventListener("click", async (event) => {
    const editBtn = event.target.closest("[data-edit-instrutor]");
    const deleteBtn = event.target.closest("[data-delete-instrutor]");

    if (editBtn) {
      await editInstrutor(editBtn.dataset.editInstrutor);
    }

    if (deleteBtn) {
      await deleteInstrutor(deleteBtn.dataset.deleteInstrutor);
    }
  });
}

/* =========================
   AUTH READY
========================= */
window.addEventListener("auth-ready", async (event) => {
  const detail = event.detail;

  if (!detail?.ready) return;

  if (!detail?.firebaseUser || !detail?.profile) {
    state.user = null;
    state.interessados = [];
    state.series = [];
    state.usuarios = [];
    state.locais = [];
    state.instrutores = [];
    return;
  }

  state.user = {
    uid: detail.firebaseUser.uid,
    ...detail.profile
  };

  const allowedPerfis = ["admin", "lider"];
  if (!allowedPerfis.includes(state.user.perfil)) {
    showMessage("Perfil sem acesso ao sistema.", "error");
    return;
  }

  if (!isAdmin()) {
    document.querySelectorAll(".admin-only").forEach((el) => {
      el.style.display = "none";
    });

    if (
      ["catalogoSection", "usuariosSection", "locaisSection"].includes(state.activeSection)
    ) {
      setSection("dashboardSection");
    }
  }

  await refreshData();
});

/* =========================
   START
========================= */
bindStaticEvents();
renderFilters();
renderStatusAndInterestOptions();
renderSerieOptions();
updateProgressPreview();

/* =========================
   DEBUG GLOBAL
========================= */
window.esplanadaApp = {
  state,
  refreshData,
  editInteressado,
  deleteInteressado,
  editSerie,
  deleteSerie,
  editLocal,
  deleteLocal,
  editInstrutor,
  deleteInstrutor,
  initializeDefaultLocais
};
