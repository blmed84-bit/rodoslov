// Огледало извештаја у GitHub репозиторијуму (приватном): izvestaji/<дан>/<id>.json
async function ghPut(env, id, body) {
  const day = id.slice(0, 10);
  const path = "izvestaji/" + day + "/" + id + ".json";
  const b64 = btoa(unescape(encodeURIComponent(body)));
  return fetch("https://api.github.com/repos/" + env.GH_REPO + "/contents/" + path, {
    method: "PUT",
    headers: {
      "Authorization": "Bearer " + env.GH_TOKEN,
      "Accept": "application/vnd.github+json",
      "User-Agent": "rodoslov-izvestaji",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message: "izvestaj " + id, content: b64 })
  });
}

export default {
  async fetch(request, env, ctx) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,X-Kljuc"
    };
    const json = (obj) => new Response(JSON.stringify(obj), { headers: Object.assign({ "Content-Type": "application/json" }, cors) });
    const text = (t, status) => new Response(t, { status: status || 200, headers: Object.assign({ "Content-Type": "text/plain; charset=utf-8" }, cors) });

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    const url = new URL(request.url);
    const kljuc = request.headers.get("X-Kljuc") || url.searchParams.get("kljuc") || "";

    if (url.pathname === "/") return text("Rodoslov - servis za izvestaje");

    if (request.method === "POST" && url.pathname === "/izvestaj") {
      if (!env.KLJUC || kljuc !== env.KLJUC) return text("nema pristupa", 403);
      const body = await request.text();
      if (body.length > 2000000) return text("preveliko", 413);
      const id = new Date().toISOString().replace(/[:.]/g, "-") + "-" + Math.random().toString(36).slice(2, 6);
      await env.IZVESTAJI.put(id, body, { expirationTtl: 15552000 });
      if (env.GH_TOKEN && env.GH_REPO) ctx.waitUntil(ghPut(env, id, body).catch(() => {}));
      return json({ ok: true, id: id });
    }

    if (url.pathname === "/glas/proba") {
      if (!env.KLJUC || kljuc !== env.KLJUC) return text("nema pristupa", 403);
      return json({ ok: !!env.AZURE_KEY, region: env.AZURE_REGION || "westeurope" });
    }

    if (request.method === "POST" && url.pathname === "/glas") {
      if (!env.KLJUC || kljuc !== env.KLJUC) return text("nema pristupa", 403);
      if (!env.AZURE_KEY) return text("nema azure kljuca", 501);
      const ssml = await request.text();
      if (ssml.length > 8000) return text("preveliko", 413);
      const day = new Date().toISOString().slice(0, 10);
      const dk = "glas:" + day;
      const used = parseInt((await env.IZVESTAJI.get(dk)) || "0", 10);
      const limit = parseInt(env.GLAS_LIMIT || "80000", 10);
      if (used > limit) return text("dnevni limit", 429);
      const region = env.AZURE_REGION || "westeurope";
      const r = await fetch("https://" + region + ".tts.speech.microsoft.com/cognitiveservices/v1", {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": env.AZURE_KEY,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
          "User-Agent": "rodoslov"
        },
        body: ssml
      });
      if (!r.ok) return text("azure " + r.status + " " + (await r.text()).slice(0, 200), 502);
      const plain = ssml.replace(/<[^>]+>/g, "");
      await env.IZVESTAJI.put(dk, String(used + plain.length), { expirationTtl: 172800 });
      return new Response(r.body, { headers: Object.assign({ "Content-Type": "audio/mpeg" }, cors) });
    }

    if (!env.KLJUC_CITANJE || kljuc !== env.KLJUC_CITANJE) return text("nema pristupa", 403);

    if (url.pathname === "/glas/stanje") {
      const day = new Date().toISOString().slice(0, 10);
      return json({ dan: day, znakova: parseInt((await env.IZVESTAJI.get("glas:" + day)) || "0", 10) });
    }
    if (url.pathname === "/gh/proba") {
      if (!env.GH_TOKEN || !env.GH_REPO) return json({ ok: false, razlog: "nema GH_TOKEN ili GH_REPO" });
      try { const r = await ghPut(env, "proba-" + Date.now(), JSON.stringify({ proba: true, kada: new Date().toISOString() })); return json({ ok: r.ok, status: r.status, tekst: r.ok ? "" : (await r.text()).slice(0, 300) }); }
      catch (e) { return json({ ok: false, razlog: String(e) }); }
    }
    if (url.pathname === "/spisak") {
      const l = await env.IZVESTAJI.list({ limit: 1000 });
      return json(l.keys.map((k) => k.name));
    }
    if (url.pathname === "/sve") {
      const od = url.searchParams.get("od") || "";
      const l = await env.IZVESTAJI.list({ limit: 1000 });
      const out = [];
      for (const k of l.keys) {
        if (k.name < od) continue;
        const v = await env.IZVESTAJI.get(k.name);
        if (v) out.push({ id: k.name, izvestaj: JSON.parse(v) });
      }
      return json(out);
    }
    if (url.pathname === "/obrisi") {
      const l = await env.IZVESTAJI.list({ limit: 1000 });
      for (const k of l.keys) await env.IZVESTAJI.delete(k.name);
      return text("obrisano " + l.keys.length);
    }
    return text("nepoznata adresa", 404);
  }
};
