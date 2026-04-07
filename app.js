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

const state = {
  user: null,
  interessados: [],
  series: [],
  usuarios: [],
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

function canManageSeries() {
  return isAdmin();
}

function canManageUsers() {
  return isAdmin();
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

function getSerieById(id) {
  return state.series.find((s) => s.id === id);
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

function getVisibleInteressados() {
  let data = [...state.interessados];

  if (!isAdmin()) {
    data = data.filter((item) => item.instrutorId === state.user.uid);
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
      return (
        normalizeText(item.nome).includes(search) ||
        normalizeText(item.telefone).includes(search) ||
        normalizeText(item.igreja).includes(search) ||
        normalizeText(item.distrito).includes(search) ||
        normalizeText(item.instrutorNome).includes(search) ||
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
    usuariosSection: "Usuários"
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

function renderInstrutorOptions(selectedId = "") {
  if (!instrutor) return;

  if (!isAdmin()) {
    instrutor.disabled = true;
    instrutor.innerHTML = state.user
      ? `<option value="${state.user.uid}">${escapeHtml(state.user.nome)}</option>`
      : `<option value="">Instrutor</option>`;
    instrutor.value = state.user?.uid || "";
    return;
  }

  const users = sortByName(state.usuarios).filter((u) => u.ativo === true);

  instrutor.disabled = false;
  instrutor.innerHTML =
    `<option value="">Selecionar instrutor</option>` +
    users
      .map(
        (u) =>
          `<option value="${u.id}">${escapeHtml(u.nome)}${u.perfil === "admin" ? " — Admin" : ""}</option>`
      )
      .join("");

  if (selectedId) {
    instrutor.value = selectedId;
  }
}

function resetInteressadoForm() {
  interessadoForm?.reset();
  interessadoId.value = "";
  interessadoModalTitle.textContent = "Novo interessado";

  renderSerieOptions();
  renderInstrutorOptions();
  renderStatusAndInterestOptions();

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
  igreja.value = item.igreja || "";
  distrito.value = item.distrito || "";
  renderInstrutorOptions(item.instrutorId || "");
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
            <span class="tiny-muted">${escapeHtml(item.instrutorNome || "-")}</span>
          </div>
          <p class="stack-item-sub">
            ${escapeHtml(item.igreja || "Sem igreja")} • ${escapeHtml(item.serieNome || "Sem série")}
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
            <span class="tiny-muted">${escapeHtml(item.igreja || "Sem igreja")} • ${escapeHtml(item.distrito || "Sem distrito")}</span>
          </td>
          <td>${escapeHtml(item.instrutorNome || "-")}</td>
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
            ${escapeHtml(usuario.email || "-")} • ${escapeHtml(usuario.igreja || "Sem igreja")} • ${escapeHtml(usuario.distrito || "Sem distrito")}
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

function renderAll() {
  renderFilters();
  renderSerieOptions();
  renderInstrutorOptions();
  renderStatusAndInterestOptions();
  updateProgressPreview();
  renderMetrics();
  renderRecentList();
  renderAttentionList();
  renderInteressadosTable();
  renderSeriesList();
  renderUsuariosList();
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
  if (!isAdmin()) {
    state.usuarios = [];
    return;
  }

  const snap = await getDocs(collection(db, "usuarios"));
  state.usuarios = snap.docs.map((item) => ({
    id: item.id,
    ...item.data()
  }));
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

  const q = query(
    collection(db, "interessados"),
    where("instrutorId", "==", state.user.uid)
  );

  const snap = await getDocs(q);
  state.interessados = snap.docs.map((item) => ({
    id: item.id,
    ...item.data()
  }));
}

async function refreshData() {
  if (!state.user) return;

  showLoading();
  clearMessage();

  try {
    await Promise.all([
      loadSeries(),
      loadInteressados(),
      loadUsuarios()
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
function resolveInstrutorData() {
  if (!isAdmin()) {
    return {
      instrutorId: state.user.uid,
      instrutorNome: state.user.nome
    };
  }

  const selectedId = instrutor.value;
  if (!selectedId) {
    throw new Error("Selecione um instrutor.");
  }

  const matchedUser = state.usuarios.find(
    (u) => u.id === selectedId && u.ativo === true
  );

  if (!matchedUser) {
    throw new Error("Instrutor inválido.");
  }

  return {
    instrutorId: matchedUser.id,
    instrutorNome: matchedUser.nome
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

    const instrutorData = resolveInstrutorData();
    const progress = calcProgress(estudoAtual.value, selectedSerie.totalEstudos);

    const payload = {
      nome: nome.value.trim(),
      telefone: telefone.value.trim(),
      endereco: endereco.value.trim(),
      igreja: igreja.value.trim(),
      distrito: distrito.value.trim(),
      instrutorId: instrutorData.instrutorId,
      instrutorNome: instrutorData.instrutorNome,
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

      if (!isAdmin() && existing.instrutorId !== state.user.uid) {
        throw new Error("Você não pode editar um registro de outro instrutor.");
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

  if (!isAdmin() && item.instrutorId !== state.user.uid) {
    showMessage("Você não pode editar esse registro.", "error");
    return;
  }

  fillInteressadoForm(item);
  openInteressadoModal();
}

async function deleteInteressado(id) {
  const item = state.interessados.find((row) => row.id === id);
  if (!item) return;

  if (!isAdmin() && item.instrutorId !== state.user.uid) {
    showMessage("Você não pode excluir esse registro.", "error");
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
   USUÁRIOS
========================= */
async function createUserWithSecondaryApp({ nome, email, senha, perfil, igreja, distrito }) {
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
      perfil,
      igreja,
      distrito,
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

  const nomeValue = novoUsuarioNome.value.trim();
  const emailValue = novoUsuarioEmail.value.trim();
  const senhaValue = novoUsuarioSenha.value;
  const perfilValue = novoUsuarioPerfil.value;
  const igrejaValue = novoUsuarioIgreja.value.trim();
  const distritoValue = novoUsuarioDistrito.value.trim();

  if (!nomeValue || !emailValue || !senhaValue) {
    showMessage("Preencha nome, e-mail e senha.", "error");
    return;
  }

  try {
    showLoading();

    await createUserWithSecondaryApp({
      nome: nomeValue,
      email: emailValue,
      senha: senhaValue,
      perfil: perfilValue,
      igreja: igrejaValue,
      distrito: distritoValue
    });

    userForm.reset();
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
   EVENTOS
========================= */
function bindStaticEvents() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetSection = btn.dataset.section;

      if (targetSection === "catalogoSection" && !canManageSeries()) return;
      if (targetSection === "usuariosSection" && !canManageUsers()) return;

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
    return;
  }

  state.user = {
    uid: detail.firebaseUser.uid,
    ...detail.profile
  };

  if (!isAdmin()) {
    document.querySelectorAll(".admin-only").forEach((el) => {
      el.style.display = "none";
    });

    if (
      state.activeSection === "catalogoSection" ||
      state.activeSection === "usuariosSection"
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
  deleteSerie
};