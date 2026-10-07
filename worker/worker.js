// Jewish Journeys quiz logger: Cloudflare Worker + D1 (binding name: DB).
// Receives one anonymous row per quiz answer or survey tap. It never reads, logs or stores IP addresses, names, emails or headers.
// The quiz posts text/plain JSON (a "simple" request, so no CORS preflight). Replies are 204 and the quiz ignores them.

const ALLOW_ORIGIN = 'https://jgoldatl.github.io';
const MAX_BODY = 1024;        // bytes
const MAX_ROWS_PER_VISIT = 60; // a real visit is a handful of rows
const SURVEY = ['A lot', 'Somewhat', 'Not really'];

const cors = (origin) => ({
  'Access-Control-Allow-Origin': origin === ALLOW_ORIGIN ? origin : ALLOW_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
});
const reply = (status, origin) => new Response(null, { status, headers: cors(origin) });

// Returns a clean row, or null if anything is off. Unknown fields are dropped.
function clean(b) {
  if (!b || typeof b !== 'object') return null;
  const s = (v, re, max) => (typeof v === 'string' && v.length <= max && re.test(v) ? v : null);
  const visit = s(b.visit_id, /^(test-)?[a-z0-9]{12,32}$/, 37);
  if (!visit) return null;
  if (b.kind === 'answer') {
    const q = s(b.question_id, /^[A-Za-z0-9_.-]{1,40}$/, 40);
    const era = s(b.era, /^[\p{L}\p{N} ,.&'’?!\-–:]{1,60}$/u, 60);
    const style = s(b.style, /^[\p{L}\p{N} ,.&'’?!\-–:]{1,60}$/u, 60);
    const picked = s(b.picked, /^[0-9]{1,2}(,[0-9]{1,2}){0,9}$/, 40);
    if (!q || !era || !style || !picked || (b.correct !== 0 && b.correct !== 1)) return null;
    return { visit, kind: 'answer', q, era, style, picked, correct: b.correct, survey: null };
  }
  if (b.kind === 'survey') {
    if (!SURVEY.includes(b.survey)) return null;
    return { visit, kind: 'survey', q: null, era: null, style: null, picked: null, correct: null, survey: b.survey };
  }
  return null;
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    if (req.method === 'OPTIONS') return reply(204, origin);
    if (req.method !== 'POST') return reply(405, origin);
    try {
      const len = Number(req.headers.get('Content-Length') || 0);
      if (len > MAX_BODY) return reply(413, origin);
      const text = await req.text();
      if (text.length > MAX_BODY) return reply(413, origin);
      const row = clean(JSON.parse(text));
      if (!row) return reply(400, origin);
      const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM responses WHERE visit_id = ?').bind(row.visit).first();
      if (n && n.n >= MAX_ROWS_PER_VISIT) return reply(429, origin);
      await env.DB.prepare(
        'INSERT INTO responses (visit_id, kind, question_id, era, style, picked, correct, survey) VALUES (?,?,?,?,?,?,?,?)'
      ).bind(row.visit, row.kind, row.q, row.era, row.style, row.picked, row.correct, row.survey).run();
      return reply(204, origin);
    } catch (e) {
      return reply(400, origin);
    }
  },
};
