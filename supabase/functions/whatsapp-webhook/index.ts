import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const payload = await req.json();
    const instanceName = payload.instance;
    const data = payload.data;

    // 1. Handle Status Updates
    if (["connection.update", "instance.update"].includes(payload.event)) {
      const state = data?.state || data?.status || (payload.event === "instance.update" ? data?.instance?.status : null);
      if (state) {
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await supabase.from("instances").update({ connection_status: state.toLowerCase() }).eq("name", instanceName);
        console.log(`[Status]: Instance ${instanceName} updated to ${state}`);
      }
      return new Response("Status atualizado");
    }

    if (payload.event !== "messages.upsert" || !data) return new Response("Ignorado");

    const message = data.message;
    const messageId = data.key?.id;
    const isFromMe = data.key?.fromMe === true;
    const remoteJid = data.key?.remoteJid || "";
    const phone = remoteJid.split("@")[0];
    const pushName = data.pushName || phone;

    if (remoteJid.includes("@g.us")) return new Response("Grupo ignorado");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Busca Instância e Agente vinculado
    const { data: inst, error: instError } = await supabase
      .from("instances")
      .select(`
        id, 
        company_id, 
        token,
        agents (
          enable_audio, 
          enable_image
        )
      `)
      .eq("name", instanceName)
      .single();

    if (instError || !inst) return new Response("Instância não encontrada", { status: 404 });

    // 2. Garantir Contacto e Conversa
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .upsert({
        phone: phone,
        name: pushName,
        company_id: inst.company_id
      }, { onConflict: 'phone, company_id' })
      .select()
      .single();

    if (contactError) throw contactError;

    const { data: conv, error: convError } = await supabase
      .from("conversations")
      .upsert({
        contact_id: contact.id,
        instance_id: inst.id,
      }, { onConflict: 'contact_id' })
      .select()
      .single();

    if (convError) throw convError;

    // 3. Processar Conteúdo da Mensagem
    let userMessage = "";
    if (message?.conversation) userMessage = message.conversation;
    else if (message?.extendedTextMessage?.text) userMessage = message.extendedTextMessage.text;
    else if (message?.audioMessage && inst.agents?.enable_audio) {
      const base64 = await getMediaBase64(instanceName, inst.token, messageId);
      if (base64) userMessage = await transcribeAudio(base64);
    } else if (message?.imageMessage && inst.agents?.enable_image) {
      console.log(`[Media]: Processando imagem...`);
      const base64 = await getMediaBase64(instanceName, inst.token, messageId);
      if (base64) userMessage = `[Imagem]: ${await analyzeImage(base64)}`;
      else console.error(`[Media]: Falha ao obter base64 da imagem.`);
    } else if (message?.documentMessage && message.documentMessage.mimetype === "application/pdf") {
      const fileName = message.documentMessage.fileName || "documento.pdf";
      console.log(`[Media]: Documento PDF recebido: ${fileName}`);
      // Tenta obter base64 para o baco (opcional, por ora apenas marcamos)
      userMessage = `[Arquivo PDF: ${fileName}]: O usuário enviou um comprovante ou documento em PDF. IA, se o usuário disser que é um comprovante, use a ferramenta de checagem de pagamento para confirmar.`;
    }

    if (!userMessage && !isFromMe) return new Response("Sem conteúdo processável");

    // 4. Salvar Mensagem no DB
    const { error: msgError } = await supabase.from("messages").insert({
      conversation_id: conv.id,
      sender: isFromMe ? "OPERATOR" : "USER",
      content: userMessage || "(Mídia)"
    });

    if (msgError) throw msgError;

    await supabase.from("conversations").update({
      last_message: userMessage ? userMessage.substring(0, 100) : "(Mídia)",
      last_timestamp: new Date().toISOString(),
      unread_count: isFromMe ? 0 : (conv.unread_count || 0) + 1
    }).eq("id", conv.id);

    // 5. Disparar ai-chat
    if (!isFromMe && !conv.is_human_active) {
      supabase.functions.invoke('ai-chat', {
        body: {
          conversation_id: conv.id,
          instance_id: inst.id,
          phone: phone,
          text_added: userMessage
        }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("Erro no webhook:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

async function getMediaBase64(instance: string, token: string, messageId: string) {
  try {
    const rawUrl = Deno.env.get("EVO_API_URL");
    const baseUrl = rawUrl?.replace(/\/+$/, "");
    console.log(`[Media]: Solicitando base64 para Instance=${instance}, MsgID=${messageId}. URL=${baseUrl}/chat/getBase64FromMediaMessage/${instance}`);

    const res = await fetch(`${baseUrl}/chat/getBase64FromMediaMessage/${instance}`, {
      method: 'POST',
      headers: { 'apikey': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          key: {
            id: messageId
          }
        },
        convertToMp4: false
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Media]: Erro HTTP ${res.status} na API Evolution: ${errText}`);
      return null;
    }

    const json = await res.json();
    if (!json.base64) console.warn(`[Media]: JSON retornado sem base64:`, JSON.stringify(json).substring(0, 100));
    return json.base64 || null;
  } catch (e) {
    console.error(`[Media]: Exceção fatal getBase64:`, e);
    return null;
  }
}

async function transcribeAudio(base64: string) {
  try {
    const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const formData = new FormData();
    formData.append("file", new Blob([binary], { type: "audio/ogg" }), "audio.ogg");
    formData.append("model", "whisper-1");
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${Deno.env.get("OPENAI_KEY")}` },
      body: formData
    }).then(r => r.json());
    return res.text || "(Áudio vazio)";
  } catch { return "(Erro na transcrição)"; }
}

async function analyzeImage(base64: string) {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${Deno.env.get("OPENAI_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Você é um assistente de atendimento. Esta imagem foi enviada pelo usuário. Se for um comprovante de pagamento, extraia os dados principais (valor, data, pagador, recebedor). Se não for, descreva brevemente o que é." },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } }
          ]
        }],
        max_tokens: 500
      })
    }).then(r => r.json());
    console.log(`[Media]: Resultado análise imagem:`, res.choices?.[0]?.message?.content?.substring(0, 50) + "...");
    return res.choices?.[0]?.message?.content || "(Sem descrição)";
  } catch { return "(Erro na análise da imagem)"; }
}
