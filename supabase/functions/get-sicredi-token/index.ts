// supabase/functions/get-sicredi-token/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSicrediHttpClient } from "../_shared/sicredi.ts";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // 1. Verificar se existe token válido no banco
    const { data: auth } = await supabase
      .from('integrations')
      .select('*')
      .eq('provider', 'sicredi')
      .maybeSingle();

    if (auth?.access_token && new Date(auth.expires_at) > new Date()) {
      return new Response(JSON.stringify({ token: auth.access_token }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. Se não houver, gerar novo via mTLS
    const client = getSicrediHttpClient();
    const credentials = btoa(`${Deno.env.get("SICREDI_CLIENT_ID")}:${Deno.env.get("SICREDI_CLIENT_SECRET")}`);
    
    const response = await fetch(`${Deno.env.get("SICREDI_BASE_URL")}/oauth/token`, {
      method: "POST",
      client,
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        "grant_type": "client_credentials",
        "scope": "cob.read cob.write pix.read webhook.read webhook.write"
      })
    });

    const data = await response.json();
    const expiresAt = new Date(Date.now() + (data.expires_in * 1000));

    // 3. Salvar no banco para as outras funções
    await supabase.from('integrations').upsert({
      provider: 'sicredi',
      access_token: data.access_token,
      expires_at: expiresAt.toISOString()
    });

    return new Response(JSON.stringify({ token: data.access_token }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});