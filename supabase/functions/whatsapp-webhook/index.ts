import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    
    // Extração de dados (Suporte multi-provedor)
    const phone = body.phone || body.number || body.instance?.phone || body.data?.phone || body.chat?.user || body.key?.remoteJid;
    const message = body.message || body.text || body.lastMessage?.text || body.eventDetails?.body || body.data?.message || body.message?.text?.body || body.text_added;
    const clientName = body.clientName || body.pushName || body.name || body.data?.clientName || "Cliente";

    if (!phone || !message) {
      return new Response(JSON.stringify({ error: "Parâmetros obrigatórios ausentes." }), { status: 400, headers: corsHeaders });
    }

    // Ignorar mensagens enviadas por mim
    if (body.fromMe === true || body.data?.fromMe === true || body.message?.fromMe === true) {
      return new Response(JSON.stringify({ message: "Ignorado (fromMe)" }), { status: 200, headers: corsHeaders });
    }

    const cleanPhone = phone.replace(/\D/g, "");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // --- Lógica de Debounce (Agrupamento de Mensagens) ---
    const DEBOUNCE_MS = 5000; // 5 segundos

    // 1. Adicionar à fila
    const { data: queue, error: queueErr } = await supabase.rpc('enqueue_ai_message', { 
        p_phone: cleanPhone, 
        p_message: message, 
        p_name: clientName 
    });

    if (queueErr) {
        console.error("❌ Erro ao enfileirar mensagem:", queueErr);
        // Fallback: Tenta processar direto se a RPC falhar
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-chat`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return new Response(JSON.stringify({ success: true, mode: 'fallback' }), { status: 200, headers: corsHeaders });
    }

    // 2. Aguarda o tempo de debounce
    setTimeout(async () => {
        // 3. Verifica se somos o último a atualizar a fila (ou se o tempo passou)
        const { data: currentQueue } = await supabase
            .from('ai_queue')
            .select('*')
            .eq('phone', cleanPhone)
            .single();

        if (currentQueue && !currentQueue.is_processing) {
            const lastUpdate = new Date(currentQueue.last_update).getTime();
            const now = Date.now();

            // Se passaram 5s desde a última mensagem, processa tudo
            if (now - lastUpdate >= DEBOUNCE_MS - 500) {
                // Marcar como processando para evitar duplicidade
                await supabase.from('ai_queue').update({ is_processing: true }).eq('phone', cleanPhone);

                const aggregatedMessage = currentQueue.messages.join("\n");
                
                console.log(`🚀 Processando ${currentQueue.messages.length} mensagens agrupadas para ${cleanPhone}`);

                await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-chat`, {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                        'Content-Type': 'application/json' 
                    },
                    body: JSON.stringify({
                        ...body,
                        message: aggregatedMessage,
                        phone: cleanPhone,
                        clientName: currentQueue.client_name
                    })
                });

                // Limpar fila
                await supabase.from('ai_queue').delete().eq('phone', cleanPhone);
            }
        }
    }, DEBOUNCE_MS);

    return new Response(JSON.stringify({ success: true, enqueued: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("❌ Erro no webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
