import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

import {
  corsHeaders,
  getNowBR,
  checkBusinessHours,
  getBusinessContext
} from "./helpers.ts";
import { tools } from "./tools_definitions.ts";
import { executeTool } from "./tools_execute.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  console.log("--- AI-CHAT START ---");

  try {
    const payload = await req.json();
    const { conversation_id, instance_id, phone, text_added } = payload;
    console.log(`[Request]: ConvID=${conversation_id}, InstID=${instance_id}, Phone=${phone}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Debounce Logic
    const executionId = new Date().getTime();
    const { data: conversation } = await supabase.from("conversations").select("temp_buffer, contact_id").eq("id", conversation_id).single();
    const updatedBuffer = ((conversation?.temp_buffer || "") + " " + (text_added || "")).trim();

    await supabase.from("conversations").update({ temp_buffer: updatedBuffer, last_message_at: new Date(executionId).toISOString() }).eq("id", conversation_id);
    await new Promise(res => setTimeout(res, 10000));

    const { data: finalCheck } = await supabase.from("conversations").select("temp_buffer, last_message_at, is_human_active").eq("id", conversation_id).single();
    if (finalCheck.is_human_active || new Date(finalCheck.last_message_at).getTime() > executionId) {
      console.log("[Debounce]: Skipped");
      return new Response("Skipped");
    }

    const textToProcess = finalCheck.temp_buffer;
    console.log(`[Process]: Text: "${textToProcess}"`);
    await supabase.from("conversations").update({ temp_buffer: "" }).eq("id", conversation_id);

    // 2. Context & Business Rules
    const { data: inst } = await supabase.from("instances").select("name, token, company_id, agent_id").eq("id", instance_id).single();
    const { data: agent } = await supabase.from("agents").select("prompt, knowledge_base, temperature").eq("id", inst.agent_id).single();
    const { data: settings } = await supabase.from("settings").select("*").eq("company_id", inst.company_id).maybeSingle();

    const nowBR = getNowBR();
    const isOpen = checkBusinessHours(settings);
    const workingDays = settings?.working_days || ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
    const businessContext = getBusinessContext(settings, isOpen, workingDays);

    // 3. OpenAI Loop
    const { data: history } = await supabase.from("messages").select("sender, content").eq("conversation_id", conversation_id).order("timestamp", { ascending: false }).limit(10);
    const currentDateTimeStr = nowBR.toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' });

    const historyMessages = (history || []).reverse().map(m => ({
      role: m.sender === "USER" ? "user" : "assistant",
      content: m.content
    }));

    const systemContent = (agent?.prompt || "") +
      (agent?.knowledge_base ? `\n\n[BASE DE CONHECIMENTO]\n${agent.knowledge_base}` : "") +
      "\n" + businessContext +
      `\nData/Hora atual (Brasília): ${currentDateTimeStr}` +
      `\n\n[INSTRUÇÕES CRÍTICAS DE FORMATAÇÃO - NUNCA USE MARKDOWN]:
1. PROIBIDO o uso de caracteres de Markdown como "#", "##", "###" (títulos).
2. PROIBIDO o uso de negrito com dois asteriscos (ex: **texto**). 
3. Se precisar dar ênfase, use apenas CAIXA ALTA ou coloque entre aspas. NUNCA use asteriscos.
4. Use hifens (-) ou números simples (1., 2.) para listas.
5. Suas respostas devem ser texto puro, limpo e amigável, pronto para leitura instantânea no WhatsApp.
6. Nunca comece frases com símbolos ou use formatação de código (\`\`\`).

[OUTRAS INSTRUÇÕES]:
1. SEMPRE use os IDs (UUIDs) para chamar as ferramentas de agendamento e pagamento. Nunca use nomes de serviços ou profissionais nessas chamadas.
2. ANTES de criar um novo agendamento, SEMPRE use 'list_my_appointments' para verificar se o usuário já possui agendamentos desde hoje para o futuro. Se houver agendamentos vindouros, informe o usuário e pergunte se ele deseja REAGENDAR (cancelar o atual e criar um novo) ou CANCELAR.
3. Se o usuário quiser cancelar, use a ferramenta 'cancel_appointment'. O sistema automaticamente removerá do calendário Google dele.
4. Identifique claramente o ID_DO_AGENDAMENTO e o TXID nas suas respostas quando gerá-los.
5. Quando agendar ou cancelar, informe ao usuário que o calendário dele será atualizado automaticamente.
6. Se o usuário enviar uma imagem ou PDF, o sistema tentará analisar e você receberá uma message como [Imagem]: [Descrição]. Se for um comprovante de pagamento, use a ferramenta 'check_payment_status' para verificar no banco de dados se o pagamento já caiu.`;

    let msgs: any[] = [
      { role: "system", content: systemContent },
      ...historyMessages,
      { role: "user", content: textToProcess }
    ];

    const callOpenAI = async (messagesArr: any, toolList: any) => {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${Deno.env.get("OPENAI_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4o-mini", messages: messagesArr, tools: toolList, temperature: agent?.temperature || 0.7 })
      });
      return await res.json();
    };

    let response = await callOpenAI(msgs, tools);

    while (response.choices?.[0]?.message?.tool_calls) {
      const toolCalls = response.choices[0].message.tool_calls;
      msgs.push(response.choices[0].message);

      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);
        const result = await executeTool(functionName, args, supabase, inst, conversation);
        msgs.push({ tool_call_id: toolCall.id, role: "tool", name: functionName, content: result });
      }
      response = await callOpenAI(msgs, tools);
    }

    const reply = response.choices?.[0]?.message?.content;

    if (reply) {
      await fetch(`${Deno.env.get("EVO_API_URL")}/message/sendText/${inst.name}`, {
        method: "POST",
        headers: { "apikey": inst.token, "Content-Type": "application/json" },
        body: JSON.stringify({ number: phone, text: reply })
      });
      await supabase.from("messages").insert({ conversation_id, sender: "AI", content: reply });
      await supabase.from("conversations").update({ last_message: reply.substring(0, 100), last_timestamp: new Date().toISOString() }).eq("id", conversation_id);
    }

    console.log("--- SUCCESS ---");
    return new Response("OK");
  } catch (error) {
    console.error("ERRO:", error.message);
    return new Response(error.message, { status: 500 });
  }
});
