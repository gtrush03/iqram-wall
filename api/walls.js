module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=30");
  const q = (req.query?.q || "").toString().trim().replace(/^@/, "").slice(0, 40);
  if (!q) return res.status(200).json({ results: [] });

  try {
    const r = await fetch(`https://api.jellyjelly.com/user/search?q=${encodeURIComponent(q)}`, {
      headers: { "User-Agent": "iqram-wall" }
    });
    if (!r.ok) return res.status(200).json({ results: [], note: `jelly returned ${r.status}` });
    const data = await r.json();
    const list = Array.isArray(data?.results) ? data.results
                : Array.isArray(data?.users)   ? data.users
                : Array.isArray(data)          ? data
                : [];
    const results = list.slice(0, 8).map(u => ({
      username: u.username || u.handle || u.user_name || "",
      display: u.display_name || u.name || u.username || "",
      avatar:  u.avatar_url || u.profile_image_url || u.picture || ""
    })).filter(u => u.username);
    return res.status(200).json({ results });
  } catch (e) {
    return res.status(200).json({ results: [], error: String(e.message || e) });
  }
};
