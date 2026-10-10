// Jewish Journeys quiz logger: Cloudflare Worker + D1 (binding name: DB).
// Receives one anonymous row per quiz answer or survey tap. It never reads, logs or stores IP addresses, names, emails or headers.
// The quiz posts text/plain JSON (a "simple" request, so no CORS preflight). Replies carry no body and the quiz ignores them.
// Trust rule: the browser sends only a visit id, a question id and its pick. Era, style and right/wrong come from the question_lock table.

const ALLOW_ORIGIN = 'https://jgoldatl.github.io';
const MAX_BODY = 1024;           // bytes
const MAX_ROWS_PER_VISIT = 60;   // a real visit is a handful of rows
const MAX_PER_QUESTION = 3;      // one visit may meet a question again only after its pool resets
const MAX_ROWS_PER_HOUR = 1500;  // whole-site ceiling; refuses new rows until the hour turns over
const SURVEY = ['A lot', 'Somewhat', 'Not really'];

const cors = (origin) => ({
  'Access-Control-Allow-Origin': origin === ALLOW_ORIGIN ? origin : ALLOW_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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
      const row = shape(JSON.parse(text));
      if (!row) return reply(400, origin);

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
