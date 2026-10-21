/* =========================================================
   ECHO — shared script (index.html + admin.html)
   - info.json  = একমাত্র সোর্স (লগইন সবসময় এখান থেকে যাচাই হয়)
   - localStorage = শুধু সাবমিশন + অ্যাডমিন ড্রাফট
   ========================================================= */
const LOCAL_KEY = 'echo_local_v5';        // সাবমিশন ওভারলে
const DRAFT_KEY = 'echo_admin_draft_v5';  // অ্যাডমিন ড্রাফট
const IS_ADMIN_PAGE = document.body.dataset.page === 'admin';

let base = null;        // info.json থেকে আসা ফ্রেশ ডেটা
let state = {};         // বর্তমান কাজের ডেটা
let currentUser = null;
let loadError = '';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));

/* ---------- ডেটা লোড ---------- */
async function fetchBase() {
  const res = await fetch('info.json?ts=' + Date.now(), { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

function readLocal() {
  try { const l = JSON.parse(localStorage.getItem(LOCAL_KEY)); return l && l.subs ? l : { subs: {} }; }
  catch { return { subs: {} }; }
}

function buildState() {
  let s = clone(base);
  if (IS_ADMIN_PAGE) {
    try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY)); if (d) s = d; } catch { /* ignore */ }
  }
  ['notices', 'classes', 'resources', 'tools', 'members', 'tasks'].forEach(k => { s[k] = s[k] || []; });
  s.settings = s.settings || {};
  s.about = s.about || {};
  const local = readLocal();
  s.tasks.forEach(t => {
    t.submissions = t.submissions || [];
    (local.subs[t.id] || []).forEach(ls => {
      const i = t.submissions.findIndex(x => x.id === ls.id);
      if (i >= 0) t.submissions[i] = ls; else t.submissions.push(ls);
    });
  });
  return s;
}

function persist() {
  const l = readLocal();
  (state.tasks || []).forEach(t => { l.subs[t.id] = t.submissions || []; });
  localStorage.setItem(LOCAL_KEY, JSON.stringify(l));
  if (IS_ADMIN_PAGE) localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
}

/* ---------- লগইন (সবসময় ফ্রেশ info.json থেকে) ---------- */
function attemptLogin(email, pass) {
  const s = base.settings || {};
  const aEmail = String(s.adminEmail || 'admin@echo.local').trim().toLowerCase();
  const aPass = String(s.adminPassword || 'ECHO-Admin-ChangeMe-26');
  if (email === aEmail && pass === aPass) {
    return { id: '__admin__', name: 'ECHO Administrator', role: 'Admin', email };
  }
  const m = (base.members || []).find(x =>
    String(x.email || '').trim().toLowerCase() === email &&
    String(x.password || x.username || '').trim() === pass
  );
  return m ? { id: m.id, name: m.name, role: m.role || 'Member', email: m.email } : null;
}

function showApp() {
  currentUser = JSON.parse(sessionStorage.getItem('echo_user') || 'null');
  const ok = currentUser && (!IS_ADMIN_PAGE || currentUser.role === 'Admin');
  $('loginScreen').classList.toggle('hidden', !!ok);
  $('appContainer').classList.toggle('hidden', !ok);
  if (ok) {
    state = buildState();
    setupSidebar();
  }
  return !!ok;
}

function setupSidebar() {
  $('sessionLabel').innerHTML = `SIGNED IN<br><strong>${esc(currentUser.name)}</strong><br><small style="color:var(--green)">${esc(currentUser.role)}</small>`;
  const adminLink = $('adminNav');
  if (adminLink) adminLink.classList.toggle('hidden', currentUser.role !== 'Admin');
}

function applyTheme() {
  document.documentElement.dataset.theme = localStorage.getItem('echo_theme') || 'dark';
}

function runMatrixRain() {
  const c = $('rain');
  if (!c) return;
  const ctx = c.getContext('2d');
  let cols = [], size = 14, w = 0, h = 0;
  function resize() {
    w = window.innerWidth; h = window.innerHeight;
    c.width = w; c.height = h;
    cols = Array(Math.ceil(w / size)).fill(0).map(() => Math.random() * -60);
  }
  function draw() {
    ctx.fillStyle = 'rgba(3,5,7,0.15)';
    ctx.fillRect(0, 0, w, h);
    ctx.font = size + 'px monospace';
    for (let i = 0; i < cols.length; i++) {
      ctx.fillStyle = Math.random() > 0.92 ? '#5ce7ff' : '#67ffb5';
      ctx.fillText(Math.random() > 0.5 ? '0' : '1', i * size, cols[i] * size);
      if (cols[i] * size > h && Math.random() > 0.975) cols[i] = 0;
      cols[i] += 0.85 + Math.random() * 0.4;
    }
    requestAnimationFrame(draw);
  }
  window.addEventListener('resize', resize);
  resize(); draw();
}

function bindCommon() {
  $('themeBtn')?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('echo_theme', next);
  });
  $('logoutBtn')?.addEventListener('click', () => {
    sessionStorage.removeItem('echo_user');
    currentUser = null;
    showApp();
  });
  $('loginForm').addEventListener('submit', e => {
    e.preventDefault();
    const err = $('loginError');
    if (!base) { err.textContent = loadError || 'info.json লোড হয়নি।'; return; }
    const em = $('loginEmail').value.trim().toLowerCase();
    const pass = $('loginPassword').value.trim();
    const user = attemptLogin(em, pass);
    if (!user) { err.textContent = 'ইমেইল বা পাসওয়ার্ড ভুল। info.json এর সাথে মিলিয়ে দেখুন।'; return; }
    if (IS_ADMIN_PAGE && user.role !== 'Admin') { err.textContent = 'এই পেজ শুধু অ্যাডমিনদের জন্য।'; return; }
    err.textContent = '';
    sessionStorage.setItem('echo_user', JSON.stringify(user));
    if (showApp()) onLoggedIn();
  });
}

/* =========================================================
   INDEX PAGE
   ========================================================= */
const mySub = t => (t.submissions || []).find(s => s.memberId === currentUser.id || (currentUser.email && s.memberEmail === currentUser.email));
const sortedMembers = () => [...(state.members || [])].sort((a, b) => (Number(b.points) || 0) - (Number(a.points) || 0));

function navigateTo(pageId) {
  document.querySelectorAll('.spa-page').forEach(s => s.classList.add('hidden'));
  const page = $('page-' + pageId) || $('page-dashboard');
  page.classList.remove('hidden');
  document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.page === pageId));
  history.replaceState(null, '', '#' + pageId);
  const fn = { dashboard: renderDashboard, tasks: renderTasks, classes: renderClasses, resources: renderResources, tools: renderTools, members: renderMembers, about: renderAbout }[pageId];
  if (fn) fn();
}

function renderDashboard() {
  $('organizedClassesCount').textContent = state.classes.length;
  $('postsResourcesCount').textContent = state.resources.length;
  $('publishedTasksCount').textContent = state.tasks.length;
  $('activeToolsCount').textContent = state.tools.length;
  $('memberCount').textContent = state.members.length;
  $('noticeGrid').innerHTML = state.notices.map(n => `<div class="notice-item"><strong>${esc(n.title)}</strong><p>${esc(n.body)}</p></div>`).join('') || '<p>No announcements.</p>';
  $('topRankRows').innerHTML = sortedMembers().slice(0, 10).map((m, i) => `
    <tr><td>${i + 1}</td><td><strong>${esc(m.name)}</strong></td><td class="special">${esc(m.specialty || '—')}</td><td>${esc(m.country || '—')}</td><td class="points">${Number(m.points) || 0}</td></tr>`).join('') || '<tr><td colspan="5">No members found.</td></tr>';
  const aws = $('awsClassBtn');
  if (aws && state.settings.awsClassUrl) aws.href = state.settings.awsClassUrl;
}

function renderTasks() {
  $('allRankRows').innerHTML = sortedMembers().map((m, i) => `
    <tr><td>${i + 1}</td><td><strong>${esc(m.name)}</strong></td><td>${esc(m.specialty || '—')}</td><td>${esc(m.country || '—')}</td><td class="points">${Number(m.points) || 0}</td><td>${esc(m.role || 'Member')}</td></tr>`).join('') || '<tr><td colspan="6">No members.</td></tr>';

  $('taskList').innerHTML = state.tasks.map(t => {
    const taken = !!mySub(t);
    return `<div class="task-card">
      <div style="display:flex;justify-content:space-between;align-items:center"><strong>${esc(t.title)}</strong><span class="pill good">+${Number(t.points) || 0} PTS</span></div>
      <div><span class="pill">${esc(t.category)}</span></div>
      <p style="font-size:12px;color:var(--muted);margin:6px 0">${esc(t.description)}</p>
      ${(t.steps || []).length ? `<ul style="font-size:11px;color:var(--muted);padding-left:18px;margin:4px 0">${t.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
      <button class="btn ${taken ? 'neutral' : ''}" style="margin-top:auto" ${taken ? 'disabled' : ''} onclick="takeTask('${esc(t.id)}')">${taken ? 'TAKEN ALREADY' : 'TAKE THIS TASK'}</button>
    </div>`;
  }).join('') || '<p style="color:var(--muted)">No tasks available.</p>';

  const mine = [];
  state.tasks.forEach(t => { const s = mySub(t); if (s) mine.push({ t, s }); });
  $('myTasks').innerHTML = mine.map(({ t, s }) => `
    <div class="task-card" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center"><strong>${esc(t.title)}</strong>
        <span class="pill ${s.status === 'approved' ? 'good' : s.status === 'rejected' ? 'bad' : 'warn'}">${esc(s.status.toUpperCase())}</span></div>
      <p style="font-size:12px;color:var(--muted);margin:6px 0">${esc(t.description)}</p>
      ${s.status === 'in_progress' ? `
        <div class="field"><label>Write Report / Evidence Notes:</label><textarea id="rep-${esc(t.id)}" placeholder="Provide links or write proof of completion..."></textarea></div>
        <button class="btn" onclick="submitReport('${esc(t.id)}')">SUBMIT REPORT</button>`
      : `<div class="report-box"><strong>Your Submitted Report:</strong><br>${esc(s.report || 'No text submitted.')}</div>`}
    </div>`).join('') || '<p style="color:var(--muted)">No active tasks accepted yet.</p>';
}

const linkCard = (glyph, x) => `<div class="resource-card"><div class="glyph">${glyph}</div><h3>${esc(x.title)}</h3>
  <p style="font-size:12px;color:var(--muted)">${esc(x.description)}</p>
  ${x.url ? `<a class="btn" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer" style="margin-top:auto">OPEN ↗</a>` : ''}</div>`;

function renderClasses() { $('classGrid').innerHTML = state.classes.map(c => linkCard('▥', c)).join('') || '<p style="color:var(--muted)">No classes listed yet.</p>'; }
function renderResources() { $('resourceGrid').innerHTML = state.resources.map(r => linkCard('▧', r)).join('') || '<p style="color:var(--muted)">No resources found.</p>'; }
function renderTools() { $('toolGrid').innerHTML = state.tools.map(t => linkCard('⌘', t)).join('') || '<p style="color:var(--muted)">No tools added yet.</p>'; }

function renderMembers() {
  $('memberList').innerHTML = state.members.map(m => `
    <div class="member-card"><div class="avatar">${esc((m.name || 'E').slice(0, 2).toUpperCase())}</div>
    <h3 style="margin:0">${esc(m.name)}</h3>
    <p style="font-size:12px;color:var(--muted);margin:4px 0">${esc(m.specialty || 'General')} · ${esc(m.country || 'Bangladesh')}</p>
    <strong style="color:var(--green);font-size:13px">${Number(m.points) || 0} Points</strong></div>`).join('') || '<p>No members found.</p>';
}

function renderAbout() {
  $('aboutTitleText').textContent = state.about.title || 'ECHO';
  $('aboutDescText').textContent = state.about.description || '';
}

window.takeTask = id => {
  const t = state.tasks.find(x => x.id === id);
  if (!t || mySub(t)) return;
  (t.submissions = t.submissions || []).push({
    id: 'sub-' + Date.now(), memberId: currentUser.id, memberName: currentUser.name,
    memberEmail: currentUser.email, report: '', status: 'in_progress', submittedAt: null
  });
  persist(); renderTasks();
};

window.submitReport = id => {
  const rep = $('rep-' + id)?.value.trim();
  if (!rep) return alert('Please enter report evidence.');
  const t = state.tasks.find(x => x.id === id);
  const s = t && mySub(t);
  if (!s) return;
  s.report = rep; s.status = 'pending'; s.submittedAt = new Date().toISOString();
  persist(); renderTasks();
  alert('Report submitted to admin for review!');
};

function setupMeeting() {
  const btn = $('meetingBtn'), cd = $('meetingCountdown');
  if (!btn || !cd) return;
  const modal = $('meetingModal');
  function update() {
    const d = new Date();
    const nowMin = ((d.getUTCHours() + 6) % 24) * 60 + d.getUTCMinutes();
    const open = nowMin >= 1200 && nowMin < 1440;
    btn.disabled = !open;
    cd.textContent = open ? 'MEETING IS OPEN NOW!' : 'OPENS AT 20:00 ASIA/DHAKA';
  }
  setInterval(update, 1000); update();
  btn.onclick = () => modal.classList.add('open');
  $('closeModalBtn').onclick = () => modal.classList.remove('open');
  $('verifyMeeting').onclick = () => {
    if ($('meetingCode').value === (state.settings.meetingPasscode || 'CHANGE-ME-DEMO')) {
      window.open(state.settings.meetingUrl || 'https://meet.google.com/', '_blank', 'noopener');
      modal.classList.remove('open');
    } else alert('Invalid Passcode');
  };
}

function initIndex() {
  document.querySelectorAll('.nav-link').forEach(l => {
    if (!l.dataset.page) return;
    l.addEventListener('click', e => { e.preventDefault(); navigateTo(l.dataset.page); });
  });
  setupMeeting();
}

/* =========================================================
   ADMIN PAGE
   ========================================================= */
function saveAndRender() { persist(); renderAdmin(); }

function renderAdmin() {
  const queue = [];
  state.tasks.forEach(t => (t.submissions || []).forEach(s => { if (s.status === 'pending') queue.push({ t, s }); }));
  const nameOf = s => (state.members.find(x => x.id === s.memberId || (s.memberEmail && String(x.email).toLowerCase() === String(s.memberEmail).toLowerCase())) || {}).name || s.memberName || 'Member';

  $('adminReviewQueue').innerHTML = queue.map(({ t, s }) => `
    <div class="queue-item">
      <div style="display:flex;justify-content:space-between"><strong>${esc(t.title)}</strong><span class="pill good">+${Number(t.points) || 0} PTS</span></div>
      <p style="font-size:11px;color:var(--muted);margin:4px 0">Submitted by: <b>${esc(nameOf(s))}</b> | ${s.submittedAt ? esc(new Date(s.submittedAt).toLocaleString()) : 'N/A'}</p>
      <div class="report-box">${esc(s.report || 'No notes')}</div>
      <div style="display:flex;gap:6px">
        <button class="btn" onclick="approveTask('${esc(t.id)}','${esc(s.id)}')">APPROVE (+${Number(t.points) || 0} PTS)</button>
        <button class="btn danger" onclick="rejectTask('${esc(t.id)}','${esc(s.id)}')">REJECT</button>
      </div></div>`).join('') || '<p style="color:var(--muted);font-size:12px">বর্তমানে কোনো পেন্ডিং রিপোর্ট নেই।</p>';

  const row = (title, sub, btn) => `<div class="admin-row"><div><strong>${esc(title)}</strong><small style="color:var(--muted);display:block">${esc(sub)}</small></div>${btn}</div>`;
  const rm = (fn, id) => `<button class="btn danger" onclick="${fn}('${esc(id)}')">REMOVE</button>`;

  $('adminNoticeList').innerHTML = state.notices.map(n => row(n.title, n.body, rm('removeItem', 'notices|' + n.id))).join('') || '<p>No notices.</p>';
  $('adminClassList').innerHTML = state.classes.map(c => row(c.title, c.description, rm('removeItem', 'classes|' + c.id))).join('') || '<p>No classes.</p>';
  $('adminResourceList').innerHTML = state.resources.map(r => row(r.title, r.description, rm('removeItem', 'resources|' + r.id))).join('') || '<p>No resources.</p>';
  $('adminToolList').innerHTML = state.tools.map(t => row(t.title, t.description, rm('removeItem', 'tools|' + t.id))).join('') || '<p>No tools.</p>';
  $('adminTaskList').innerHTML = state.tasks.map(t => row(`${t.title} (${t.points} pts)`, `${t.category} | ${t.description}`, rm('removeItem', 'tasks|' + t.id))).join('') || '<p>No tasks.</p>';

  $('adminMemberList').innerHTML = state.members.map(m => `
    <div class="admin-row">
      <div><strong>${esc(m.name)}</strong> [${esc(m.role || 'Member')}]<br>
        <span style="font-size:12px;color:var(--muted)">ID: ${esc(m.email)} · Password: ${esc(m.password || m.username)}</span><br>
        <span style="font-size:12px;color:var(--muted)">${esc(m.specialty)} · ${esc(m.country)}</span> — <b style="color:var(--green)">${Number(m.points) || 0} pts</b></div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">
        <button class="btn" onclick="updatePoints('${esc(m.id)}',10)">+10</button>
        <button class="btn neutral" onclick="updatePoints('${esc(m.id)}',-10)">-10</button>
        <button class="btn secondary" onclick="editLogin('${esc(m.id)}')">EDIT LOGIN</button>
        <button class="btn danger" onclick="removeItem('members|${esc(m.id)}')">REMOVE</button>
      </div></div>`).join('') || '<p>No members.</p>';

  const s = state.settings;
  $('setMeetUrl').value = s.meetingUrl || '';
  $('setMeetPass').value = s.meetingPasscode || '';
  $('setAwsUrl').value = s.awsClassUrl || '';
  $('setAdminEmail').value = s.adminEmail || '';
  $('setAdminPass').value = s.adminPassword || '';
  $('aboutTitle').value = state.about.title || '';
  $('aboutDesc').value = state.about.description || '';
}

window.approveTask = (tid, sid) => {
  const t = state.tasks.find(x => x.id === tid);
  const s = (t?.submissions || []).find(x => x.id === sid);
  if (!t || !s) return;
  s.status = 'approved';
  const m = state.members.find(x => x.id === s.memberId || (s.memberEmail && String(x.email).toLowerCase() === String(s.memberEmail).toLowerCase()));
  if (m) m.points = (Number(m.points) || 0) + (Number(t.points) || 0);
  saveAndRender();
};
window.rejectTask = (tid, sid) => {
  const s = (state.tasks.find(x => x.id === tid)?.submissions || []).find(x => x.id === sid);
  if (s) { s.status = 'rejected'; saveAndRender(); }
};
window.removeItem = key => {
  const [list, id] = key.split('|');
  if (!confirm('Remove this item?')) return;
  state[list] = state[list].filter(x => x.id !== id);
  saveAndRender();
};
window.updatePoints = (id, d) => {
  const m = state.members.find(x => x.id === id);
  if (m) { m.points = Math.max(0, (Number(m.points) || 0) + d); saveAndRender(); }
};
window.editLogin = id => {
  const m = state.members.find(x => x.id === id);
  if (!m) return;
  const email = prompt('নতুন Email (Login ID):', m.email);
  if (email === null) return;
  const pass = prompt('নতুন Password (Username):', m.password || m.username);
  if (pass === null) return;
  m.email = email.trim().toLowerCase();
  m.username = pass.trim();
  delete m.password;
  saveAndRender();
};

function exportCleanJson() {
  const data = {
    settings: state.settings, notices: state.notices, classes: state.classes, resources: state.resources,
    tools: state.tools, members: state.members, tasks: state.tasks, about: state.about
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'info.json';
  document.body.appendChild(a); a.click(); a.remove();
}

function initAdmin() {
  const on = (id, fn) => $(id)?.addEventListener('submit', e => { e.preventDefault(); fn(e); e.target.reset?.(); saveAndRender(); });
  const val = id => $(id).value.trim();

  on('noticeForm', () => state.notices.unshift({ id: 'n-' + Date.now(), title: val('noticeTitle'), body: val('noticeBody') }));
  on('classForm', () => state.classes.unshift({ id: 'c-' + Date.now(), title: val('classTitle'), description: val('classDesc'), url: val('classUrl') }));
  on('resourceForm', () => state.resources.unshift({ id: 'r-' + Date.now(), title: val('resTitle'), description: val('resDesc'), url: val('resUrl') }));
  on('toolForm', () => state.tools.unshift({ id: 'tl-' + Date.now(), title: val('toolTitle'), description: val('toolDesc'), url: val('toolUrl') }));
  on('adminTaskForm', () => state.tasks.unshift({
    id: 't-' + Date.now(), title: val('admTaskTitle'), category: $('admTaskCat').value,
    points: Number($('admTaskPts').value) || 0, description: val('admTaskDesc'),
    steps: $('admTaskSteps').value.split('\n').map(s => s.trim()).filter(Boolean), submissions: []
  }));

  $('addMemberForm').addEventListener('submit', e => {
    e.preventDefault();
    const email = val('memEmail').toLowerCase(), username = val('memUser');
    if (state.members.some(m => String(m.email).toLowerCase() === email || String(m.username).toLowerCase() === username.toLowerCase())) {
      return alert('Email or Username already exists!');
    }
    state.members.push({
      id: 'm-' + Date.now(), name: val('memName'), username, email, specialty: val('memSpec'),
      country: val('memCountry') || 'Bangladesh', points: 0, role: $('memRole').value
    });
    e.target.reset(); saveAndRender();
  });

  $('settingsForm').addEventListener('submit', e => {
    e.preventDefault();
    state.settings = {
      ...state.settings, meetingUrl: val('setMeetUrl'), meetingPasscode: val('setMeetPass'), awsClassUrl: val('setAwsUrl'),
      adminEmail: val('setAdminEmail').toLowerCase(), adminPassword: val('setAdminPass')
    };
    saveAndRender(); alert('Settings saved! এখন info.json ডাউনলোড করে আপলোড করুন।');
  });

  $('aboutForm').addEventListener('submit', e => {
    e.preventDefault();
    state.about = { title: val('aboutTitle'), description: val('aboutDesc') };
    saveAndRender(); alert('About info updated!');
  });

  $('topExportBtn').addEventListener('click', exportCleanJson);
  $('bottomExportBtn').addEventListener('click', exportCleanJson);
  $('resetDraftBtn').addEventListener('click', () => {
    if (!confirm('সব ড্রাফট ও লোকাল সাবমিশন মুছে info.json থেকে নতুন করে শুরু হবে। নিশ্চিত?')) return;
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(LOCAL_KEY);
    state = buildState(); renderAdmin();
  });
}

/* =========================================================
   BOOT
   ========================================================= */
function onLoggedIn() {
  if (IS_ADMIN_PAGE) renderAdmin();
  else navigateTo(location.hash.replace('#', '') || 'dashboard');
}

document.addEventListener('DOMContentLoaded', async () => {
  applyTheme();
  runMatrixRain();
  try {
    base = await fetchBase();
  } catch (e) {
    console.error('info.json load failed', e);
    const isFile = location.protocol === 'file:';
    loadError = isFile
      ? 'info.json লোড হয়নি কারণ আপনি ফাইলটি সরাসরি (file://) খুলেছেন। ব্রাউজার এতে JSON পড়তে দেয় না। VS Code এর "Live Server" দিয়ে খুলুন, অথবা GitHub Pages-এ আপলোড করে খুলুন।'
      : 'info.json লোড হয়নি (' + e.message + '). ফাইলের নাম ঠিক "info.json" (ছোট হাতের) কিনা এবং index.html / admin.html এর একই ফোল্ডারে আছে কিনা দেখুন। JSON-এ কমা বা কোটেশনের ভুল থাকলেও এই সমস্যা হয়।';
    $('loginError').textContent = loadError;
  }
  bindCommon();
  if (IS_ADMIN_PAGE) initAdmin(); else initIndex();
  if (base && showApp()) onLoggedIn();
});
