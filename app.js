/* =========================================================
   QuietFox: interactive demo (app.js)

   This is a front-end-only preview. Everything runs in the browser on
   sample data: there is no server, no account system, no real matching,
   no voice audio, and no encryption in this build. The production app's
   back end, calling, encryption, and safety systems are private.
   ========================================================= */

const SKIP_LOCK_SECONDS = 15;   // shortened for the demo
const MATCH_DELAY_MS = 4000;    // pretend time to find someone

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

/* ---------- Sample data ---------- */
const me = { name: 'Quiet Moon', avatar: 'a-fox' };

const strangers = [
  { name: 'Night Owl', avatar: 'a-owl', bio: 'Into rain sounds, old movies, and late-night walks' },
  { name: 'Rainy Cat', avatar: 'a-cat', bio: 'Can’t sleep, happy to listen' },
  { name: 'Moon Rabbit', avatar: 'a-rabbit', bio: 'Night shift worker, music nerd' },
  { name: 'Sleepy Bear', avatar: 'a-bear', bio: 'Long week. Just want a calm chat' }
];

let connections = [
  { id: 1, name: 'Night Owl', avatar: 'a-owl', time: '11:44 PM', unread: 1, messages: [
    { from: 'them', text: 'Hey, thanks again for last night. I actually slept.' },
    { from: 'me', text: 'Same here. The rain sounds idea worked', status: 'Read 11:44 PM' },
    { from: 'them', text: 'Want to talk again tonight? Around 11?' }
  ] },
  { id: 2, name: 'Rainy Cat', avatar: 'a-cat', time: 'Mon', unread: 0, messages: [
    { from: 'me', text: 'Hope your interview went okay!' },
    { from: 'them', text: 'It did! Thanks for hyping me up' }
  ] },
  { id: 3, name: 'Moon Rabbit', avatar: 'a-rabbit', time: 'Sep 28', unread: 0, messages: [
    { from: 'them', text: 'That playlist was perfect, thank you' }
  ] }
];

let blocked = [{ name: 'Static Fox', avatar: 'a-fox' }];

/* ---------- Small helpers ---------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

function avatarSvg(id) {
  return '<svg class="icon"><use href="#' + id + '"/></svg>';
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ':' + String(s).padStart(2, '0');
}

function fakeOnlineCount() {
  return 140 + Math.floor(Math.random() * 40);
}

function setError(inputId, errId, msg) {
  const input = inputId ? document.getElementById(inputId) : null;
  const err = document.getElementById(errId);
  if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  err.textContent = msg || '';
  return !msg;
}

/* ---------- Screen navigation ---------- */
const backStack = [];
let current = null;
const timers = {};

function go(id, opts = {}) {
  const next = document.getElementById(id);
  if (!next || !next.classList.contains('screen') || id === current) return;
  if (current) {
    leaveScreen(current);
    if (opts.push !== false) backStack.push(current);
  }
  $$('.screen').forEach(s => s.classList.toggle('active', s === next));
  document.body.className = next.dataset.chrome === 'app' ? 'chrome-app' : 'chrome-none';

  const navKey = id === 'chat' ? 'connections' : id;
  $$('[data-nav]').forEach(b => {
    if (b.dataset.nav === navKey) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });

  current = id;
  if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
  window.scrollTo(0, 0);
  enterScreen(id);

  const h1 = next.querySelector('h1');
  if (h1 && opts.focus !== false) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
}

function enterScreen(id) {
  if (id === 'home') {
    const hr = new Date().getHours();
    $('#home-greeting').textContent = hr < 5 ? 'Still up?' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
    const tick = () => { $('#online-count').textContent = fakeOnlineCount(); };
    tick();
    timers.online = setInterval(tick, 2000);
  }
  if (id === 'waiting') startWaiting();
  if (id === 'aftercall') resetAfterCall();
  if (id === 'connections') renderConnections();
  if (id === 'chat') renderChat();
  if (id === 'settings') renderBlocked();
}

function leaveScreen(id) {
  if (id === 'home') clearInterval(timers.online);
  if (id === 'waiting') { clearInterval(timers.breath); clearInterval(timers.online2); clearTimeout(timers.match); }
  if (id === 'call') clearInterval(timers.call);
  $('#chat-menu').hidden = true;
}

/* ---------- Global click wiring ---------- */
document.addEventListener('click', e => {
  const goEl = e.target.closest('[data-go]');
  if (goEl) { e.preventDefault(); go(goEl.dataset.go); return; }

  const back = e.target.closest('[data-back]');
  if (back) { go(backStack.pop() || 'landing', { push: false }); return; }

  const open = e.target.closest('[data-open]');
  if (open) {
    e.preventDefault();
    if (open.dataset.open === 'feedback-sheet') resetFeedback();
    document.getElementById(open.dataset.open).showModal();
    return;
  }

  const close = e.target.closest('[data-close]');
  if (close) { close.closest('dialog').close(); return; }

  const ph = e.target.closest('[data-placeholder]');
  if (ph) { e.preventDefault(); toast('This page isn’t part of the demo'); return; }

  const t = e.target.closest('[data-toast]');
  if (t) { toast(t.dataset.toast); return; }

  const rep = e.target.closest('[data-report]');
  if (rep) { openReport(rep.dataset.report); return; }

  // single-choice groups (report categories, skip reasons, ratings)
  const choice = e.target.closest('[data-choice-group] .choice, [data-rate]');
  if (choice) {
    const group = choice.closest('[data-choice-group]') || choice.parentElement;
    $$('.choice', group).forEach(c => c.setAttribute('aria-checked', String(c === choice)));
    if (group.dataset.choiceGroup === 'skip') $('#skip-report-hint').hidden = choice.dataset.value !== 'uncomfortable';
    if (group.dataset.choiceGroup === 'report') $('#report-err').textContent = '';
    return;
  }

  // Feedback type: pick exactly one
  const kindChip = e.target.closest('#feedback-kind .chip');
  if (kindChip) {
    $$('#feedback-kind .chip').forEach(c => {
      c.setAttribute('aria-pressed', String(c === kindChip));
      c.setAttribute('aria-checked', String(c === kindChip));
    });
    return;
  }

  const chip = e.target.closest('.chip');
  if (chip) { chip.setAttribute('aria-pressed', String(chip.getAttribute('aria-pressed') !== 'true')); return; }

  const av = e.target.closest('[data-avatar]');
  if (av) { $$('[data-avatar]').forEach(a => a.setAttribute('aria-checked', String(a === av))); return; }

  // close menus when clicking elsewhere
  if (!e.target.closest('.menu') && !e.target.closest('#chat-more') && !e.target.closest('#jump-btn')) {
    $('#chat-menu').hidden = true; $('#chat-more').setAttribute('aria-expanded', 'false');
    $('#jump-menu').hidden = true; $('#jump-btn').setAttribute('aria-expanded', 'false');
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { $('#chat-menu').hidden = true; $('#jump-menu').hidden = true; }
});

// clicking the dark area around a sheet closes it
$$('dialog.sheet').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

/* ---------- Sign up, verification, profile (demo: validation only) ---------- */
function ageFrom(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

$('#signup-form').addEventListener('submit', e => {
  e.preventDefault();
  const email = $('#su-email').value.trim();
  const pass = $('#su-pass').value;
  const dob = $('#su-dob').value;
  let ok = true;
  ok = setError('su-email', 'su-email-err', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : 'Enter an email like name@example.com.') && ok;
  ok = setError('su-pass', 'su-pass-err', pass.length >= 8 ? '' : 'Use at least 8 characters.') && ok;
  let dobMsg = '';
  if (!dob) dobMsg = 'Enter your date of birth.';
  else if (ageFrom(dob) < 18) dobMsg = 'QuietFox is only for adults 18 and older, so you can’t create an account.';
  ok = setError('su-dob', 'su-dob-err', dobMsg) && ok;
  const checks = $('#su-terms').checked && $('#su-guide').checked;
  ok = setError(null, 'su-check-err', checks ? '' : 'Check both boxes to continue.') && ok;
  if (!ok) return;
  $('#su-pass').value = '';
  go('verify');
});

function showCodeStep(phone) {
  $('#v-sent-to').textContent = '•••• ' + phone.replace(/\D/g, '').slice(-4);
  codeInputs.forEach(c => { c.value = ''; });
  $('#phone-form').hidden = true;
  $('#code-form').hidden = false;
  codeInputs[0].focus();
  toast('Demo: no text is sent. Type any 6 digits.');
}

$('#phone-form').addEventListener('submit', e => {
  e.preventDefault();
  const phone = $('#v-phone').value;
  const digits = phone.replace(/\D/g, '');
  if (!setError('v-phone', 'v-phone-err', digits.length >= 10 ? '' : 'Enter a full mobile number, including the area code.')) return;
  showCodeStep(phone);
});

$('#v-change').addEventListener('click', () => { $('#code-form').hidden = true; $('#phone-form').hidden = false; $('#v-phone').focus(); });
$('#v-resend').addEventListener('click', () => toast('New code sent'));

const codeInputs = $$('.code-inputs input');
codeInputs.forEach((inp, i) => {
  inp.addEventListener('input', () => {
    inp.value = inp.value.replace(/\D/g, '').slice(0, 1);
    if (inp.value && codeInputs[i + 1]) codeInputs[i + 1].focus();
  });
  inp.addEventListener('keydown', e => { if (e.key === 'Backspace' && !inp.value && codeInputs[i - 1]) codeInputs[i - 1].focus(); });
  inp.addEventListener('paste', e => {
    const text = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    codeInputs.forEach((c, j) => { c.value = text[j] || ''; });
    codeInputs[Math.min(text.length, 5)].focus();
  });
});

$('#code-form').addEventListener('submit', e => {
  e.preventDefault();
  const code = codeInputs.map(c => c.value).join('');
  if (!setError(null, 'v-code-err', code.length === 6 ? '' : 'Enter all 6 digits from the text message.')) return;
  go('rules');
});

$('#profile-form').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('#p-name').value.trim();
  if (!setError('p-name', 'p-name-err', name.length >= 2 ? '' : 'Pick a display name with at least 2 characters.')) return;
  const avatar = $('[data-avatar][aria-checked="true"]').dataset.avatar;
  me.name = name;
  me.avatar = avatar;
  $('#s-name').value = name;
  $('#s-bio').value = $('#p-bio').value.trim();
  $('#settings-avatar').innerHTML = avatarSvg(avatar);
  go('home');
  toast('Welcome to QuietFox, ' + name);
});

/* ---------- Log in, log out, password reset (demo) ---------- */
$('#login-form').addEventListener('submit', e => {
  e.preventDefault();
  $('#li-err').hidden = true;
  $('#li-pass').value = '';
  go('home');
});

$('#logout-btn').addEventListener('click', () => {
  backStack.length = 0;
  go('landing');
  toast('You’re logged out');
});

$('#reset-form').addEventListener('submit', e => {
  e.preventDefault();
  const email = $('#r-email').value.trim();
  if (!setError('r-email', 'r-email-err', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : 'Enter the email you signed up with.')) return;
  $('#reset-form').hidden = true;
  $('#reset-done').hidden = false;
});

/* ---------- Finding someone (simulated) ---------- */
function startTalking() { go('waiting'); }
$('#start-btn').addEventListener('click', startTalking);
$('#mic-retry').addEventListener('click', startTalking);

function startWaiting() {
  let inhale = true;
  $('#breath-label').textContent = 'Breathe in…';
  timers.breath = setInterval(() => {
    inhale = !inhale;
    $('#breath-label').textContent = inhale ? 'Breathe in…' : '…and breathe out';
  }, 4000);
  const tick = () => { $('#online-count-2').textContent = fakeOnlineCount(); };
  tick();
  timers.online2 = setInterval(tick, 2000);
  timers.match = setTimeout(() => {
    const pool = strangers.filter(s => !blocked.some(b => b.name === s.name));
    startCall(pool[Math.floor(Math.random() * pool.length)], false);
  }, MATCH_DELAY_MS);
}

function cancelWaiting() { go('home'); toast('You left the queue'); }
$('#wait-cancel').addEventListener('click', cancelWaiting);
$('#wait-back').addEventListener('click', cancelWaiting);

/* ---------- Voice call (simulated: no audio) ---------- */
let partner = strangers[0];
let callSeconds = 0;
let lastCallLength = 0;

function setPartner(p) {
  partner = p;
  $$('[data-partner], [data-report-name]').forEach(el => { el.textContent = p.name; });
}

function setCallStatus(text, connected) {
  $('#call-status').textContent = text;
  $('#wave').classList.toggle('paused', !connected);
}

function startCall(p, direct) {
  $('#skip-row').hidden = direct;
  setPartner(p);
  callSeconds = 0;
  $('#call-name').textContent = p.name;
  $('#call-bio').textContent = p.bio || 'Here for a calm conversation';
  $('#call .avatar-lg').innerHTML = avatarSvg(p.avatar);
  setMuted(false);
  go('call');
  setCallStatus(direct ? 'Calling…' : 'Connected', !direct);
  if (direct) setTimeout(() => { if (current === 'call') setCallStatus('Connected', true); }, 2000);
  updateCallUi();
  timers.call = setInterval(() => { callSeconds++; updateCallUi(); }, 1000);
}

function updateCallUi() {
  $('#call-clock').textContent = fmtTime(callSeconds);
  const btn = $('#skip-btn');
  const left = SKIP_LOCK_SECONDS - callSeconds;
  if (left > 0) {
    btn.disabled = true;
    btn.classList.remove('btn-ghost');
    btn.querySelector('use').setAttribute('href', '#i-lock');
    $('#skip-text').textContent = 'Skip unlocks in ' + fmtTime(left);
  } else if (btn.disabled) {
    btn.disabled = false;
    btn.classList.add('btn-ghost');
    btn.querySelector('use').setAttribute('href', '#i-skip');
    $('#skip-text').textContent = 'Skip to someone new';
  }
}

function setMuted(muted) {
  const btn = $('#mute-btn');
  btn.setAttribute('aria-pressed', String(muted));
  btn.setAttribute('aria-label', muted ? 'Unmute microphone' : 'Mute microphone');
  btn.querySelector('use').setAttribute('href', muted ? '#i-mic-off' : '#i-mic');
  $('#mute-text').textContent = muted ? 'Muted' : 'Mute';
}
$('#mute-btn').addEventListener('click', () => setMuted($('#mute-btn').getAttribute('aria-pressed') !== 'true'));

function endCall() {
  clearInterval(timers.call);
  lastCallLength = callSeconds;
}

$('#end-btn').addEventListener('click', () => { endCall(); go('aftercall'); });
$('#skip-btn').addEventListener('click', () => $('#skip-sheet').showModal());
$('#skip-form').addEventListener('submit', () => { $('#skip-note').value = ''; endCall(); go('waiting'); });
$('#skip-to-report').addEventListener('click', () => { $('#skip-sheet').close(); openReport('call'); });

/* ---------- After the call ---------- */
function resetAfterCall() {
  $('#after-duration').textContent = fmtTime(lastCallLength);
  $$('[data-rate]').forEach(b => b.setAttribute('aria-checked', 'false'));
  $('#connect-ask').hidden = false;
  $('#connect-sent').hidden = true;
}

$('#connect-btn').addEventListener('click', () => {
  $('#connect-ask').hidden = true;
  $('#connect-sent').hidden = false;
});
$('#talk-again').addEventListener('click', startTalking);

/* ---------- Report (demo: nothing is sent) ---------- */
let reportContext = 'call';
function openReport(context) {
  reportContext = context;
  $$('[data-choice-group="report"] .choice').forEach(c => c.setAttribute('aria-checked', 'false'));
  $('#report-details').value = '';
  $('#report-err').textContent = '';
  $('#report-block').checked = true;
  $('#report-include').checked = true;
  $('#report-include-row').hidden = context !== 'chat';
  $('#chat-menu').hidden = true;
  $('#report-sheet').showModal();
}

$('#report-form').addEventListener('submit', e => {
  const picked = $('[data-choice-group="report"] .choice[aria-checked="true"]');
  if (!picked) { e.preventDefault(); $('#report-err').textContent = 'Pick what happened so we can review it.'; return; }
  const alsoBlock = $('#report-block').checked;
  if (alsoBlock) blockPerson(partner);
  if (reportContext === 'call') { endCall(); go('home'); }
  else if (reportContext === 'chat' && alsoBlock) go('connections');
  else if (reportContext === 'aftercall') go('home');
  toast(alsoBlock ? 'Report sent. ' + partner.name + ' is blocked.' : 'Report sent. Thank you for telling us.');
});

function blockPerson(p) {
  if (!blocked.some(b => b.name === p.name)) blocked.push({ name: p.name, avatar: p.avatar });
  connections = connections.filter(c => c.name !== p.name);
}

/* ---------- Connections ---------- */
function updateBadges() {
  const pending = !$('#requests-block').hidden ? 1 : 0;
  $$('.tab .badge, .side-link .badge').forEach(b => { b.hidden = !pending; });
}

function renderConnections() {
  const list = $('#conn-list');
  list.innerHTML = connections.map(c => {
    const last = c.messages[c.messages.length - 1];
    const preview = last ? (last.from === 'me' ? 'You: ' : '') + last.text : 'Say hi';
    return '<button class="list-item" data-chat="' + c.id + '">' +
      '<span class="avatar">' + avatarSvg(c.avatar) + '</span>' +
      '<span class="grow"><h3>' + escapeHtml(c.name) + '</h3><p class="preview">' + escapeHtml(preview) + '</p></span>' +
      '<span class="stack" style="align-items: flex-end; gap: 6px"><span class="tiny muted">' + c.time + '</span>' +
      (c.unread ? '<span class="badge" aria-label="' + c.unread + ' unread">' + c.unread + '</span>' : '') + '</span>' +
      '</button>';
  }).join('');
  $('#conn-empty').hidden = connections.length > 0;
  $$('[data-chat]', list).forEach(b => b.addEventListener('click', () => openChat(Number(b.dataset.chat))));
}

$('#req-accept').addEventListener('click', () => {
  connections.unshift({ id: Date.now(), name: 'Sleepy Bear', avatar: 'a-bear', time: 'Now', unread: 0, messages: [] });
  $('#requests-block').hidden = true;
  updateBadges();
  renderConnections();
  toast('You and Sleepy Bear are connected');
});
$('#req-decline').addEventListener('click', () => { $('#requests-block').hidden = true; updateBadges(); toast('Request declined'); });

/* ---------- Chat (sample messages, stored only in this page) ---------- */
let chatWith = connections[0];

function openChat(id) {
  chatWith = connections.find(c => c.id === id) || connections[0];
  if (chatWith) chatWith.unread = 0;
  go('chat');
}

function renderChat() {
  if (!chatWith || !connections.includes(chatWith)) chatWith = connections[0];
  if (!chatWith) { go('connections'); return; }
  setPartner({ name: chatWith.name, avatar: chatWith.avatar });
  $('#chat-name').textContent = chatWith.name;
  $('#chat-avatar').innerHTML = avatarSvg(chatWith.avatar);
  const box = $('#messages');
  let html = '<span class="day-sep">Today</span>';
  chatWith.messages.forEach((m, i) => {
    html += '<p class="bubble ' + m.from + '">' + escapeHtml(m.text) + '</p>';
    if (m.from === 'me' && i === chatWith.messages.length - 1) html += '<span class="meta me" id="read-status">' + (m.status || 'Sent') + '</span>';
  });
  if (!chatWith.messages.length) html += '<p class="empty small">You’re connected. Say hi.</p>';
  box.innerHTML = html;
  box.scrollTop = box.scrollHeight;
  checkPersonalInfo();
}

$('#chat-e2e').addEventListener('click', () => {
  $('#e2e-sheet').showModal();
  $('#security-code').textContent = '48213 90577 13046 62819 05532 77140';
});

// Personal-info filter: blocks contact details before a message is sent.
const piiRules = [
  { kind: 'an email address', re: /[^\s@]+@[^\s@]+\.[a-z]{2,}/i },
  { kind: 'a phone number', re: /(?:\+?\d[\s().-]*){7,}/ },
  { kind: 'a social media handle', re: /(^|\s)@[a-z0-9_.]{2,}|\b(snap(chat)?|insta(gram)?|tiktok|discord|telegram|whats\s?app|facebook|fb|twitter)\b/i },
  { kind: 'a street address', re: /\b\d{1,5}\s+(\w+\s){1,3}(street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way)\b/i }
];

function findPersonalInfo(text) {
  const hit = piiRules.find(r => r.re.test(text));
  return hit ? hit.kind : null;
}

function checkPersonalInfo() {
  const text = $('#msg-input').value;
  const kind = findPersonalInfo(text);
  $('#pii-warning').hidden = !kind;
  if (kind) $('#pii-kind').textContent = kind;
  $('#send-btn').disabled = !text.trim() || !!kind;
}

$('#msg-input').addEventListener('input', checkPersonalInfo);
$('#msg-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#composer').requestSubmit(); }
});

$('#composer').addEventListener('submit', e => {
  e.preventDefault();
  const text = $('#msg-input').value.trim();
  if (!text || findPersonalInfo(text)) return;
  const msg = { from: 'me', text, status: 'Sent' };
  chatWith.messages.push(msg);
  chatWith.time = 'Now';
  $('#msg-input').value = '';
  renderChat();
  setTimeout(() => {
    msg.status = 'Read just now';
    const rs = $('#read-status');
    if (rs && current === 'chat') rs.textContent = msg.status;
  }, 1500);
});

$('#chat-more').addEventListener('click', () => {
  const menu = $('#chat-menu');
  menu.hidden = !menu.hidden;
  $('#chat-more').setAttribute('aria-expanded', String(!menu.hidden));
  if (!menu.hidden) menu.querySelector('button').focus();
});

$('#chat-call').addEventListener('click', () => {
  const s = strangers.find(x => x.name === chatWith.name);
  startCall({ name: chatWith.name, avatar: chatWith.avatar, bio: s ? s.bio : '' }, true);
});

$('#chat-remove').addEventListener('click', () => {
  connections = connections.filter(c => c !== chatWith);
  go('connections');
  toast('Connection removed');
});

$('#chat-block').addEventListener('click', () => {
  blockPerson({ name: chatWith.name, avatar: chatWith.avatar });
  go('connections');
  toast(chatWith.name + ' is blocked. You won’t be matched or messaged again.');
});

/* ---------- Settings ---------- */
function renderBlocked() {
  const list = $('#blocked-list');
  list.innerHTML = blocked.map((b, i) =>
    '<div class="list-item" style="cursor: default"><span class="avatar">' + avatarSvg(b.avatar) + '</span>' +
    '<span class="grow"><h3>' + escapeHtml(b.name) + '</h3></span>' +
    '<button class="btn btn-ghost" style="min-height: 44px; padding: 0 16px" data-unblock="' + i + '">Unblock</button></div>'
  ).join('');
  $('#blocked-empty').hidden = blocked.length > 0;
  $$('[data-unblock]', list).forEach(btn => btn.addEventListener('click', () => {
    const removed = blocked.splice(Number(btn.dataset.unblock), 1)[0];
    renderBlocked();
    toast(removed.name + ' is unblocked');
  }));
}

$('#settings-profile').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('#s-name').value.trim();
  if (name.length < 2) { toast('Pick a display name with at least 2 characters.'); return; }
  me.name = name;
  toast('Profile saved');
});

$('#password-form').addEventListener('submit', e => {
  e.preventDefault();
  const cur = $('#pw-current').value, next = $('#pw-new').value;
  let msg = '';
  if (!cur) msg = 'Enter your current password.';
  else if (next.length < 8) msg = 'Use at least 8 characters for the new password.';
  else if (next === cur) msg = 'Pick a password you haven’t used here.';
  if (!setError('pw-new', 'pw-err', msg)) return;
  $('#pw-current').value = ''; $('#pw-new').value = '';
  toast('Password changed');
});

$('#delete-form').addEventListener('submit', e => {
  e.preventDefault();
  if (!$('#del-pass').value) { setError('del-pass', 'del-err', 'Enter your password to delete your account.'); return; }
  setError('del-pass', 'del-err', '');
  $('#del-pass').value = '';
  $('#delete-sheet').close();
  backStack.length = 0;
  go('landing');
  toast('Demo: nothing was deleted');
});

/* ---------- Beta feedback (demo: nothing is sent) ---------- */
function resetFeedback() {
  $$('#feedback-kind .chip').forEach((c, i) => {
    c.setAttribute('aria-pressed', String(i === 0));
    c.setAttribute('aria-checked', String(i === 0));
  });
  $('#feedback-message').value = '';
  $('#feedback-screen').checked = true;
  setError('feedback-message', 'feedback-err', '');
}

$('#feedback-form').addEventListener('submit', e => {
  e.preventDefault();
  const message = $('#feedback-message').value.trim();
  if (!setError('feedback-message', 'feedback-err', message.length >= 5 ? '' : 'Add a few words so we know what to look at.')) return;
  $('#feedback-sheet').close();
  toast('Thanks! (Demo: feedback isn’t sent.)');
});

/* ---------- Screen jumper ---------- */
const jumpList = [
  ['landing', 'Landing page'], ['signup', 'Sign up'], ['verify', 'Phone verification'], ['rules', 'House rules'],
  ['profile-setup', 'Profile setup'], ['login', 'Log in'], ['reset', 'Password reset'], ['guidelines', 'Community guidelines'],
  ['terms', 'Terms of Service'], ['privacy', 'Privacy Policy'], ['contact', 'Contact'],
  ['home', 'Home'], ['mic', 'Microphone blocked'], ['waiting', 'Finding someone'], ['call', 'Voice call'],
  ['aftercall', 'After the call'], ['connections', 'Connections'], ['chat', 'Chat'], ['settings', 'Settings'],
  ['#help-sheet', 'Sheet: crisis help'], ['#report-sheet', 'Sheet: report'], ['#skip-sheet', 'Sheet: skip reason'],
  ['#delete-sheet', 'Sheet: delete account'], ['#feedback-sheet', 'Sheet: send feedback']
];
$('#jump-menu').innerHTML = jumpList.map(([id, label]) => '<button data-jump="' + id + '">' + label + '</button>').join('');
$('#jump-btn').addEventListener('click', () => {
  const m = $('#jump-menu');
  m.hidden = !m.hidden;
  $('#jump-btn').setAttribute('aria-expanded', String(!m.hidden));
});
$('#jump-menu').addEventListener('click', e => {
  const b = e.target.closest('[data-jump]');
  if (!b) return;
  $('#jump-menu').hidden = true;
  const id = b.dataset.jump;
  if (id.startsWith('#')) { if (id === '#report-sheet') openReport('call'); else $(id).showModal(); return; }
  if (id === 'call') { startCall(strangers[0], false); return; }
  if (id === 'chat') { openChat(connections[0] ? connections[0].id : 0); return; }
  go(id);
});

/* ---------- Start ---------- */
window.addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (id === 'call') return;
  go(id);
});
const startId = location.hash.slice(1);
go(document.getElementById(startId) && startId !== 'call' ? startId : 'landing', { focus: false });
