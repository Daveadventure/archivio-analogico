import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

function getSupabase() {
  if (!SUPABASE_URL) throw new Error("SUPABASE_URL mancante");
  if (!SUPABASE_KEY) throw new Error("SUPABASE_KEY mancante");
  return createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
}

async function readJson(req) {
  return await new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(new Error("JSON body non valido")); }
    });
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  try {
    const sb = getSupabase();
    const url = new URL(req.url, "http://localhost"); // base finta ok
    const idFromQuery = url.searchParams.get("id");

    if (req.method === "GET") {
      const { data, error } = await sb
        .from("favorites")
        .select("id")
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      return res.status(200).json({ ids: (data || []).map(r => String(r.id)) });
    }

    if (req.method === "POST") {
      const body = await readJson(req);
      const id = body?.id ? String(body.id) : "";
      if (!id) return res.status(400).json({ error: "id mancante" });

      const { error } = await sb.from("favorites").upsert({ id }, { onConflict: "id" });
      if (error) throw new Error(error.message);

      return res.status(200).json({ ok: true, id });
    }

    if (req.method === "DELETE") {
      const id = idFromQuery ? String(idFromQuery) : "";
      if (!id) return res.status(400).json({ error: "id mancante" });

      const { error } = await sb.from("favorites").delete().eq("id", id);
      if (error) throw new Error(error.message);

      return res.status(200).json({ ok: true, id });
    }

    res.setHeader("Allow", "GET,POST,DELETE");
    return res.status(405).json({ error: "Method not allowed" });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
