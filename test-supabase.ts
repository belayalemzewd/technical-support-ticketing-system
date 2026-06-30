import * as dotenv from "dotenv";
dotenv.config();

async function test() {
  try {
    const rawUrl = process.env.SUPABASE_URL;
    const url = rawUrl ? rawUrl.trim() : '';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    const key = (serviceKey || anonKey || '').trim();

    if (url && key) {
      const specUrl = `${url}/rest/v1/`;
      const res = await fetch(specUrl, {
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`
        }
      });
      if (res.ok) {
        const openapi = await res.json();
        console.log("tickets properties:", openapi.definitions?.tickets?.properties?.issue_types);
        console.log("hardware properties:", openapi.definitions?.hardware?.properties?.issue_types);
      } else {
        console.warn(`OpenAPI fetch failed: status ${res.status}`);
      }
    }
  } catch (err: any) {
    console.error("Caught error:", err.message, err);
  }
}

test();
