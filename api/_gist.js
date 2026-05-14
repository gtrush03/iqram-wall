// shared helpers for github gist storage
// each "wall" is one file in the comments gist, named <username>.json
// media (photos / voice) is stored as base64 in a separate gist keyed by media_id

const GH = "https://api.github.com";

function ghHeaders() {
  return {
    "Authorization": `token ${process.env.GITHUB_TOKEN}`,
    "Accept": "application/vnd.github+json",
    "User-Agent": "iqram-wall"
  };
}

async function readGist(gistId) {
  const r = await fetch(`${GH}/gists/${gistId}`, { headers: ghHeaders() });
  if (!r.ok) throw new Error(`gist read failed: ${r.status} ${await r.text()}`);
  return r.json();
}

async function patchGist(gistId, files) {
  const r = await fetch(`${GH}/gists/${gistId}`, {
    method: "PATCH",
    headers: { ...ghHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ files })
  });
  if (!r.ok) throw new Error(`gist patch failed: ${r.status} ${await r.text()}`);
  return r.json();
}

function fileNameForWall(wall) {
  const clean = String(wall || "iqram").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  return `${clean || "iqram"}.json`;
}

async function readWall(wall) {
  const gistId = process.env.COMMENTS_GIST_ID;
  const data = await readGist(gistId);
  const fname = fileNameForWall(wall);
  const file = data.files?.[fname];
  if (!file) return { wall, comments: [] };
  let body;
  try { body = JSON.parse(file.content); } catch { body = { wall, comments: [] }; }
  if (!body.wall) body.wall = wall;
  if (!Array.isArray(body.comments)) body.comments = [];
  return body;
}

async function writeWall(wall, body) {
  const gistId = process.env.COMMENTS_GIST_ID;
  const fname = fileNameForWall(wall);
  return patchGist(gistId, { [fname]: { content: JSON.stringify(body, null, 2) } });
}

async function readMediaIndex() {
  const gistId = process.env.MEDIA_GIST_ID;
  const data = await readGist(gistId);
  const file = data.files?.["index.json"];
  try { return JSON.parse(file?.content || "{}"); } catch { return {}; }
}

async function writeMedia(mediaId, payload) {
  const gistId = process.env.MEDIA_GIST_ID;
  const fileName = `${mediaId}.json`;
  await patchGist(gistId, { [fileName]: { content: JSON.stringify(payload) } });
  try {
    const idx = await readMediaIndex();
    idx[mediaId] = { mime: payload.mime, size: payload.size, ts: Date.now() };
    await patchGist(gistId, { "index.json": { content: JSON.stringify(idx, null, 2) } });
  } catch {}
  return { mediaId };
}

async function readMedia(mediaId) {
  const gistId = process.env.MEDIA_GIST_ID;
  const data = await readGist(gistId);
  const file = data.files?.[`${mediaId}.json`];
  if (!file) return null;
  try { return JSON.parse(file.content); } catch { return null; }
}

module.exports = { readWall, writeWall, writeMedia, readMedia, fileNameForWall };
