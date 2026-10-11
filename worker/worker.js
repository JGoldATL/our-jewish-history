// Jewish Journeys quiz logger: Cloudflare Worker + D1 (binding name: DB).
// Receives one anonymous row per quiz answer or survey tap. It never reads, logs or stores IP addresses, names, emails or headers.
// The quiz posts text/plain JSON (a "simple" request, so no CORS preflight). Replies carry no body and the quiz ignores them.
// Trust rule: the browser sends only a visit id, a question id and its pick. Era, style and right/wrong come from the question_lock table.

const ALLOW_ORIGIN = 'https://jgoldatl.github.io';
const MAX_BODY = 1000000;        // bytes: only feedback rows with a photo come near this
const MAX_BODY_OTHER = 4096;     // answers and surveys are tiny
const MAX_IMAGE_CHARS = 900000;  // a photo, shrunk and base64-encoded by the page, stays well under this
const MAX_IMAGES_PER_VISIT = 2, MAX_IMAGES_PER_HOUR = 20;
const MAX_ROWS_PER_VISIT = 60;   // a real visit is a handful of rows
const MAX_PER_QUESTION = 3;      // one visit may meet a question again only after its pool resets
const MAX_ROWS_PER_HOUR = 1500;  // whole-site ceiling; refuses new rows until the hour turns over
const SURVEY = ['A lot', 'Somewhat', 'Not really'];
const TOPICS = ['Idea', 'Problem', 'Question', 'Praise'];   // feedback page
const MAX_FEEDBACK_PER_VISIT = 5, MAX_FEEDBACK_PER_HOUR = 100;

const cors = (origin) => ({
  'Access-Control-Allow-Origin': origin === ALLOW_ORIGIN ? origin : ALLOW_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Gate-Token, X-Admin-Token',
  'Access-Control-Max-Age': '86400',
});
const reply = (status, origin) => new Response(null, { status, headers: cors(origin) });
const str = (v, re, max) => (typeof v === 'string' && v.length <= max && re.test(v) ? v : null);

// Shape check only. Returns { visit, rnd, kind, q, picked, survey } or null. Unknown fields are dropped.
function shape(b) {
  if (!b || typeof b !== 'object') return null;
  const visit = str(b.visit_id, /^(test-)?[a-z0-9]{12,32}$/, 37);
  if (!visit) return null;
  const rnd = str(b.round_id, /^[a-z0-9]{8,32}$/, 32);   // optional: which round of 3 this row belongs to
  if (b.kind === 'feedback') {
    const message = typeof b.message === 'string' ? b.message.trim() : '';
    const image = typeof b.image === 'string' && b.image.length <= MAX_IMAGE_CHARS && /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+\/]+={0,2}$/.test(b.image) ? b.image : null;   // JPEG only (the page converts)
    if (b.image !== undefined && b.image !== null && !image) return null;                     // a bad photo refuses the whole message
    return TOPICS.includes(b.topic) && message.length >= 3 && message.length <= 1000 ? { visit, kind: 'feedback', topic: b.topic, message, image } : null;
  }
  if (b.kind === 'survey') return SURVEY.includes(b.survey) ? { visit, rnd, kind: 'survey', survey: b.survey } : null;
  if (b.kind === 'answer') {
    const q = str(b.question_id, /^Q[0-9]{1,6}$/, 8);
    const picked = str(b.picked, /^[0-9](,[0-9]){0,4}$/, 9);
    return q && picked ? { visit, rnd, kind: 'answer', q, picked } : null;
  }
  return null;
}

// Judges a pick against the locked question. Returns { picked, correct } or null if the pick cannot exist for that question.
function judge(lock, picked) {
  const nums = picked.split(',').map(Number);
  if (lock.kind === 'mc') {
    if (nums.length !== 1 || nums[0] >= lock.n) return null;
    return { picked: String(nums[0]), correct: nums[0] === lock.correct_idx ? 1 : 0 };
  }
  // ordering question: the taps must use every position 0..n-1 exactly once
  if (nums.length !== lock.n || new Set(nums).size !== lock.n || nums.some((k) => k >= lock.n)) return null;
  return { picked: nums.join(','), correct: nums.every((k, i) => k === i) ? 1 : 0 };
}


// ============================ Roadmap, gate and private links (v0.5.0) ============================
// HONEST NOTE: this is a courtesy lock. It keeps casual visitors out and keeps the roadmap rows and the Strategy link out of the
// page source and the repo. It is not real security: anyone who is given the code can pass it on.
// Secrets (set by Jeffrey in Cloudflare, never written in the repo, the chat or any file): ROADMAP_CODE (opens the pages),
// ROADMAP_ADMIN (lets one person set Priority and import CSV). Tables: roadmap_features, roadmap_versions, site_links, gate_fail.
const TOKEN_TTL_S = 12 * 3600;                  // a token is good for 12 hours
const GATE_FAIL_WINDOW_MIN = 10, GATE_FAIL_MAX = 60;   // whole-site ceiling on wrong codes per 10 minutes (no IP is stored)
const RM_CONFIG = {                              // the one place the allowed lists live; the page receives them from GET /roadmap
  lists: {
    area: ['Globe', 'Quiz', 'Movements map', 'Religion layers', 'Data', 'Growth', 'Site', 'Strategy', 'Heritage tools'],
    status: ['Idea', 'Approved', 'In build', 'Built', 'Live', 'Parked'],
    version: ['v0.4.0', 'v0.4.1', 'v0.5.0', 'v0.6.0', 'v0.7.0', 'v0.8.0', 'v1.0.0', 'v1.0.+', 'Unplaced'],
    effort: ['S', 'M', 'L'],
    owner: ['Web dev', 'Dataset', 'Strategy', 'CEO'],
    priority: ['P1', 'P2', 'P3'],
  },
  // field -> { list name (enumerated) or max length (free text), blank allowed? }
  fields: {
    feature: { max: 200 }, about: { max: 1000 },
    area: { list: 'area' }, rec: { list: 'version' }, mine: { list: 'version', blank: true },
    status: { list: 'status' }, deps: { max: 200, blank: true }, gate: { max: 100, blank: true },
    effort: { list: 'effort', blank: true }, owner: { list: 'owner', blank: true },
    source: { max: 200, blank: true }, notes: { max: 1500, blank: true },
    priority: { list: 'priority', blank: true },
  },
  labels: { feature: 'feature', about: 'about', area: 'area', rec: 'recommended version', mine: 'my version', status: 'status', deps: 'depends on', gate: 'gate', effort: 'effort', owner: 'owner', source: 'source', notes: 'notes', priority: 'priority' },
};
const RM_FIELDS = Object.keys(RM_CONFIG.fields);
const RM_COLS = ['id', ...RM_FIELDS, 'sort_order'];

const json = (status, body, origin) => new Response(JSON.stringify(body), { status, headers: { ...cors(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
async function hmac(secret, msg) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg)));
}
const same = (a, b) => { if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
async function codeMatches(typed, secret) {   // compares hashes so length and timing reveal nothing
  if (typeof typed !== 'string' || !secret) return false;
  return same(await hmac('code-compare', typed), await hmac('code-compare', secret));
}
async function makeToken(secret, role) {
  const payload = role + '.' + (Math.floor(Date.now() / 1000) + TOKEN_TTL_S);
  return payload + '.' + await hmac(secret, payload);
}
async function tokenOk(secret, token, role) {
  if (!secret || typeof token !== 'string') return false;
  const p = token.split('.');
  if (p.length !== 3 || p[0] !== role || !/^\d{9,12}$/.test(p[1]) || Number(p[1]) < Math.floor(Date.now() / 1000)) return false;
  return same(await hmac(secret, p[0] + '.' + p[1]), p[2]);
}
const nowIso = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');

function checkField(f, v) {                      // returns the cleaned value, or null if it is not allowed
  const spec = RM_CONFIG.fields[f];
  if (!spec || typeof v !== 'string') return null;
  v = v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim();
  if (v === '') return spec.blank ? '' : null;
  if (spec.list) return RM_CONFIG.lists[spec.list].includes(v) ? v : null;
  return v.length <= spec.max ? v : null;
}
const cleanName = (n) => (typeof n === 'string' ? n.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 60) : '');
const rowShape = (r) => Object.fromEntries(RM_COLS.map((c) => [c, r[c] ?? (c === 'sort_order' ? 0 : '')]));

async function allRows(env) { return ((await env.DB.prepare('SELECT ' + RM_COLS.join(', ') + ' FROM roadmap_features ORDER BY sort_order, id').all()).results || []).map(rowShape); }
async function latestVersion(env) { const r = await env.DB.prepare('SELECT MAX(version_id) AS v FROM roadmap_versions').first(); return (r && r.v) || 0; }
const insertVersion = (env, label, summary, snapshot) => env.DB.prepare('INSERT INTO roadmap_versions (saved_at, saved_by_label, summary, snapshot) VALUES (?, ?, ?, ?)').bind(nowIso(), label, summary, JSON.stringify(snapshot));
const insertRow = (env, r) => env.DB.prepare('INSERT INTO roadmap_features (' + RM_COLS.join(', ') + ') VALUES (' + RM_COLS.map(() => '?').join(', ') + ')').bind(...RM_COLS.map((c) => r[c]));

function describe(changes) {                     // auto-written summary, e.g. "F-024 status Approved to In build; F-031 my version v0.6.0 to v0.5.0"
  const parts = changes.map((c) => c.id + ' ' + RM_CONFIG.labels[c.field] + ' ' + (c.field === 'about' || c.field === 'notes' ? 'edited' : (c.from || 'blank') + ' to ' + (c.to || 'blank')));
  const out = parts.slice(0, 8).join('; ') + (parts.length > 8 ? '; +' + (parts.length - 8) + ' more' : '');
  return out.slice(0, 1000);
}

async function handleSite(req, env, url, origin) {
  const path = url.pathname.replace(/\/+$/, '');
  const gateTok = req.headers.get('X-Gate-Token') || '', adminTok = req.headers.get('X-Admin-Token') || '';
  const gated = async () => await tokenOk(env.ROADMAP_CODE, gateTok, 'gate');
  const isAdmin = async () => await tokenOk(env.ROADMAP_ADMIN, adminTok, 'admin');
  const body = async (max = 200000) => { const t = await req.text(); if (t.length > max) throw new Error('big'); return JSON.parse(t); };

  async function failLimited() {
    const f = await env.DB.prepare("SELECT COUNT(*) AS n FROM gate_fail WHERE ts >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-" + GATE_FAIL_WINDOW_MIN + " minutes')").first();
    return f && f.n >= GATE_FAIL_MAX;
  }
  async function recordFail() {
    await env.DB.prepare('INSERT INTO gate_fail DEFAULT VALUES').run();
    await env.DB.prepare("DELETE FROM gate_fail WHERE ts < strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day')").run();
  }

  if (path === '/gate' && req.method === 'POST') {
    const b = await body(2000);
    if (!['roadmap', 'strategy'].includes(b.page)) return json(400, { error: 'bad_page' }, origin);
    if (!env.ROADMAP_CODE) return json(503, { error: 'not_configured' }, origin);
    if (await failLimited()) return json(429, { error: 'slow_down' }, origin);
    if (!(await codeMatches(b.code, env.ROADMAP_CODE))) { await recordFail(); return json(401, { error: 'wrong_code' }, origin); }
    return json(200, { token: await makeToken(env.ROADMAP_CODE, 'gate') }, origin);
  }
  if (path === '/admin' && req.method === 'POST') {
    if (!(await gated())) return json(401, { error: 'no_token' }, origin);
    const b = await body(2000);
    if (!env.ROADMAP_ADMIN) return json(503, { error: 'not_configured' }, origin);
    if (await failLimited()) return json(429, { error: 'slow_down' }, origin);
    if (!(await codeMatches(b.code, env.ROADMAP_ADMIN))) { await recordFail(); return json(401, { error: 'wrong_code' }, origin); }
    return json(200, { admin_token: await makeToken(env.ROADMAP_ADMIN, 'admin') }, origin);
  }
  if (!(await gated())) return json(401, { error: 'no_token' }, origin);   // everything below needs the gate token

  if (path === '/link' && req.method === 'GET') {
    const name = url.searchParams.get('name') || '';
    if (!/^[a-z]{3,20}$/.test(name)) return json(400, { error: 'bad_name' }, origin);
    const r = await env.DB.prepare('SELECT url FROM site_links WHERE name = ?').bind(name).first();
    return r ? json(200, { url: r.url }, origin) : json(404, { error: 'no_link' }, origin);
  }
  if (path === '/roadmap' && req.method === 'GET') return json(200, { config: RM_CONFIG, rows: await allRows(env), version: await latestVersion(env), admin: await isAdmin() }, origin);
  if (path === '/roadmap/versions' && req.method === 'GET') {
    const r = await env.DB.prepare('SELECT version_id, saved_at, saved_by_label, summary FROM roadmap_versions ORDER BY version_id DESC LIMIT 200').all();
    return json(200, { versions: r.results || [] }, origin);
  }
  if (path === '/roadmap/version' && req.method === 'GET') {
    const id = Number(url.searchParams.get('id'));
    const r = Number.isInteger(id) ? await env.DB.prepare('SELECT version_id, saved_at, saved_by_label, summary, snapshot FROM roadmap_versions WHERE version_id = ?').bind(id).first() : null;
    return r ? json(200, { version_id: r.version_id, saved_at: r.saved_at, saved_by_label: r.saved_by_label, summary: r.summary, rows: JSON.parse(r.snapshot) }, origin) : json(404, { error: 'no_version' }, origin);
  }

  if (path === '/roadmap/save' && req.method === 'POST') {
    const b = await body();
    if (!Array.isArray(b.changes) || !b.changes.length || b.changes.length > 200) return json(400, { error: 'bad_changes' }, origin);
    const admin = await isAdmin();
    const rows = await allRows(env), byId = new Map(rows.map((r) => [r.id, r]));
    const applied = [];
    for (const c of b.changes) {
      if (!c || typeof c.id !== 'string' || !byId.has(c.id)) return json(400, { error: 'unknown_row' }, origin);
      if (!RM_FIELDS.includes(c.field)) return json(400, { error: 'unknown_field' }, origin);
      if (c.field === 'priority' && !admin) return json(403, { error: 'priority_locked' }, origin);   // checked here, whatever the page does
      const v = checkField(c.field, c.value);
      if (v === null) return json(400, { error: 'bad_value', id: c.id, field: c.field }, origin);
      const row = byId.get(c.id);
      if (row[c.field] === v) continue;
      applied.push({ id: c.id, field: c.field, from: row[c.field], to: v });
      row[c.field] = v;
    }
    const latest = await latestVersion(env);
    if (!applied.length) return json(200, { version: latest, unchanged: true }, origin);
    const stale = Number.isInteger(b.base_version) && b.base_version < latest;      // someone saved since this page loaded: last save wins, history keeps both
    const stmts = applied.map((a) => env.DB.prepare('UPDATE roadmap_features SET ' + a.field + ' = ? WHERE id = ?').bind(a.to, a.id));
    stmts.push(insertVersion(env, cleanName(b.name), describe(applied), rows));
    const res = await env.DB.batch(stmts);
    return json(200, { version: res[res.length - 1].meta.last_row_id, stale }, origin);
  }

  if (path === '/roadmap/restore' && req.method === 'POST') {
    const b = await body(2000);
    const id = Number(b.version_id);
    const old = Number.isInteger(id) ? await env.DB.prepare('SELECT snapshot FROM roadmap_versions WHERE version_id = ?').bind(id).first() : null;
    if (!old) return json(404, { error: 'no_version' }, origin);
    const admin = await isAdmin();
    const cur = new Map((await allRows(env)).map((r) => [r.id, r]));
    const rows = JSON.parse(old.snapshot).map(rowShape);
    if (!admin) rows.forEach((r) => { r.priority = cur.has(r.id) ? cur.get(r.id).priority : ''; });   // only the admin can change Priority, even by restoring
    const stmts = [env.DB.prepare('DELETE FROM roadmap_features'), ...rows.map((r) => insertRow(env, r))];
    stmts.push(insertVersion(env, cleanName(b.name), 'Restored version ' + id, rows));
    const res = await env.DB.batch(stmts);
    return json(200, { version: res[res.length - 1].meta.last_row_id }, origin);
  }

  if (path === '/roadmap/import' && req.method === 'POST') {
    if (!(await isAdmin())) return json(403, { error: 'admin_only' }, origin);
    const b = await body(900000);
    if (!Array.isArray(b.rows) || !b.rows.length || b.rows.length > 500) return json(400, { error: 'bad_rows' }, origin);
    const rows = [], seen = new Set();
    for (const [i, r] of b.rows.entries()) {
      if (!r || typeof r.id !== 'string' || !/^F-\d{3,4}$/.test(r.id) || seen.has(r.id)) return json(400, { error: 'bad_id', row: i + 1 }, origin);
      seen.add(r.id);
      const out = { id: r.id, sort_order: Number.isInteger(r.sort_order) ? r.sort_order : i + 1 };
      for (const f of RM_FIELDS) { const v = checkField(f, r[f] === undefined || r[f] === null ? '' : String(r[f])); if (v === null) return json(400, { error: 'bad_value', id: r.id, field: f }, origin); out[f] = v; }
      rows.push(out);
    }
    const stmts = [env.DB.prepare('DELETE FROM roadmap_features'), ...rows.map((r) => insertRow(env, r))];
    stmts.push(insertVersion(env, cleanName(b.name), 'Imported from CSV', rows));
    const res = await env.DB.batch(stmts);
    return json(200, { version: res[res.length - 1].meta.last_row_id, count: rows.length }, origin);
  }
  return json(404, { error: 'not_found' }, origin);
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    if (req.method === 'OPTIONS') return reply(204, origin);
    const url = new URL(req.url);
    if (/^\/(gate|admin|link|roadmap)(\/|$)/.test(url.pathname)) {
      try { return await handleSite(req, env, url, origin); } catch (e) { return json(400, { error: 'bad_request' }, origin); }
    }
    if (req.method !== 'POST') return reply(405, origin);
    try {
      const len = Number(req.headers.get('Content-Length') || 0);
      if (len > MAX_BODY) return reply(413, origin);
      const text = await req.text();
      if (text.length > MAX_BODY) return reply(413, origin);
      const row = shape(JSON.parse(text));
      if (!row) return reply(400, origin);
      if (row.kind !== 'feedback' && text.length > MAX_BODY_OTHER) return reply(413, origin);

      if (row.kind === 'feedback') {
        const fh = await env.DB.prepare("SELECT COUNT(*) AS n FROM feedback WHERE ts >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 hour')").first();
        if (fh && fh.n >= MAX_FEEDBACK_PER_HOUR) return reply(429, origin);
        const fv = await env.DB.prepare('SELECT COUNT(*) AS n FROM feedback WHERE visit_id = ?').bind(row.visit).first();
        if (fv && fv.n >= MAX_FEEDBACK_PER_VISIT) return reply(429, origin);
        if (row.image) {
          const ih = await env.DB.prepare("SELECT COUNT(*) AS n FROM feedback WHERE image IS NOT NULL AND ts >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 hour')").first();
          if (ih && ih.n >= MAX_IMAGES_PER_HOUR) return reply(429, origin);
          const iv = await env.DB.prepare('SELECT COUNT(*) AS n FROM feedback WHERE visit_id = ? AND image IS NOT NULL').bind(row.visit).first();
          if (iv && iv.n >= MAX_IMAGES_PER_VISIT) return reply(429, origin);
        }
        await env.DB.prepare('INSERT INTO feedback (visit_id, topic, message, image) VALUES (?, ?, ?, ?)').bind(row.visit, row.topic, row.message, row.image).run();
        return reply(204, origin);
      }
      const hour = await env.DB.prepare("SELECT COUNT(*) AS n FROM responses WHERE ts >= strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 hour')").first();
      if (hour && hour.n >= MAX_ROWS_PER_HOUR) return reply(429, origin);
      const visit = await env.DB.prepare('SELECT COUNT(*) AS n FROM responses WHERE visit_id = ?').bind(row.visit).first();
      if (visit && visit.n >= MAX_ROWS_PER_VISIT) return reply(429, origin);

      if (row.kind === 'survey') {
        await env.DB.prepare("INSERT INTO responses (visit_id, round_id, kind, survey) VALUES (?, ?, 'survey', ?)").bind(row.visit, row.rnd, row.survey).run();
        return reply(204, origin);
      }
      const lock = await env.DB.prepare('SELECT era, style, kind, n, correct_idx FROM question_lock WHERE id = ?').bind(row.q).first();
      if (!lock) return reply(400, origin);                       // unknown question: refuse
      const j = judge(lock, row.picked);
      if (!j) return reply(400, origin);                          // a pick that cannot exist for this question
      const same = await env.DB.prepare("SELECT COUNT(*) AS n FROM responses WHERE visit_id = ? AND question_id = ? AND kind = 'answer'").bind(row.visit, row.q).first();
      if (same && same.n >= MAX_PER_QUESTION) return reply(429, origin);
      await env.DB.prepare(
        "INSERT INTO responses (visit_id, round_id, kind, question_id, era, style, picked, correct) VALUES (?, ?, 'answer', ?, ?, ?, ?, ?)"
      ).bind(row.visit, row.rnd, row.q, lock.era, lock.style, j.picked, j.correct).run();
      return reply(204, origin);
    } catch (e) {
      return reply(400, origin);
    }
  },
};
