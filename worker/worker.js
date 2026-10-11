export default {
  async fetch(request, env) {
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
      return json({ ok: true, id: id });
    }

    if (!env.KLJUC_CITANJE || kljuc !== env.KLJUC_CITANJE) return text("nema pristupa", 403);

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
