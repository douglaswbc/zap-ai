import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { OpenAI } from "https://esm.sh/openai@4";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendWhatsAppMessage, corsHeaders, getNowBR, getBusinessContext, checkBusinessHours } from "./helpers.ts";
import { tools } from "./tools_definitions.ts";
import { executeTool } from "./tools_execute.ts";

const openAiApiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
const openai = new OpenAI({ apiKey: openAiApiKey });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    
    const phone = body.phone || body.instance?.phone || body.data?.phone || body.chat?.user;
    const message = body.message || body.text || body.data?.message || body.message?.text?.body || body.text_added;
    const clientName = body.clientName || body.pushName || body.data?.clientName || "Cliente";

    if (!phone || !message) {
      return new Response(JSON.stringify({ error: "Parâmetros 'phone' e 'message' são obrigatórios." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.fromMe === true || body.data?.fromMe === true) {
      return new Response(JSON.stringify({ message: "Ignorado" }), { status: 200, headers: corsHeaders });
    }

    const cleanPhone = phone.replace(/\D/g, "");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1. Carregar Configurações
    const { data: configRows } = await supabase.from("configuracoes").select("chave, valor");
    const config: Record<string, string> = {};
    configRows?.forEach(row => { config[row.chave] = row.valor; });

    // 2. Status da Clínica
    const nowBR = getNowBR();
    const isOpen = checkBusinessHours(config);
    const businessContext = getBusinessContext(config, isOpen);
    const currentDateTimeStr = nowBR.toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' });

    const systemInstruction = `
Você é a assistente virtual da Clínica de Massoterapia.
Seu objetivo é agendar sessões de 60 minutos.
Temos 4 salas e 4 profissionais.

${config['ai_prompt'] || 'Seja cordial e ajude o cliente a agendar.'}

${businessContext}
Data/Hora atual (Brasília): ${currentDateTimeStr}

[REGRAS RÍGIDAS]:
1. NUNCA use Markdown (negrito com **, títulos com #). Use apenas texto simples.
2. SEMPRE use as ferramentas para checar disponibilidade antes de confirmar.
3. Se o cliente perguntar o preço ou serviços, informe que temos massoterapia padrão de 60 minutos (consulte o gerente para valores se não souber).
`;

    // 3. OpenAI Loop (Sem histórico persistente em tabela 'messages' por enquanto para simplificar, ou mantemos se existir)
    // Vamos tentar buscar mensagens se a tabela existir, senão seguimos sem.
    let historyMessages: any[] = [];
    try {
        const { data: hist } = await supabase.from("messages_log").select("role, content").eq("phone", cleanPhone).order("created_at", { ascending: false }).limit(6);
        if (hist) historyMessages = hist.reverse();
    } catch { /* Tabela opcional */ }

    let msgs: any[] = [
      { role: "system", content: systemInstruction },
      ...historyMessages,
      { role: "user", content: `Cliente: ${clientName}\nMensagem: ${message}` }
    ];

    let response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: msgs,
      tools: tools,
      tool_choice: "auto"
    });

    let finalTextAnswer = response.choices[0].message.content || "";

    while (response.choices?.[0]?.message?.tool_calls) {
      const toolCalls = response.choices[0].message.tool_calls;
      msgs.push(response.choices[0].message);

      for (const toolCall of toolCalls) {
        const result = await executeTool(toolCall.function.name, JSON.parse(toolCall.function.arguments), supabase, cleanPhone, clientName);
        msgs.push({ tool_call_id: toolCall.id, role: "tool", name: toolCall.function.name, content: result });
      }
      
      response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: msgs,
        tools: tools
      });
      
      finalTextAnswer = response.choices[0].message.content || "";
    }

    if (finalTextAnswer) {
      // Opcional: Salvar no log
      try {
          await supabase.from("messages_log").insert([
              { phone: cleanPhone, role: 'user', content: message },
              { phone: cleanPhone, role: 'assistant', content: finalTextAnswer }
          ]);
      } catch { /* Tabela opcional */ }

      await sendWhatsAppMessage(cleanPhone, finalTextAnswer);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("❌ Erro:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});