const { writeMedia, readMedia } = require("./_gist");
const crypto = require("crypto");

// Vercel default body limit is 4.5MB. We further cap below.
const MAX_BYTES = 3_500_000;

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    const id = (req.query?.id || "").toString();
    if (!/^[a-f0-9]{16,}$/.test(id)) return res.status(400).json({ error: "bad id" });
    try {
      const m = await readMedia(id);
      if (!m) return res.status(404).json({ error: "not found" });
      // Serve as a redirect to a data URL? Better: return JSON; client renders.
      return res.status(200).json({ mime: m.mime, data: m.data, size: m.size });
    } catch (e) {
      return res.status(500).json({ error: String(e.message || e) });
    }
  }

  if (req.method !== "POST") return res.status(405).json({ error: "POST or GET" });

  try {
    const body = req.body && typeof req.body === "object"
      ? req.body
      : JSON.parse(await readRawBody(req));
    let { mime, data } = body;
    if (!mime || !data) return res.status(400).json({ error: "missing mime or data" });
    // data is base64 (no data: prefix)
    if (data.startsWith("data:")) data = data.split(",", 2)[1] || data;
    const bytes = Math.floor((data.length * 3) / 4);
    if (bytes > MAX_BYTES) return res.status(413).json({ error: `too large (${bytes} > ${MAX_BYTES})` });
    if (!/^(image\/(png|jpeg|webp|gif)|audio\/(webm|mp4|mpeg|ogg|wav))$/.test(mime))
      return res.status(400).json({ error: "unsupported mime" });

    const id = crypto.randomBytes(12).toString("hex");
    await writeMedia(id, { mime, data, size: bytes });
    return res.status(200).json({ id });
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
