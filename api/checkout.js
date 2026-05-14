const Stripe = require("stripe");
const crypto = require("crypto");
const { readWall, writeWall } = require("./_gist");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(503).json({
    error: "stripe not configured",
    hint: "set STRIPE_SECRET_KEY in vercel env"
  });

  try {
    const body = req.body && typeof req.body === "object"
      ? req.body
      : JSON.parse(await readRawBody(req));

    let { wall = "iqram", amount_cents = 100, kind = "text", text = "", media_id = "", name = "", url = "" } = body;
    wall = String(wall).toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_-]/g, "").slice(0, 40) || "iqram";
    kind = ["text", "photo", "voice"].includes(kind) ? kind : "text";
    amount_cents = Math.max(100, Math.min(parseInt(amount_cents, 10) || 100, 100000)); // $1 min, $1000 max

    // Sanity-check content
    if (kind === "text" && !text.trim()) return res.status(400).json({ error: "text required" });
    if (kind !== "text" && !media_id) return res.status(400).json({ error: "media_id required" });
    if (text.length > 600) text = text.slice(0, 600);
    if (name.length > 60) name = name.slice(0, 60);
    if (url && !/^https?:\/\//.test(url)) url = "https://" + url;
    if (url.length > 300) url = "";

    const commentId = crypto.randomBytes(10).toString("hex");

    // Pre-write the comment as pending
    const data = await readWall(wall);
    data.comments.push({
      id: commentId,
      kind,
      text,
      media_id,
      name,
      url,
      amount_cents,
      status: "pending",
      created_at: Date.now()
    });
    // Keep wall to a reasonable size (last 500 entries)
    if (data.comments.length > 500) data.comments = data.comments.slice(-500);
    await writeWall(wall, data);

    const stripe = new Stripe(key, { apiVersion: "2024-12-18.acacia" });
    const origin = (req.headers["x-forwarded-proto"] || "https") + "://" + (req.headers["x-forwarded-host"] || req.headers["host"]);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: `wall post on @${wall}`,
            description: kind === "text" ? text.slice(0, 100) : `${kind} upload`
          },
          unit_amount: amount_cents
        },
        quantity: 1
      }],
      submit_type: "pay",
      success_url: `${origin}/?wall=${encodeURIComponent(wall)}&posted=${commentId}#wall`,
      cancel_url: `${origin}/?wall=${encodeURIComponent(wall)}&cancelled=${commentId}#compose`,
      metadata: { wall, comment_id: commentId, kind }
    });

    return res.status(200).json({ url: session.url, comment_id: commentId });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let buf = "";
    req.on("data", c => (buf += c));
    req.on("end", () => resolve(buf));
    req.on("error", reject);
  });
}
