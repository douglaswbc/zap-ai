import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSicrediHttpClient, getSicrediToken } from "shared/sicredi.ts";

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Obter Token com escopo de escrita de webhook
    const token = await getSicrediToken(supabase);
    const client = getSicrediHttpClient();

    const pixKey = Deno.env.get("SICREDI_CHAVE_PIX")!;
    // Esta é a URL da sua função de callback que você já deu deploy
    const webhookUrl = "https://phwtrehpuyhwqtthtuyf.supabase.co/functions/v1/sicredi-pix-callback";

    console.log(`Configurando Webhook para a chave: ${pixKey}`);

    // 2. Requisição PUT conforme o manual 
    const response = await fetch(`${Deno.env.get("SICREDI_BASE_URL")}/api/v2/webhook/${pixKey}`, {
      method: "PUT",
      client, // mTLS obrigatório [cite: 132]
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        webhookUrl: webhookUrl
      })
    });

    const result = await response.text();
    
    return new Response(JSON.stringify({ 
      status: response.status, 
      message: "Configuração enviada",
      detail: result 
    }), { 
      headers: { "Content-Type": "application/json" } 
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});