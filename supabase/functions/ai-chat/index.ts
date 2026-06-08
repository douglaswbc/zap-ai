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
    
    // Suporte para múltiplos formatos de payload (WAScript, Evolution, etc)
    const phone = body.phone || body.number || body.instance?.phone || body.data?.phone || body.chat?.user;
    const message = body.message || body.text || body.lastMessage?.text || body.eventDetails?.body || body.data?.message || body.message?.text?.body || body.text_added;
    const clientName = body.clientName || body.pushName || body.name || body.data?.clientName || "Cliente";

    if (!phone || !message) {
      return new Response(JSON.stringify({ error: "Parâmetros 'phone' e 'message' são obrigatórios." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (
      body.fromMe === true || 
      body.data?.fromMe === true || 
      body.eventDetails?.id?.fromMe === true ||
      body.message?.fromMe === true
    ) {
      console.log("⏭️ Mensagem enviada por mim (IA/Sistema). Ignorando para evitar loop.");
      return new Response(JSON.stringify({ message: "Ignorado" }), { status: 200, headers: corsHeaders });
    }

    const cleanPhone = phone.replace(/\D/g, "");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1. Carregar Configurações
    const { data: configRows } = await supabase.from("configuracoes").select("chave, valor");
    const config: Record<string, string> = {};
    configRows?.forEach(row => { config[row.chave] = row.valor; });

    if (config['is_ai_active'] === 'false') {
      console.log("🤖 IA desativada nas configurações.");
      return new Response(JSON.stringify({ message: "IA Desativada" }), { status: 200, headers: corsHeaders });
    }

    // 2. Status da Clínica
    const nowBR = getNowBR();
    const isOpen = checkBusinessHours(config);
    const businessContext = getBusinessContext(config, isOpen);
    const currentDateTimeStr = nowBR.toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' });

    const systemInstruction = `
Você é a assistente virtual da Clínica de Massoterapia Agend AI.
Sua missão é facilitar o agendamento de sessões de 60 minutos.

[REGRAS DE INTENÇÃO]
1. Se o usuário falar sobre assuntos que não possuem relação com a clínica, serviços ou agendamentos, responda estritamente com a palavra: [IGNORE]
2. Se o usuário apenas cumprimentar (Oi, Olá, Bom dia), seja cordial e pergunte como pode ajudar com o agendamento.
3. Se houver intenção de agendar, consultar horários, preços ou serviços, siga o fluxo normal.

[CONTEXTO DA CLÍNICA]
Temos 4 salas e 4 profissionais especializados.
${config['ai_prompt'] || 'Seja cordial e ajude o cliente a agendar.'}

${businessContext}
Data/Hora atual (Brasília): ${currentDateTimeStr}

[REGRAS DE DISPONIBILIDADE]
1. SEMPRE use a ferramenta 'get_available_slots' para checar o dia e horário solicitado.
2. A ferramenta retorna um JSON com horários e os nomes dos profissionais disponíveis.
3. Se o horário solicitado ESTIVER na lista retornada pela ferramenta, ele ESTÁ disponível. NUNCA diga que não há vaga se o horário constar no retorno da ferramenta.
4. Se o usuário pedir um profissional específico, verifique se o nome dele está na lista 'profissionais_disponiveis' daquele horário.
5. Se o horário não estiver disponível, sugira APENAS os horários que a ferramenta listou como disponíveis.
6. NUNCA invente horários ou dê respostas contraditórias (ex: dizer que não tem 18h e logo depois dizer que tem das 15h às 20h).

[REGRAS RÍGIDAS]:
1. NUNCA use Markdown (negrito com **, títulos com #). Use apenas texto simples.
2. Se o cliente perguntar o preço ou serviços, informe que temos massoterapia padrão de 60 minutos.
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

    if (finalTextAnswer && !finalTextAnswer.includes("[IGNORE]")) {
      // Opcional: Salvar no log
      try {
          await supabase.from("messages_log").insert([
              { phone: cleanPhone, role: 'user', content: message },
              { phone: cleanPhone, role: 'assistant', content: finalTextAnswer }
          ]);
      } catch { /* Tabela opcional */ }

      await sendWhatsAppMessage(cleanPhone, finalTextAnswer);

      // --- Lógica de Etiquetas (Novo Lead) ---
      try {
        if (config['wascript_token'] && config['label_id_novo_lead']) {
          // Só aplica a etiqueta se for a primeira mensagem (histórico vazio)
          if (historyMessages.length === 0) {
            console.log(`🏷️ Aplicando etiqueta de Novo Lead (${config['label_id_novo_lead']}) para ${cleanPhone}`);
            fetch(`https://api-whatsapp.wascript.com.br/api/modificar-etiquetas/${config['wascript_token']}`, {
              method: 'POST',
              headers: { 'accept': 'application/json', 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                phone: [cleanPhone], 
                actions: [{ labelId: config['label_id_novo_lead'], type: 'add' }] 
              })
            }).catch(err => console.error("Erro etiqueta lead:", err));
          }
        }
      } catch (e) {
        console.error("Erro ao processar etiqueta lead:", e);
      }
      // ----------------------------------------

    } else if (finalTextAnswer.includes("[IGNORE]")) {
      console.log("🤫 Mensagem ignorada por falta de intenção relacionada à clínica.");
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