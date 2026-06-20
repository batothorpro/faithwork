
const API = '';
let token = localStorage.getItem('fw_token');
let currentUser = JSON.parse(localStorage.getItem('fw_user') || 'null');
let accountType = localStorage.getItem('fw_account_type') || 'user';
let ws = null;
let activeChat = null;
let previousView = 'feed';
let allJobs = [];
let regAccountType = 'user';

document.addEventListener('DOMContentLoaded', () => {
  if (token && currentUser) showApp();
  else document.getElementById('auth-screen').classList.remove('hidden');

  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('global-search-dropdown');
    const searchBox = document.querySelector('.header-search');
    if (dropdown && searchBox && !searchBox.contains(e.target)) dropdown.classList.add('hidden');
  });
});

// ===== AUTH TABS =====
function showTab(tab) {
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
  document.getElementById('forgot-form').classList.toggle('hidden', tab !== 'forgot');
  document.querySelectorAll('.auth-tab').forEach((t, i) => t.classList.toggle('active', i === (tab === 'login' ? 0 : 1) && tab !== 'forgot'));
}

function showForgotPassword() {
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.add('hidden');
  document.getElementById('forgot-form').classList.remove('hidden');
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
}

function setAccountType(type) {
  regAccountType = type;
  document.getElementById('acc-type-user').classList.toggle('active', type === 'user');
  document.getElementById('acc-type-company').classList.toggle('active', type === 'company');
  document.getElementById('register-fields-user').classList.toggle('hidden', type !== 'user');
  document.getElementById('register-fields-company').classList.toggle('hidden', type !== 'company');
}

// ===== LOGIN =====
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');
  if (!email || !password) { showError(errEl, 'Completa todos los campos'); return; }
  const res = await apiFetch('/api/auth/login', 'POST', { email, password }, false);
  if (res.error) { showError(errEl, res.error); return; }
  saveSession(res.token, res.user, res.accountType);
  showApp();
}

// ===== REGISTER =====
async function doRegister() {
  const errEl = document.getElementById('reg-error');
  errEl.classList.add('hidden');

  if (regAccountType === 'user') {
    const nombre = document.getElementById('reg-nombre').value.trim();
    const apellido = document.getElementById('reg-apellido').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const ciudad = document.getElementById('reg-ciudad').value.trim();
    const iglesia = document.getElementById('reg-iglesia').value.trim();
    if (!nombre || !apellido || !email || !password) { showError(errEl, 'Completa todos los campos'); return; }
    if (password.length < 6) { showError(errEl, 'La contraseña debe tener al menos 6 caracteres'); return; }
    const res = await apiFetch('/api/auth/register', 'POST', { nombre, apellido, email, password, ciudad, iglesia }, false);
    if (res.error) { showError(errEl, res.error); return; }
    saveSession(res.token, res.user, res.accountType);
  } else {
    const nombre = document.getElementById('reg-c-nombre').value.trim();
    const email = document.getElementById('reg-c-email').value.trim();
    const password = document.getElementById('reg-c-password').value;
    const sector = document.getElementById('reg-c-sector').value.trim();
    const ciudad = document.getElementById('reg-c-ciudad').value.trim();
    const sitio_web = document.getElementById('reg-c-web').value.trim();
    const descripcion = document.getElementById('reg-c-desc').value.trim();
    if (!nombre || !email || !password) { showError(errEl, 'Completa los campos requeridos'); return; }
    if (password.length < 6) { showError(errEl, 'La contraseña debe tener al menos 6 caracteres'); return; }
    const res = await apiFetch('/api/auth/register-company', 'POST', { nombre, email, password, sector, ciudad, sitio_web, descripcion }, false);
    if (res.error) { showError(errEl, res.error); return; }
    saveSession(res.token, res.user, res.accountType);
  }
  showApp();
}

// ===== FORGOT PASSWORD =====
async function doForgotPassword() {
  const email = document.getElementById('forgot-email').value.trim();
  const errEl = document.getElementById('forgot-error');
  const okEl = document.getElementById('forgot-success');
  errEl.classList.add('hidden'); okEl.classList.add('hidden');
  if (!email) { showError(errEl, 'Ingresa tu correo electrónico'); return; }
  const res = await apiFetch('/api/auth/forgot-password', 'POST', { email }, false);
  if (res.error) { showError(errEl, res.error); return; }
  okEl.textContent = 'Si el correo existe en nuestro sistema, recibirás un enlace de recuperación en unos minutos.';
  okEl.classList.remove('hidden');
}

function saveSession(t, user, accType) {
  token = t; currentUser = user; accountType = accType || 'user';
  localStorage.setItem('fw_token', t);
  localStorage.setItem('fw_user', JSON.stringify(user));
  localStorage.setItem('fw_account_type', accountType);
}

function logout() {
  token = null; currentUser = null; accountType = 'user';
  localStorage.removeItem('fw_token'); localStorage.removeItem('fw_user'); localStorage.removeItem('fw_account_type');
  if (ws) ws.close();
  document.getElementById('main-app').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
  showTab('login');
}

function showApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('main-app').classList.remove('hidden');
  loadSidebarProfile();
  connectWS();
  showView('feed');
  if (accountType === 'user') loadContactRequests();
  // Ocultar nav de "Mi Red" para empresas (solo conecta personas entre sí)
  document.querySelectorAll('[data-view="contacts"]').forEach(el => el.style.display = accountType === 'company' ? 'none' : '');
}

async function loadSidebarProfile() {
  const user = await apiFetch('/api/users/me');
  if (user && !user.error) {
    currentUser = { ...currentUser, ...user };
    localStorage.setItem('fw_user', JSON.stringify(currentUser));
    const displayName = accountType === 'company' ? user.nombre : (user.nombre + ' ' + user.apellido);
    document.getElementById('sidebar-name').textContent = displayName;
    const initials = accountType === 'company' ? (user.nombre||'?')[0].toUpperCase() : ((user.nombre||'?')[0] + (user.apellido||'')[0]).toUpperCase();
    const photoUrl = accountType === 'company' ? user.logo : user.foto;

    const avatarEl = document.getElementById('sidebar-avatar');
    const composerAv = document.getElementById('composer-avatar');
    if (photoUrl) {
      const imgHtml = '<img src="' + esc(photoUrl) + '" style="width:100%;height:100%;object-fit:cover">';
      avatarEl.innerHTML = imgHtml;
      if (composerAv) composerAv.innerHTML = imgHtml;
    } else {
      avatarEl.textContent = initials;
      if (composerAv) composerAv.textContent = initials;
    }
    if (accountType === 'company') avatarEl.style.borderRadius = '8px';
  }
}

// ===== WEBSOCKET =====
function connectWS() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(proto + '://' + location.host);
  ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token }));
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'message' || msg.type === 'message_sent') handleIncomingMessage(msg);
  };
  ws.onclose = () => setTimeout(connectWS, 3000);
}

function handleIncomingMessage(msg) {
  const isMe = msg.type === 'message_sent';
  const otherId = isMe ? msg.receiver_id : msg.sender_id;
  if (activeChat && activeChat.userId === otherId) appendMessage(msg.contenido, isMe, msg.created_at);
  loadConversations();
  if (!isMe) {
    const badge = document.getElementById('msg-badge');
    badge.textContent = (parseInt(badge.textContent) || 0) + 1;
    badge.classList.remove('hidden');
  }
}

// ===== GLOBAL SEARCH (header) =====
let searchDebounce;
async function globalSearch(q) {
  clearTimeout(searchDebounce);
  const dropdown = document.getElementById('global-search-dropdown');
  if (!q.trim()) { dropdown.classList.add('hidden'); return; }
  searchDebounce = setTimeout(async () => {
    const res = await apiFetch('/api/users/search?q=' + encodeURIComponent(q));
    renderSearchDropdown(res);
  }, 250);
}

function showSearchDropdown() {
  const input = document.getElementById('global-search');
  if (input.value.trim()) document.getElementById('global-search-dropdown').classList.remove('hidden');
}

function renderSearchDropdown(res) {
  const dropdown = document.getElementById('global-search-dropdown');
  const people = res?.people || [];
  const companies = res?.companies || [];
  if (!people.length && !companies.length) {
    dropdown.innerHTML = '<div class="search-dropdown-empty">No se encontraron resultados</div>';
    dropdown.classList.remove('hidden');
    return;
  }
  let html = '';
  if (people.length) {
    html += '<div class="search-dropdown-section"><div class="search-dropdown-label">Personas</div>' +
      people.map(p => '<div class="search-dropdown-item" onclick="closeSearchAndGo(\'' + p.id + '\',\'user\')">' +
        '<div class="avatar-sm">' + (p.nombre||'?')[0]+(p.apellido||'')[0] + '</div>' +
        '<div><div class="search-dropdown-name">' + esc(p.nombre)+' '+esc(p.apellido) + '</div><div class="search-dropdown-meta">' + esc(p.cargo||'') + '</div></div></div>').join('') +
      '</div>';
  }
  if (companies.length) {
    html += '<div class="search-dropdown-section"><div class="search-dropdown-label">Empresas</div>' +
      companies.map(c => '<div class="search-dropdown-item" onclick="closeSearchAndGo(\'' + c.id + '\',\'company\')">' +
        '<div class="avatar-sm" style="border-radius:6px">' + (c.nombre||'?')[0] + '</div>' +
        '<div><div class="search-dropdown-name">' + esc(c.nombre) + '</div><div class="search-dropdown-meta">' + esc(c.sector||'') + '</div></div></div>').join('') +
      '</div>';
  }
  dropdown.innerHTML = html;
  dropdown.classList.remove('hidden');
}

function closeSearchAndGo(id, type) {
  document.getElementById('global-search-dropdown').classList.add('hidden');
  document.getElementById('global-search').value = '';
  if (type === 'company') showCompanyProfile(id);
  else showUserProfile(id);
}

// ===== NAVIGATION =====
function showView(viewId) {
  const cur = document.querySelector('.view.active');
  if (cur) previousView = cur.id.replace('view-', '');
  document.querySelectorAll('.view').forEach(v => { v.classList.remove('active'); v.classList.add('hidden'); });
  const el = document.getElementById('view-' + viewId);
  if (el) { el.classList.add('active'); el.classList.remove('hidden'); }
  document.querySelectorAll('.header-nav-item, .mobile-nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === viewId));
  if (viewId === 'feed') loadFeedJobs();
  else if (viewId === 'jobs') loadAllJobs();
  else if (viewId === 'social') loadSocialFeed();
  else if (viewId === 'contacts') loadContacts();
  else if (viewId === 'messages') loadConversations();
  else if (viewId === 'my-jobs') loadMyJobsAndApps();
  else if (viewId === 'profile-me') loadMyProfile();
}

function goBack() { showView(previousView || 'feed'); }

// ===== JOBS =====
async function loadFeedJobs() {
  const jobs = await apiFetch('/api/jobs');
  allJobs = jobs || [];
  renderJobs('feed-jobs', allJobs);
}

async function loadAllJobs() {
  const jobs = await apiFetch('/api/jobs');
  allJobs = jobs || [];
  renderJobs('jobs-list', allJobs);
}

function renderJobs(containerId, jobs) {
  const el = document.getElementById(containerId);
  if (!jobs || !jobs.length) { el.innerHTML = '<div class="loading">No hay ofertas aún. ¡Sé el primero en publicar!</div>'; return; }
  el.innerHTML = jobs.map(j => jobCardHTML(j)).join('');
}

function iconBriefcase() { return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2"/><path d="M3 13h18"/></svg>'; }
function iconPin() { return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s7-7.5 7-12a7 7 0 10-14 0c0 4.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.3"/></svg>'; }
function iconCash() { return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>'; }

function jobCardHTML(j) {
  const initials = (j.poster_nombre || j.empresa || 'E')[0].toUpperCase();
  const tipoMap = { 'full-time': 'Tiempo completo', 'part-time': 'Medio tiempo', 'freelance': 'Freelance', 'practica': 'Práctica' };
  const modalMap = { 'presencial': 'Presencial', 'remoto': 'Remoto', 'hibrido': 'Híbrido' };
  const isCompanyPoster = j.poster_type === 'company';
  return '<div class="job-card" onclick="showJobDetail(\'' + j.id + '\')">' +
    '<div class="job-card-top"><div class="job-company-avatar">' + initials + '</div>' +
    '<div class="job-card-info"><div class="job-card-title">' + esc(j.titulo) + '</div><div class="job-card-company">' + esc(j.empresa) + '</div></div></div>' +
    '<div class="job-tags"><span class="tag tag-tipo">' + iconBriefcase() + (tipoMap[j.tipo] || j.tipo) + '</span><span class="tag tag-modalidad">' + (modalMap[j.modalidad] || j.modalidad) + '</span>' +
    (j.ciudad ? '<span class="tag tag-ciudad">' + iconPin() + esc(j.ciudad) + '</span>' : '') +
    (j.salario ? '<span class="tag tag-ciudad">' + iconCash() + esc(j.salario) + '</span>' : '') + '</div>' +
    '<div class="job-card-desc">' + esc((j.descripcion || '').slice(0, 140) + (j.descripcion?.length > 140 ? '...' : '')) + '</div>' +
    '<div class="job-card-footer"><div class="job-poster">' + esc(j.poster_nombre || '') + ' ' + esc(j.poster_apellido || '') + ' · ' + timeAgo(j.created_at) + '</div>' +
    '<span class="job-aplicantes">' + (j.total_aplicantes || 0) + ' aplicantes</span></div></div>';
}

async function showJobDetail(jobId) {
  const job = await apiFetch('/api/jobs/' + jobId);
  if (!job || job.error) return;
  const isOwner = (job.user_id === currentUser?.id) || (job.company_id === currentUser?.id);
  const tipoMap = { 'full-time': 'Tiempo completo', 'part-time': 'Medio tiempo', 'freelance': 'Freelance', 'practica': 'Práctica' };
  const nivelMap = { 'sin-experiencia': 'Sin experiencia', 'junior': 'Junior (1-2 años)', 'intermedio': 'Intermedio (2-5 años)', 'senior': 'Senior (5+ años)', 'directivo': 'Directivo / Gerencial' };

  let metaBoxes = '';
  if (job.vacantes) metaBoxes += '<div class="meta-box"><div class="meta-box-label">Vacantes</div><div class="meta-box-value">' + job.vacantes + '</div></div>';
  if (job.nivel_experiencia) metaBoxes += '<div class="meta-box"><div class="meta-box-label">Experiencia</div><div class="meta-box-value">' + (nivelMap[job.nivel_experiencia]||job.nivel_experiencia) + '</div></div>';
  if (job.fecha_limite) metaBoxes += '<div class="meta-box"><div class="meta-box-label">Fecha límite</div><div class="meta-box-value">' + job.fecha_limite + '</div></div>';

  const posterId = job.poster_type === 'company' ? job.company_id : job.user_id;
  const posterClickFn = job.poster_type === 'company' ? 'showCompanyProfile' : 'showUserProfile';

  document.getElementById('job-detail-content').innerHTML =
    '<div class="job-detail-card">' +
    '<div class="job-detail-header"><div class="job-detail-avatar">' + (job.poster_nombre||job.empresa||'E')[0] + '</div><div>' +
    '<div class="job-detail-title">' + esc(job.titulo) + '</div><div class="job-detail-company">' + esc(job.empresa) + '</div>' +
    '<div class="job-tags" style="margin-top:.5rem"><span class="tag tag-tipo">' + (tipoMap[job.tipo]||job.tipo) + '</span>' +
    '<span class="tag tag-modalidad">' + esc(job.modalidad) + '</span>' +
    (job.ciudad ? '<span class="tag tag-ciudad">' + iconPin() + esc(job.ciudad) + '</span>' : '') +
    (job.salario ? '<span class="tag tag-ciudad">' + iconCash() + esc(job.salario) + '</span>' : '') + '</div></div></div>' +
    (metaBoxes ? '<div class="job-detail-meta-grid">' + metaBoxes + '</div>' : '') +
    '<div class="job-detail-section"><h4>Descripción</h4><p>' + esc(job.descripcion) + '</p></div>' +
    (job.requisitos ? '<div class="job-detail-section"><h4>Requisitos</h4><p>' + esc(job.requisitos) + '</p></div>' : '') +
    (job.beneficios ? '<div class="job-detail-section"><h4>Beneficios</h4><p>' + esc(job.beneficios) + '</p></div>' : '') +
    '<div class="job-detail-section"><h4>Publicado por</h4>' +
    '<div style="display:flex;align-items:center;gap:.7rem;cursor:pointer" onclick="' + posterClickFn + '(\'' + posterId + '\')">' +
    '<div class="avatar-sm">' + (job.poster_nombre||'?')[0] + (job.poster_apellido||'')[0] + '</div>' +
    '<div><div style="font-weight:600">' + esc(job.poster_nombre) + ' ' + esc(job.poster_apellido||'') + '</div>' +
    '<div style="font-size:.82rem;color:var(--gray-3)">' + esc(job.poster_iglesia||'') + (job.user_ciudad ? ' · '+esc(job.user_ciudad):'') + '</div></div></div></div>' +
    '<div class="job-actions">' +
    (isOwner
      ? '<button class="btn-primary" onclick="showApplicants(\'' + job.id + '\')">Ver aplicantes</button>' +
        '<button class="btn-danger" onclick="closeJob(\'' + job.id + '\')">Cerrar oferta</button>'
      : accountType === 'company'
        ? ''
        : job.ya_aplique
          ? '<button class="btn-outline" disabled>&#10003; Ya aplicaste</button>'
          : '<button class="btn-primary" onclick="showApplyModal(\'' + job.id + '\')">Aplicar ahora</button>') +
    (accountType === 'user' ? '<button class="btn-outline" onclick="showShareJobModal(\'' + job.id + '\',\'' + esc(job.titulo) + '\')">Compartir</button>' : '') +
    '</div></div>';
  showView('job-detail');
}

async function postJob() {
  const titulo = document.getElementById('job-titulo').value.trim();
  const empresa = document.getElementById('job-empresa').value.trim();
  const descripcion = document.getElementById('job-descripcion').value.trim();
  const requisitos = document.getElementById('job-requisitos').value.trim();
  const beneficios = document.getElementById('job-beneficios').value.trim();
  const tipo = document.getElementById('job-tipo').value;
  const modalidad = document.getElementById('job-modalidad').value;
  const ciudad = document.getElementById('job-ciudad').value.trim();
  const salario = document.getElementById('job-salario').value.trim();
  const area = document.getElementById('job-area').value;
  const nivel_experiencia = document.getElementById('job-nivel').value;
  const vacantes = document.getElementById('job-vacantes').value;
  const fecha_limite = document.getElementById('job-fecha-limite').value;
  const errEl = document.getElementById('job-error');
  errEl.classList.add('hidden');
  if (!titulo || !empresa || !descripcion) { showError(errEl, 'Completa los campos requeridos'); return; }
  const res = await apiFetch('/api/jobs', 'POST', { titulo, empresa, descripcion, requisitos, beneficios, tipo, modalidad, ciudad, salario, area, nivel_experiencia, vacantes, fecha_limite });
  if (res.error) { showError(errEl, res.error); return; }
  showToast('&#10003; Oferta publicada exitosamente', 'success');
  ['job-titulo','job-empresa','job-descripcion','job-requisitos','job-beneficios','job-ciudad','job-salario','job-fecha-limite'].forEach(id => document.getElementById(id).value = '');
  showView('feed');
}

function showApplyModal(jobId) {
  document.getElementById('modal-content').innerHTML =
    '<div class="modal-title">Aplicar a esta oferta</div>' +
    '<div class="form-group"><label>Mensaje para el empleador (opcional)</label>' +
    '<textarea id="apply-msg" rows="4" placeholder="Cuéntale por qué eres ideal..."></textarea></div>' +
    '<div style="display:flex;gap:.75rem;margin-top:.5rem">' +
    '<button class="btn-primary" onclick="submitApply(\'' + jobId + '\')">Enviar aplicación</button>' +
    '<button class="btn-outline" onclick="closeModal()">Cancelar</button></div>';
  openModal();
}

async function submitApply(jobId) {
  const mensaje = document.getElementById('apply-msg').value.trim();
  const res = await apiFetch('/api/jobs/' + jobId + '/apply', 'POST', { mensaje });
  if (res.error) { showToast(res.error, 'error'); return; }
  closeModal();
  showToast('&#10003; Aplicación enviada', 'success');
  showJobDetail(jobId);
}

async function showApplicants(jobId) {
  const applicants = await apiFetch('/api/jobs/' + jobId + '/applicants');
  if (!applicants || applicants.error) return;
  const rows = applicants.length === 0
    ? '<p style="text-align:center;color:var(--gray-3);padding:1rem">Aún no hay aplicantes</p>'
    : applicants.map(a =>
        '<div class="applicant-row">' +
        '<div class="avatar-sm" onclick="showUserProfile(\'' + a.user_id + '\')" style="cursor:pointer">' + (a.nombre||'?')[0] + (a.apellido||'')[0] + '</div>' +
        '<div class="applicant-info"><div class="applicant-name" onclick="showUserProfile(\'' + a.user_id + '\')" style="cursor:pointer">' + esc(a.nombre) + ' ' + esc(a.apellido) + '</div>' +
        '<div class="applicant-cargo">' + esc(a.cargo||'') + '</div>' +
        (a.rating_promedio ? '<div style="color:var(--gold);font-size:.82rem">&#9733; ' + parseFloat(a.rating_promedio).toFixed(1) + '</div>' : '') +
        (a.mensaje ? '<div class="applicant-msg">"' + esc(a.mensaje) + '"</div>' : '') + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:.3rem;align-items:flex-end">' +
        '<span class="applicant-status status-' + a.status + '">' + a.status + '</span>' +
        (a.status === 'pendiente'
          ? '<button class="btn-gold" style="font-size:.75rem;padding:.25rem .6rem" onclick="updateApplicant(\'' + jobId + '\',\'' + a.id + '\',\'aceptado\')">Aceptar</button>' +
            '<button class="btn-danger" style="font-size:.75rem;padding:.25rem .6rem" onclick="updateApplicant(\'' + jobId + '\',\'' + a.id + '\',\'rechazado\')">Rechazar</button>' : '') +
        (accountType === 'user' ? '<button class="btn-ghost" style="font-size:.75rem" onclick="openChat(\'' + a.user_id + '\',\'' + esc(a.nombre+' '+a.apellido) + '\')">Chat</button>' : '') +
        '<button class="btn-ghost" style="font-size:.75rem" onclick="showRateModal(\'' + a.user_id + '\',\'' + jobId + '\',\'empleado\')">Calificar</button>' +
        '</div></div>').join('');
  document.getElementById('modal-content').innerHTML = '<div class="modal-title">Aplicantes</div>' + rows;
  openModal();
}

async function updateApplicant(jobId, appId, status) {
  await apiFetch('/api/jobs/' + jobId + '/applicants/' + appId, 'PUT', { status });
  showApplicants(jobId);
}

async function closeJob(jobId) {
  if (!confirm('¿Cerrar esta oferta?')) return;
  await apiFetch('/api/jobs/' + jobId, 'DELETE');
  showToast('Oferta cerrada'); showView('my-jobs');
}

function searchJobs(q) {
  if (!q.trim()) { renderJobs('feed-jobs', allJobs); return; }
  const term = q.toLowerCase();
  renderJobs('feed-jobs', allJobs.filter(j => (j.titulo||'').toLowerCase().includes(term) || (j.empresa||'').toLowerCase().includes(term) || (j.descripcion||'').toLowerCase().includes(term)));
}

async function applyFilters() {
  const tipo = document.getElementById('filter-tipo').value;
  const modalidad = document.getElementById('filter-modalidad').value;
  const ciudad = document.getElementById('filter-ciudad').value;
  let url = '/api/jobs?x=1';
  if (tipo) url += '&tipo=' + tipo;
  if (modalidad) url += '&modalidad=' + modalidad;
  if (ciudad) url += '&ciudad=' + encodeURIComponent(ciudad);
  renderJobs('jobs-list', await apiFetch(url) || []);
}

// ===== CONTACTS =====
async function loadContacts() {
  const contacts = await apiFetch('/api/users/me/contacts');
  const el = document.getElementById('contacts-list');
  if (!contacts || !contacts.length) { el.innerHTML = '<div class="loading">Aún no tienes contactos. ¡Busca personas de tu comunidad!</div>'; return; }
  el.innerHTML = contacts.map(c => personCardHTML(c, 'contact')).join('');
}

async function loadContactRequests() {
  const requests = await apiFetch('/api/users/me/contact-requests');
  if (!requests || !requests.length) return;
  const badge = document.getElementById('contact-requests-badge');
  badge.textContent = requests.length; badge.classList.remove('hidden');
  document.getElementById('contact-requests-section').classList.remove('hidden');
  document.getElementById('contact-requests-list').innerHTML = requests.map(r =>
    '<div class="request-card">' +
    '<div class="avatar-sm">' + (r.nombre||'?')[0] + (r.apellido||'')[0] + '</div>' +
    '<div class="request-info"><div class="request-name">' + esc(r.nombre) + ' ' + esc(r.apellido) + '</div><div class="request-cargo">' + esc(r.cargo||'') + '</div></div>' +
    '<div class="request-actions">' +
    '<button class="btn-gold" style="font-size:.82rem" onclick="respondContact(\'' + r.id + '\',\'accept\')">Aceptar</button>' +
    '<button class="btn-outline small" onclick="respondContact(\'' + r.id + '\',\'reject\')">Ignorar</button></div></div>').join('');
}

async function respondContact(id, action) {
  await apiFetch('/api/users/me/contacts/' + id, 'PUT', { action });
  document.getElementById('contact-requests-section').classList.add('hidden');
  loadContactRequests(); loadContacts();
  showToast(action === 'accept' ? '&#10003; Contacto aceptado' : 'Solicitud ignorada');
}

async function searchPeople(q) {
  const sec = document.getElementById('search-results-section');
  const el = document.getElementById('people-search-results');
  if (!q.trim()) { sec.classList.add('hidden'); return; }
  const res = await apiFetch('/api/users/search?q=' + encodeURIComponent(q));
  sec.classList.remove('hidden');
  const people = res?.people || [];
  if (!people.length) { el.innerHTML = '<div class="loading">No se encontraron personas</div>'; return; }
  el.innerHTML = people.map(p => personCardHTML(p, 'search')).join('');
}

function personCardHTML(p, mode) {
  const initials = ((p.nombre||'?')[0] + (p.apellido||'')[0]).toUpperCase();
  const btns = mode === 'search'
    ? '<button class="btn-outline small" onclick="sendContactRequest(\'' + p.id + '\')">+ Conectar</button><button class="btn-ghost" onclick="showUserProfile(\'' + p.id + '\')">Ver perfil</button>'
    : '<button class="btn-ghost" onclick="openChat(\'' + p.id + '\',\'' + esc(p.nombre+' '+p.apellido) + '\')">Mensaje</button><button class="btn-ghost" onclick="showUserProfile(\'' + p.id + '\')">Ver perfil</button>';
  return '<div class="person-card">' +
    '<div class="person-avatar-lg" onclick="showUserProfile(\'' + p.id + '\')" style="cursor:pointer">' + initials + '</div>' +
    '<div class="person-name">' + esc(p.nombre) + ' ' + esc(p.apellido) + '</div>' +
    (p.cargo ? '<div class="person-cargo">' + esc(p.cargo) + '</div>' : '') +
    (p.ciudad ? '<div class="person-ciudad">' + iconPin() + ' ' + esc(p.ciudad) + '</div>' : '') +
    '<div class="person-card-actions">' + btns + '</div></div>';
}

async function sendContactRequest(userId) {
  const res = await apiFetch('/api/users/me/contacts/' + userId, 'POST', {});
  showToast(res.error ? res.error : '&#10003; Solicitud enviada', res.error ? 'error' : 'success');
}

// ===== USER PROFILE =====
async function showUserProfile(userId) {
  const user = await apiFetch('/api/users/' + userId);
  if (!user || user.error) return;
  const ratings = await apiFetch('/api/users/' + userId + '/ratings');
  const initials = ((user.nombre||'?')[0] + (user.apellido||'')[0]).toUpperCase();
  const avatarInner = user.foto ? '<img src="' + esc(user.foto) + '" style="width:100%;height:100%;object-fit:cover">' : initials;
  document.getElementById('user-profile-content').innerHTML =
    '<div class="profile-card">' +
    '<div class="profile-header"><div class="profile-avatar-xl">' + avatarInner + '</div><div class="profile-header-info">' +
    '<div class="profile-full-name">' + esc(user.nombre) + ' ' + esc(user.apellido) + '</div>' +
    (user.cargo ? '<span class="profile-cargo-badge">' + esc(user.cargo) + '</span>' : '') +
    '<div class="profile-meta">' + (user.ciudad ? iconPin()+' '+esc(user.ciudad) : '') + (user.iglesia ? ' &middot; '+esc(user.iglesia):'') + '</div></div></div>' +
    '<div class="profile-body">' +
    (user.bio ? '<div class="profile-bio">' + esc(user.bio) + '</div>' : '') +
    '<div class="profile-stats"><div class="stat-item"><div class="stat-value stars">' + renderStars(user.rating_promedio) + '</div><div class="stat-label">Calificación ' + (user.rating_promedio ? '('+user.rating_promedio+')':'') + '</div></div>' +
    '<div class="stat-item"><div class="stat-value">' + (user.rating_total||0) + '</div><div class="stat-label">Reseñas</div></div></div>' +
    '<div style="display:flex;gap:.7rem;flex-wrap:wrap;margin-bottom:1.4rem">' +
    (accountType === 'user' ? '<button class="btn-primary" onclick="openChat(\'' + user.id + '\',\'' + esc(user.nombre+' '+user.apellido) + '\')">Enviar mensaje</button>' +
    '<button class="btn-outline" onclick="sendContactRequest(\'' + user.id + '\')">+ Agregar a mi red</button>' : '') + '</div>' +
    (ratings && ratings.length ? '<h3 class="section-title">Reseñas</h3><div class="ratings-list">' +
      ratings.map(r => '<div class="rating-item"><div class="rating-item-header"><div class="avatar-sm" style="width:28px;height:28px;font-size:.7rem">' + (r.nombre||'?')[0]+(r.apellido||'')[0] + '</div><span class="rating-item-name">' + esc(r.nombre)+' '+esc(r.apellido) + '</span><span class="rating-item-tipo">' + esc(r.tipo) + '</span><span class="rating-item-stars">' + '★'.repeat(r.puntuacion) + '☆'.repeat(5-r.puntuacion) + '</span></div>' + (r.comentario ? '<div class="rating-item-comment">' + esc(r.comentario) + '</div>':'') + '<div style="font-size:.75rem;color:var(--gray-3)">En: '+esc(r.job_titulo)+'</div></div>').join('') + '</div>' : '') +
    '<h3 class="section-title" style="margin-top:1.4rem">Publicaciones</h3><div class="profile-posts-grid" id="profile-posts-list-other"></div>' +
    '</div></div>';
  document.querySelectorAll('.view').forEach(v => { v.classList.remove('active'); v.classList.add('hidden'); });
  document.getElementById('view-user-profile').classList.add('active');
  document.getElementById('view-user-profile').classList.remove('hidden');
  loadProfilePosts(userId, 'profile-posts-list-other');
}

// ===== COMPANY PROFILE =====
async function showCompanyProfile(companyId) {
  const company = await apiFetch('/api/users/company/' + companyId);
  if (!company || company.error) return;
  const jobs = await apiFetch('/api/users/company/' + companyId + '/jobs');
  const initial = (company.nombre||'?')[0].toUpperCase();
  const avatarInner = company.logo ? '<img src="' + esc(company.logo) + '" style="width:100%;height:100%;object-fit:cover">' : initial;

  document.getElementById('user-profile-content').innerHTML =
    '<div class="profile-card">' +
    '<div class="profile-header"><div class="profile-avatar-xl company-avatar">' + avatarInner + '</div><div class="profile-header-info">' +
    '<div class="profile-full-name">' + esc(company.nombre) + '</div>' +
    (company.sector ? '<span class="profile-cargo-badge">' + esc(company.sector) + '</span>' : '') +
    '<div class="profile-meta">' + (company.ciudad ? iconPin()+' '+esc(company.ciudad) : '') +
    (company.sitio_web ? ' &middot; <a href="' + esc(company.sitio_web) + '" target="_blank" style="color:inherit">' + esc(company.sitio_web) + '</a>' : '') + '</div></div></div>' +
    '<div class="profile-body">' +
    (company.descripcion ? '<div class="profile-bio">' + esc(company.descripcion) + '</div>' : '') +
    '<div class="profile-stats"><div class="stat-item"><div class="stat-value">' + (company.ofertas_activas||0) + '</div><div class="stat-label">Ofertas activas</div></div></div>' +
    '<h3 class="section-title">Ofertas publicadas</h3>' +
    '<div class="jobs-grid">' + (jobs && jobs.length ? jobs.map(j => jobCardHTML({...j, poster_nombre: company.nombre, poster_type:'company'})).join('') : '<div class="loading">Esta empresa no tiene ofertas activas</div>') + '</div>' +
    '<h3 class="section-title" style="margin-top:1.4rem">Publicaciones</h3><div class="profile-posts-grid" id="profile-posts-list-other"></div>' +
    '</div></div>';
  document.querySelectorAll('.view').forEach(v => { v.classList.remove('active'); v.classList.add('hidden'); });
  document.getElementById('view-user-profile').classList.add('active');
  document.getElementById('view-user-profile').classList.remove('hidden');
  loadProfilePosts(companyId, 'profile-posts-list-other');
}

// ===== MY PROFILE =====
async function loadMyProfile() {
  const user = await apiFetch('/api/users/me');
  if (!user || user.error) return;

  if (accountType === 'company') {
    const initial = (user.nombre||'?')[0].toUpperCase();
    const avatarInner = user.logo ? '<img src="' + esc(user.logo) + '" style="width:100%;height:100%;object-fit:cover">' : initial;
    document.getElementById('my-profile-content').innerHTML =
      '<div class="profile-card">' +
      '<div class="profile-header"><div class="profile-avatar-wrap"><div class="profile-avatar-xl company-avatar">' + avatarInner + '</div>' +
      '<div class="profile-avatar-edit-btn" onclick="triggerProfilePhotoUpload()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5z"/></svg></div></div>' +
      '<div class="profile-header-info">' +
      '<div class="profile-full-name">' + esc(user.nombre) + '</div>' +
      (user.sector ? '<span class="profile-cargo-badge">' + esc(user.sector) + '</span>' : '') +
      '<div class="profile-meta">' + (user.ciudad ? iconPin()+' '+esc(user.ciudad) : '') + '</div></div></div>' +
      '<div class="profile-body">' + (user.descripcion ? '<div class="profile-bio">' + esc(user.descripcion) + '</div>' : '<div class="profile-bio" style="color:var(--gray-3)">Sin descripción. ¡Edita tu perfil para añadir una!</div>') +
      '<h3 class="section-title">Publicaciones</h3><div class="profile-posts-grid" id="profile-posts-list"></div>' +
      '</div></div>';
    document.getElementById('edit-fields-user').classList.add('hidden');
    document.getElementById('edit-fields-company').classList.remove('hidden');
    document.getElementById('edit-c-nombre').value = user.nombre || '';
    document.getElementById('edit-c-bio').value = user.descripcion || '';
    document.getElementById('edit-c-sector').value = user.sector || '';
    document.getElementById('edit-c-ciudad').value = user.ciudad || '';
    document.getElementById('edit-c-web').value = user.sitio_web || '';
    loadProfilePosts(user.id, 'profile-posts-list');
    return;
  }

  const ratings = await apiFetch('/api/users/' + user.id + '/ratings');
  const initials = ((user.nombre||'?')[0] + (user.apellido||'')[0]).toUpperCase();
  const avatarInner = user.foto ? '<img src="' + esc(user.foto) + '" style="width:100%;height:100%;object-fit:cover">' : initials;
  document.getElementById('my-profile-content').innerHTML =
    '<div class="profile-card">' +
    '<div class="profile-header"><div class="profile-avatar-wrap"><div class="profile-avatar-xl">' + avatarInner + '</div>' +
    '<div class="profile-avatar-edit-btn" onclick="triggerProfilePhotoUpload()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5z"/></svg></div></div>' +
    '<div class="profile-header-info">' +
    '<div class="profile-full-name">' + esc(user.nombre) + ' ' + esc(user.apellido) + '</div>' +
    (user.cargo ? '<span class="profile-cargo-badge">' + esc(user.cargo) + '</span>' : '') +
    '<div class="profile-meta">' + (user.ciudad ? iconPin()+' '+esc(user.ciudad) : '') + (user.iglesia ? ' &middot; '+esc(user.iglesia):'') + '</div></div></div>' +
    '<div class="profile-body">' + (user.bio ? '<div class="profile-bio">' + esc(user.bio) + '</div>' : '<div class="profile-bio" style="color:var(--gray-3)">Sin biografía. ¡Edita tu perfil para añadir una!</div>') +
    '<div class="profile-stats"><div class="stat-item"><div class="stat-value stars">' + renderStars(user.rating_promedio) + '</div><div class="stat-label">Calificación</div></div>' +
    '<div class="stat-item"><div class="stat-value">' + (user.rating_total||0) + '</div><div class="stat-label">Reseñas</div></div></div>' +
    (ratings && ratings.length ? '<h3 class="section-title">Mis reseñas</h3><div class="ratings-list">' +
      ratings.map(r => '<div class="rating-item"><div class="rating-item-header"><span class="rating-item-name">' + esc(r.nombre)+' '+esc(r.apellido) + '</span><span class="rating-item-tipo">' + esc(r.tipo) + '</span><span class="rating-item-stars">' + '★'.repeat(r.puntuacion)+'☆'.repeat(5-r.puntuacion) + '</span></div>' + (r.comentario ? '<div class="rating-item-comment">'+esc(r.comentario)+'</div>':'') + '</div>').join('') + '</div>' : '') +
    '<h3 class="section-title" style="margin-top:1.4rem">Publicaciones</h3><div class="profile-posts-grid" id="profile-posts-list"></div>' +
    '</div></div>';
  document.getElementById('edit-fields-user').classList.remove('hidden');
  document.getElementById('edit-fields-company').classList.add('hidden');
  document.getElementById('edit-nombre').value = user.nombre || '';
  document.getElementById('edit-apellido').value = user.apellido || '';
  document.getElementById('edit-cargo').value = user.cargo || '';
  document.getElementById('edit-bio').value = user.bio || '';
  document.getElementById('edit-ciudad').value = user.ciudad || '';
  document.getElementById('edit-iglesia').value = user.iglesia || '';
  loadProfilePosts(user.id, 'profile-posts-list');
}

function toggleEditProfile() { document.getElementById('edit-profile-form').classList.toggle('hidden'); }

async function saveProfile() {
  let data;
  if (accountType === 'company') {
    data = {
      nombre: document.getElementById('edit-c-nombre').value.trim(),
      descripcion: document.getElementById('edit-c-bio').value.trim(),
      sector: document.getElementById('edit-c-sector').value.trim(),
      ciudad: document.getElementById('edit-c-ciudad').value.trim(),
      sitio_web: document.getElementById('edit-c-web').value.trim(),
    };
  } else {
    data = {
      nombre: document.getElementById('edit-nombre').value.trim(),
      apellido: document.getElementById('edit-apellido').value.trim(),
      cargo: document.getElementById('edit-cargo').value.trim(),
      bio: document.getElementById('edit-bio').value.trim(),
      ciudad: document.getElementById('edit-ciudad').value.trim(),
      iglesia: document.getElementById('edit-iglesia').value.trim(),
    };
  }
  const res = await apiFetch('/api/users/me', 'PUT', data);
  if (res.error) { showToast(res.error, 'error'); return; }
  showToast('&#10003; Perfil actualizado', 'success');
  document.getElementById('edit-profile-form').classList.add('hidden');
  loadMyProfile(); loadSidebarProfile();
}

// ===== MY JOBS =====
async function loadMyJobsAndApps() {
  const jobs = await apiFetch('/api/jobs/mine/list');
  const jEl = document.getElementById('my-jobs-list');
  jEl.innerHTML = (!jobs || !jobs.length) ? '<div class="loading">No has publicado ofertas aún.</div>' :
    jobs.map(j => '<div class="my-job-card"><div class="job-company-avatar" style="width:40px;height:40px;font-size:1rem">' + (j.empresa||'E')[0] + '</div><div class="my-job-card-info"><div class="my-job-title">' + esc(j.titulo) + '</div><div class="my-job-meta">' + esc(j.empresa) + ' · ' + (j.activo ? 'Activa':'Cerrada') + '</div></div><div class="my-job-actions"><span class="applicant-count">' + (j.total_aplicantes||0) + ' aplicantes</span><button class="btn-outline small" onclick="showApplicants(\'' + j.id + '\')">Ver</button>' + (j.activo ? '<button class="btn-danger" style="font-size:.8rem;padding:.3rem .7rem" onclick="closeJob(\'' + j.id + '\')">Cerrar</button>':'') + '</div></div>').join('');

  if (accountType === 'company') {
    document.getElementById('my-applications-title').classList.add('hidden');
    document.getElementById('my-applications-list').classList.add('hidden');
    return;
  }

  const apps = await apiFetch('/api/jobs/mine/applications');
  const aEl = document.getElementById('my-applications-list');
  aEl.innerHTML = (!apps || !apps.length) ? '<div class="loading">No has aplicado a ninguna oferta.</div>' :
    apps.map(a => '<div class="my-job-card"><div class="my-job-card-info"><div class="my-job-title">' + esc(a.titulo) + '</div><div class="my-job-meta">' + esc(a.empresa) + ' · ' + esc(a.empleador_nombre) + ' ' + esc(a.empleador_apellido||'') + '</div></div><span class="applicant-status status-' + a.status + '">' + a.status + '</span></div>').join('');
}

// ===== MESSAGES =====
async function loadConversations() {
  const convos = await apiFetch('/api/messages/conversations');
  const el = document.getElementById('conversations-list');
  if (!convos || !convos.length) { el.innerHTML = '<div class="loading" style="font-size:.85rem;padding:1rem">Sin conversaciones aún</div>'; return; }
  const totalUnread = convos.reduce((s, c) => s + (c.unread_count || 0), 0);
  const badge = document.getElementById('msg-badge');
  if (totalUnread > 0) { badge.textContent = totalUnread; badge.classList.remove('hidden'); } else badge.classList.add('hidden');
  el.innerHTML = convos.map(c =>
    '<div class="convo-item' + (activeChat?.userId === c.other_user_id ? ' active':'') + '" onclick="openChat(\'' + c.other_user_id + '\',\'' + esc(c.nombre+' '+c.apellido) + '\')">' +
    '<div class="avatar-sm">' + (c.nombre||'?')[0] + (c.apellido||'')[0] + '</div>' +
    '<div class="convo-info"><div class="convo-name">' + esc(c.nombre)+' '+esc(c.apellido) + '</div><div class="convo-preview">' + esc((c.contenido||'').slice(0,40)) + '</div></div>' +
    (c.unread_count > 0 ? '<span class="convo-unread">' + c.unread_count + '</span>' : '') + '</div>').join('');
}

async function openChat(userId, name) {
  activeChat = { userId, name };
  if (!document.getElementById('view-messages').classList.contains('active')) showView('messages');
  const messages = await apiFetch('/api/messages/' + userId);
  const panel = document.getElementById('chat-panel');
  panel.innerHTML =
    '<div class="chat-header"><div class="avatar-sm">' + name[0] + (name.split(' ')[1]?.[0]||'') + '</div><div><div class="chat-header-name">' + esc(name) + '</div></div>' +
    '<button class="btn-ghost" style="margin-left:auto" onclick="showUserProfile(\'' + userId + '\')">Ver perfil</button></div>' +
    '<div class="chat-messages" id="chat-messages-area">' +
    (messages && messages.length ? messages.map(m => msgBubble(m)).join('') : '<div style="text-align:center;color:var(--gray-3);padding:2rem;font-size:.88rem">Inicia la conversación</div>') +
    '</div><div class="chat-input-area">' +
    '<input type="text" id="chat-input" placeholder="Escribe un mensaje..." onkeydown="if(event.key===\'Enter\')sendChatMsg(\'' + userId + '\')">' +
    '<button class="chat-send-btn" onclick="sendChatMsg(\'' + userId + '\')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg></button></div>';
  scrollBottom();
  loadConversations();
}

function msgBubble(m) {
  const isMe = m.sender_id === currentUser?.id;
  return '<div class="msg-bubble ' + (isMe?'mine':'theirs') + '"><div class="msg-text">' + esc(m.contenido) + '</div><div class="msg-time">' + formatTime(m.created_at) + '</div></div>';
}

function sendChatMsg(userId) {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: 'message', receiverId: userId, contenido: text }));
  input.value = '';
}

function appendMessage(contenido, isMe, created_at) {
  const area = document.getElementById('chat-messages-area');
  if (!area) return;
  const div = document.createElement('div');
  div.className = 'msg-bubble ' + (isMe ? 'mine' : 'theirs');
  div.innerHTML = '<div class="msg-text">' + esc(contenido) + '</div><div class="msg-time">' + formatTime(created_at) + '</div>';
  area.appendChild(div);
  scrollBottom();
}

function scrollBottom() { setTimeout(() => { const a = document.getElementById('chat-messages-area'); if(a) a.scrollTop=a.scrollHeight; }, 50); }

// ===== SHARE JOB =====
async function showShareJobModal(jobId, jobTitle) {
  const contacts = await apiFetch('/api/users/me/contacts');
  if (!contacts || !contacts.length) { showToast('Agrega contactos primero', 'error'); return; }
  document.getElementById('modal-content').innerHTML =
    '<div class="modal-title">Compartir: ' + esc(jobTitle) + '</div>' +
    '<p style="color:var(--gray-3);font-size:.88rem;margin-bottom:1rem">Selecciona un contacto para enviarle esta oferta</p>' +
    contacts.map(c =>
      '<div class="convo-item" onclick="shareJobTo(\'' + jobId + '\',\'' + c.id + '\',\'' + esc(c.nombre+' '+c.apellido) + '\',\'' + esc(jobTitle) + '\')" style="border-radius:10px;margin-bottom:.4rem">' +
      '<div class="avatar-sm">' + (c.nombre||'?')[0]+(c.apellido||'')[0] + '</div>' +
      '<div class="convo-info"><div class="convo-name">' + esc(c.nombre)+' '+esc(c.apellido) + '</div><div class="convo-preview">' + esc(c.cargo||c.ciudad||'') + '</div></div></div>').join('');
  openModal();
}

async function shareJobTo(jobId, contactId, name, title) {
  closeModal();
  const msgText = 'Te comparto esta oferta: "' + title + '" — Búscala en FaithWork (ID: ' + jobId + ')';
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'message', receiverId: contactId, contenido: msgText }));
  else await apiFetch('/api/messages/' + contactId, 'POST', { contenido: msgText });
  showToast('&#10003; Oferta compartida con ' + name, 'success');
}

// ===== RATING =====
function showRateModal(userId, jobId, tipo) {
  window._selectedStars = 0;
  document.getElementById('modal-content').innerHTML =
    '<div class="modal-title">Calificar ' + (tipo==='empleado'?'al empleado':'al empleador') + '</div>' +
    '<div class="form-group"><label>Puntuación</label><div class="star-selector">' +
    [1,2,3,4,5].map(n => '<button class="star-btn" onclick="selectStar(' + n + ')">&#9733;</button>').join('') + '</div></div>' +
    '<div class="form-group"><label>Comentario (opcional)</label><textarea id="rate-comment" rows="3"></textarea></div>' +
    '<div style="display:flex;gap:.75rem">' +
    '<button class="btn-primary" onclick="submitRate(\'' + userId + '\',\'' + jobId + '\',\'' + tipo + '\')">Enviar</button>' +
    '<button class="btn-outline" onclick="closeModal()">Cancelar</button></div>';
  openModal();
}

function selectStar(n) {
  window._selectedStars = n;
  document.querySelectorAll('.star-btn').forEach((b, i) => b.classList.toggle('active', i < n));
}

async function submitRate(userId, jobId, tipo) {
  const puntuacion = window._selectedStars || 0;
  if (!puntuacion) { showToast('Selecciona una puntuación', 'error'); return; }
  const comentario = document.getElementById('rate-comment').value.trim();
  const res = await apiFetch('/api/users/' + userId + '/rate', 'POST', { puntuacion, comentario, tipo, job_id: jobId });
  if (res.error) { showToast(res.error, 'error'); return; }
  closeModal(); showToast('&#10003; Calificación enviada', 'success');
}

// ===== MODAL =====
function openModal() { document.getElementById('modal-overlay').classList.remove('hidden'); }
function closeModal() { document.getElementById('modal-overlay').classList.add('hidden'); }

// ===== TOAST =====
let toastTimer;
function showToast(msg, type='') {
  const el = document.getElementById('toast');
  el.innerHTML = msg; el.className = 'toast ' + type; el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
}

// ===== HELPERS =====
function showError(el, msg) { el.innerHTML = msg; el.classList.remove('hidden'); }

async function apiFetch(url, method='GET', body=null, useAuth=true) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (useAuth && token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (body) opts.body = JSON.stringify(body);
  try { const r = await fetch(url, opts); return await r.json(); }
  catch(e) { console.error(e); return { error: 'Error de conexión' }; }
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function timeAgo(d) {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff/60000);
  if (m < 1) return 'Ahora';
  if (m < 60) return m + 'm';
  const h = Math.floor(m/60);
  if (h < 24) return h + 'h';
  const days = Math.floor(h/24);
  if (days < 30) return days + 'd';
  return new Date(d).toLocaleDateString('es');
}

function formatTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('es', { hour:'2-digit', minute:'2-digit' });
}

function renderStars(r) {
  if (!r) return '';
  const n = Math.round(parseFloat(r));
  return '★'.repeat(n) + '☆'.repeat(5-n);
}

// ===================================================================
// ===== POSTS / FEED SOCIAL (texto + fotos + videos) =====
// ===================================================================
let pendingPostFiles = []; // [{file, previewUrl, tipo}]

function avatarHTML(person, size) {
  size = size || 38;
  const initials = person.author_apellido
    ? ((person.author_nombre||'?')[0] + (person.author_apellido||'')[0]).toUpperCase()
    : (person.author_nombre||'?')[0].toUpperCase();
  if (person.author_foto) {
    return '<div class="avatar-sm" style="width:' + size + 'px;height:' + size + 'px"><img src="' + esc(person.author_foto) + '" style="width:100%;height:100%;object-fit:cover"></div>';
  }
  return '<div class="avatar-sm" style="width:' + size + 'px;height:' + size + 'px">' + initials + '</div>';
}

async function loadSocialFeed() {
  const posts = await apiFetch('/api/posts');
  renderSocialFeed('social-feed', posts);
  // Pintar avatar del composer
  if (currentUser) {
    const initials = accountType === 'company' ? (currentUser.nombre||'?')[0].toUpperCase() : ((currentUser.nombre||'?')[0]+(currentUser.apellido||'')[0]).toUpperCase();
    const av = document.getElementById('composer-avatar-social');
    if (av) {
      if (currentUser.foto || currentUser.logo) av.innerHTML = '<img src="' + esc(currentUser.foto||currentUser.logo) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
      else av.textContent = initials;
    }
  }
}

function renderSocialFeed(containerId, posts) {
  const el = document.getElementById(containerId);
  if (!posts || !posts.length) { el.innerHTML = '<div class="loading">Aún no hay publicaciones. ¡Sé el primero en compartir algo!</div>'; return; }
  el.innerHTML = posts.map(p => postCardHTML(p)).join('');
}

function postCardHTML(p) {
  const isMine = p.author_id === currentUser?.id;
  let mediaHtml = '';
  if (p.media && p.media.length) {
    const count = Math.min(p.media.length, 4);
    mediaHtml = '<div class="post-media-grid count-' + count + '">' +
      p.media.slice(0, 4).map(m => m.tipo === 'video'
        ? '<video src="' + esc(m.url) + '" controls></video>'
        : '<img src="' + esc(m.url) + '" onclick="openMediaLightbox(\'' + esc(m.url) + '\')">'
      ).join('') + '</div>';
  }
  return '<div class="post-card" data-post-id="' + p.id + '">' +
    '<div class="post-card-header">' +
    avatarHTML(p) +
    '<div><div class="post-author-name" onclick="' + (p.author_type==='company' ? "showCompanyProfile('"+p.author_id+"')" : "showUserProfile('"+p.author_id+"')") + '">' + esc(p.author_nombre) + ' ' + esc(p.author_apellido||'') + '</div>' +
    '<div class="post-time">' + timeAgo(p.created_at) + '</div></div>' +
    (isMine ? '<button class="btn-ghost" style="margin-left:auto;font-size:.78rem" onclick="deletePost(\'' + p.id + '\')">Eliminar</button>' : '') +
    '</div>' +
    (p.contenido ? '<div class="post-text">' + esc(p.contenido) + '</div>' : '') +
    mediaHtml +
    '<div class="post-actions-bar">' +
    '<div class="post-action-btn ' + (p.liked_by_me ? 'liked' : '') + '" onclick="toggleLike(\'' + p.id + '\', this)">' +
    '<svg width="17" height="17" viewBox="0 0 24 24" fill="' + (p.liked_by_me ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.8"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 10-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z"/></svg>' +
    '<span class="like-count">' + (p.total_likes || 0) + '</span></div>' +
    '<div class="post-action-btn" onclick="toggleComments(\'' + p.id + '\')">' +
    '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>' +
    '<span>' + (p.total_comments || 0) + ' comentarios</span></div>' +
    '</div>' +
    '<div class="post-comments-section hidden" id="comments-' + p.id + '"></div>' +
    '</div>';
}

function handlePostFileSelect(event) {
  const files = Array.from(event.target.files || []);
  files.forEach(file => {
    if (pendingPostFiles.length >= 6) { showToast('Máximo 6 archivos por publicación', 'error'); return; }
    const tipo = file.type.startsWith('video/') ? 'video' : 'image';
    const previewUrl = URL.createObjectURL(file);
    pendingPostFiles.push({ file, previewUrl, tipo });
  });
  renderPostMediaPreview();
  event.target.value = '';
}

function renderPostMediaPreview() {
  const wrap = document.getElementById('post-media-preview');
  if (!pendingPostFiles.length) { wrap.classList.add('hidden'); wrap.innerHTML = ''; return; }
  wrap.classList.remove('hidden');
  wrap.innerHTML = pendingPostFiles.map((f, i) =>
    '<div class="post-media-preview-item">' +
    (f.tipo === 'video' ? '<video src="' + f.previewUrl + '"></video>' : '<img src="' + f.previewUrl + '">') +
    '<div class="post-media-preview-remove" onclick="removePendingFile(' + i + ')">&times;</div></div>'
  ).join('');
}

function removePendingFile(index) {
  pendingPostFiles.splice(index, 1);
  renderPostMediaPreview();
}

async function publishPost() {
  const textEl = document.getElementById('post-text');
  const text = textEl.value.trim();
  const btn = document.getElementById('post-submit-btn');

  if (!text && !pendingPostFiles.length) { showToast('Escribe algo o agrega una foto/video', 'error'); return; }

  btn.disabled = true;
  btn.textContent = 'Publicando...';

  try {
    let media = [];
    if (pendingPostFiles.length) {
      const formData = new FormData();
      pendingPostFiles.forEach(f => formData.append('files', f.file));
      const uploadRes = await fetch('/api/uploads/post-media', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
        body: formData
      });
      const uploadData = await uploadRes.json();
      if (uploadData.error) { showToast(uploadData.error, 'error'); btn.disabled = false; btn.textContent = 'Publicar'; return; }
      media = uploadData.files;
    }

    const res = await apiFetch('/api/posts', 'POST', { contenido: text, media });
    if (res.error) { showToast(res.error, 'error'); btn.disabled = false; btn.textContent = 'Publicar'; return; }

    textEl.value = '';
    pendingPostFiles = [];
    renderPostMediaPreview();
    showToast('Publicación creada', 'success');
    loadSocialFeed();
  } catch (e) {
    showToast('Error al publicar', 'error');
  }
  btn.disabled = false;
  btn.textContent = 'Publicar';
}

async function deletePost(postId) {
  if (!confirm('¿Eliminar esta publicación?')) return;
  await apiFetch('/api/posts/' + postId, 'DELETE');
  showToast('Publicación eliminada');
  loadSocialFeed();
}

async function toggleLike(postId, el) {
  const res = await apiFetch('/api/posts/' + postId + '/like', 'POST');
  if (res.error) return;
  el.classList.toggle('liked', res.liked);
  const countEl = el.querySelector('.like-count');
  const svg = el.querySelector('svg');
  let count = parseInt(countEl.textContent) || 0;
  count = res.liked ? count + 1 : Math.max(0, count - 1);
  countEl.textContent = count;
  svg.setAttribute('fill', res.liked ? 'currentColor' : 'none');
}

async function toggleComments(postId) {
  const section = document.getElementById('comments-' + postId);
  if (!section.classList.contains('hidden')) { section.classList.add('hidden'); return; }
  section.classList.remove('hidden');
  section.innerHTML = '<div class="loading" style="padding:.5rem">Cargando comentarios...</div>';
  const comments = await apiFetch('/api/posts/' + postId + '/comments');
  section.innerHTML =
    (comments && comments.length ? comments.map(c =>
      '<div class="post-comment-item">' + avatarHTML(c, 30) +
      '<div class="post-comment-bubble"><span class="post-comment-author">' + esc(c.author_nombre) + ' ' + esc(c.author_apellido||'') + '</span>' + esc(c.contenido) + '</div></div>'
    ).join('') : '') +
    '<div class="post-comment-input-row">' +
    '<input type="text" id="comment-input-' + postId + '" placeholder="Escribe un comentario..." onkeydown="if(event.key===\'Enter\')submitComment(\'' + postId + '\')">' +
    '<button class="btn-ghost" onclick="submitComment(\'' + postId + '\')">Enviar</button></div>';
}

async function submitComment(postId) {
  const input = document.getElementById('comment-input-' + postId);
  const text = input.value.trim();
  if (!text) return;
  const res = await apiFetch('/api/posts/' + postId + '/comments', 'POST', { contenido: text });
  if (res.error) { showToast(res.error, 'error'); return; }
  input.value = '';
  toggleComments(postId); // cierra
  toggleComments(postId); // reabre recargado
}

function openMediaLightbox(url) {
  document.getElementById('modal-content').innerHTML = '<img src="' + esc(url) + '" style="width:100%;border-radius:8px">';
  openModal();
}

// ===================================================================
// ===== FOTO DE PERFIL =====
// ===================================================================
function triggerProfilePhotoUpload() {
  document.getElementById('profile-photo-input').click();
}

async function handleProfilePhotoSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Selecciona una imagen válida', 'error'); return; }

  const formData = new FormData();
  formData.append('photo', file);

  showToast('Subiendo foto...');
  try {
    const res = await fetch('/api/uploads/profile-photo', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: formData
    });
    const data = await res.json();
    if (data.error) { showToast(data.error, 'error'); return; }
    showToast('Foto de perfil actualizada', 'success');
    loadMyProfile();
    loadSidebarProfile();
  } catch (e) {
    showToast('Error al subir la foto', 'error');
  }
  event.target.value = '';
}

// ===================================================================
// ===== PUBLICACIONES DENTRO DEL PERFIL =====
// ===================================================================
async function loadProfilePosts(authorId, containerId) {
  const posts = await apiFetch('/api/posts/by/' + authorId);
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!posts || !posts.length) {
    el.innerHTML = '<div class="loading">Sin publicaciones aún</div>';
    return;
  }
  el.innerHTML = posts.map(p => postCardHTML(p)).join('');
}
