import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSicrediHttpClient, getSicrediToken } from "../_shared/sicredi.ts";

serve(async (req) => {
  const { invoiceId, amount, name, document } = await req.json();
  
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = await getSicrediToken(supabase);
  const client = getSicrediHttpClient();

  // Estrutura de cobrança conforme padrão Bacen/Sicredi [cite: 171, 204]
  const payload = {
    calendario: { expiracao: 3600 },
    devedor: { nome: name, cpf: document },
    valor: { original: amount.toFixed(2) },
    chave: Deno.env.get("SICREDI_CHAVE_PIX"),
    solicitacaoPagador: `Pagamento Fatura #${invoiceId}`
  };

  const res = await fetch(`${Deno.env.get("SICREDI_BASE_URL")}/api/v2/cob`, {
    method: "POST",
    client,
    headers: { 
        "Authorization": `Bearer ${token}`, 
        "Content-Type": "application/json" 
    },
    body: JSON.stringify(payload)
  });

  const pix = await res.json();
  return new Response(JSON.stringify(pix), { headers: { "Content-Type": "application/json" } });
});