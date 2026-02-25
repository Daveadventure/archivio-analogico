import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

function supabase() {
  if (!SUPABASE_URL) throw new Error("SUPABASE_URL mancante");
  if (!SUPABASE_KEY) throw new Error("SUPABASE_KEY mancante");
  return createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
}

export default async function handler(req, res) {
  try {
    const sb = supabase();

    if (req.method === "GET") {
      const { data } = await sb.from("favorites").select("id");
      return res.status(200).json({ ids: (data||[]).map(x=>String(x.id)) });
    }

    if (req.method === "POST") {
      let body="";
      await new Promise(r=>{
        req.on("data",c=>body+=c);
        req.on("end",r);
      });
      const parsed=body?JSON.parse(body):{};
      const id=String(parsed.id||"");
      if(!id)return res.status(400).json({error:"id mancante"});
      await sb.from("favorites").upsert({id});
      return res.status(200).json({ok:true});
    }

    if (req.method === "DELETE") {
      const id=String(req.query.id||"");
      await sb.from("favorites").delete().eq("id",id);
      return res.status(200).json({ok:true});
    }

    return res.status(405).json({error:"Method not allowed"});
  } catch(e) {
    return res.status(500).json({error:e.message});
  }
}
