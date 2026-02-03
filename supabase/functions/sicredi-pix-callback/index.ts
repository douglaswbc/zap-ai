import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSicrediHttpClient, getSicrediToken } from "../_shared/sicredi.ts";

serve(async (req) => {
  const body = await req.json();
  const txid = body.pix?.[0]?.txid; // O Sicredi envia um array de pix recebidos

  if (!txid) return new Response("TXID not found", { status: 400 });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = await getSicrediToken(supabase);
  const client = getSicrediHttpClient();

  // Validação de segurança: Consulta o status real no Sicredi [cite: 32, 1104]
  const verify = await fetch(`${Deno.env.get("SICREDI_BASE_URL")}/api/v2/cob/${txid}`, {
    client,
    headers: { "Authorization": `Bearer ${token}` }
  });
  
  const statusData = await verify.json();

  if (statusData.status === "CONCLUIDA") {
    // 1. Localiza a cobrança no banco
    const { data: charge } = await supabase.from("pix_charges").select("invoice_id").eq("txid", txid).single();

    if (charge) {
      // 2. Atualiza Fatura e Agendamento
      await supabase.from("invoices").update({ status_fatura: "Paga" }).eq("id", charge.invoice_id);
      
      const { data: inv } = await supabase.from("invoices").select("appointment_id").eq("id", charge.invoice_id).single();
      if (inv?.appointment_id) {
        await supabase.from("appointments").update({ status: "CONFIRMED" }).eq("id", inv.appointment_id);
      }
    }
  }

  return new Response("OK");
});