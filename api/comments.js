const { readWall } = require("./_gist");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const wall = (req.query?.wall || "iqram").toString().toLowerCase().replace(/^@/, "");
  try {
    const data = await readWall(wall);
    const paid = (data.comments || [])
      .filter(c => c.status === "paid")
      .sort((a, b) => (b.paid_at || 0) - (a.paid_at || 0));
    return res.status(200).json({ wall, comments: paid });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
