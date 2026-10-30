// POST /api/waitlist — adds one sign-up to the "Website waitlist" database in Notion.
// Needs two environment variables in Vercel: NOTION_TOKEN (an internal integration secret)
// and NOTION_WAITLIST_DB (the database id). The integration must be connected to that database.

const WHO = { buyer: 'Home buyer', builder: 'Homebuilder' };
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Use POST.' });
  }

  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

  // Bots fill every field; people never see this one.
  if (body.website) return res.status(200).json({ ok: true });

  const email = String(body.email || '').trim().toLowerCase();
  const who = WHO[body.who] || WHO.buyer;
  const page = String(body.page || '').slice(0, 200);
  if (!EMAIL.test(email)) return res.status(400).json({ ok: false, error: 'That email address doesn\'t look right.' });

  const token = process.env.NOTION_TOKEN, db = process.env.NOTION_WAITLIST_DB;
  if (!token || !db) return res.status(500).json({ ok: false, error: 'The waitlist isn\'t connected yet.' });

  const r = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      parent: { database_id: db },
      properties: {
        Email: { title: [{ text: { content: email } }] },
        Who: { select: { name: who } },
        Page: { rich_text: page ? [{ text: { content: page } }] : [] },
      },
    }),
  });

  if (!r.ok) {
    console.error('Notion write failed', r.status, await r.text());
    return res.status(502).json({ ok: false, error: 'Something went wrong on our side. Please try again.' });
  }
  return res.status(200).json({ ok: true });
};
