const Stripe = require("stripe");
const { readWall, writeWall } = require("./_gist");

// Tell Vercel not to JSON-parse the body — we need the raw bytes for signature verification.
module.exports.config = { api: { bodyParser: false } };

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const key = process.env.STRIPE_SECRET_KEY;
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key) return res.status(503).send("stripe not configured");

  const stripe = new Stripe(key, { apiVersion: "2024-12-18.acacia" });

  const raw = await readRawBuffer(req);
  let event;
  try {
    if (whSecret) {
      const sig = req.headers["stripe-signature"];
      event = stripe.webhooks.constructEvent(raw, sig, whSecret);
    } else {
      // No webhook secret configured: parse but don't trust.
      // We additionally check the session via the API before mutating.
      event = JSON.parse(raw.toString("utf8"));
    }
  } catch (e) {
    return res.status(400).send(`signature error: ${e.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      let session = event.data.object;
      // If we didn't verify the signature, re-fetch the session from Stripe to confirm it's real.
      if (!whSecret && session?.id) {
        session = await stripe.checkout.sessions.retrieve(session.id);
      }
      if (session?.payment_status === "paid") {
        const wall = session.metadata?.wall || "iqram";
        const commentId = session.metadata?.comment_id;
        if (commentId) {
          const data = await readWall(wall);
          const c = data.comments.find(x => x.id === commentId);
          if (c) {
            c.status = "paid";
            c.paid_at = Date.now();
            c.amount_paid_cents = session.amount_total || c.amount_cents;
            await writeWall(wall, data);
          }
        }
      }
    }
    return res.status(200).json({ received: true });
  } catch (e) {
    console.error("webhook handler error", e);
    return res.status(500).send(String(e.message || e));
  }
};

function readRawBuffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
