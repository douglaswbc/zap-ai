import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // 2. Context
    const { data: inst } = await supabase.from("instances").select("name, token, company_id, agent_id").eq("id", instance_id).single();
    const { data: agent } = await supabase.from("agents").select("prompt, temperature").eq("id", inst.agent_id).single();
    const { data: settings } = await supabase.from("settings").select("*").eq("company_id", inst.company_id).maybeSingle();

    const businessContext = `
[CONTEXTO EMPRESA]
- Horário: ${settings?.business_hours_start} às ${settings?.business_hours_end}
- Dias: ${settings?.working_days?.join(', ')}
- Info: ${settings?.informacoes || ''}
- Endereço: ${settings?.address || ''}
- Website: ${settings?.website || ''}
    `;

    // 3. Tools Definitions
    const tools = [
      {
        type: "function",
        function: {
          name: "list_services",
          description: "Lista todos os serviços e preços da empresa.",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "list_professionals",
          description: "Lista os profissionais disponíveis.",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "get_available_slots",
          description: "Busca horários disponíveis para um profissional em uma data.",
          parameters: {
            type: "object",
            properties: {
              professional_id: { type: "string" },
              service_id: { type: "string" },
              date: { type: "string", description: "Formato YYYY-MM-DD" }
            },
            required: ["professional_id", "service_id", "date"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "create_appointment",
          description: "Realiza o agendamento de um serviço.",
          parameters: {
            type: "object",
            properties: {
              service_id: { type: "string" },
              professional_id: { type: "string" },
              date: { type: "string" },
              time: { type: "string", description: "Formato HH:mm" }
            },
            required: ["service_id", "professional_id", "date", "time"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "generate_payment",
          description: "Gera um código PIX para pagamento de um agendamento.",
          parameters: {
            type: "object",
            properties: {
              appointment_id: { type: "string" }
            },
            required: ["appointment_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "check_payment_status",
          description: "Verifica se o pagamento de um agendamento foi confirmado.",
          parameters: {
            type: "object",
            properties: {
              appointment_id: { type: "string" }
            },
            required: ["appointment_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "list_my_appointments",
          description: "Consulta os agendamentos realizados pelo usuário atual.",
          parameters: { type: "object", properties: {} }
        }
      }
    ];

    // 4. OpenAI Loop
    const { data: history } = await supabase.from("messages").select("sender, content").eq("conversation_id", conversation_id).order("timestamp", { ascending: false }).limit(10);

    // Configura fuso horário de Brasília
    const nowBR = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const currentDateTimeStr = nowBR.toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' });

    let messages = [
      {
        role: "system", content: (agent?.prompt || "") + "\n" + businessContext + `\nData/Hora atual (Brasília): ${currentDateTimeStr}` + `\n\nINSTRUÇÕES IMPORTANTES:
1. Se precisar do ID de um agendamento para gerar pagamento ou verificar status, use a ferramenta 'list_my_appointments' primeiro para encontrar os agendamentos do usuário. NÃO peça o ID ao usuário se você puder encontrá-lo.
2. Identifique claramente o ID_DO_AGENDAMENTO e o TXID nas suas respostas quando gerá-los.
3. Se o usuário enviar uma imagem ou PDF, o sistema tentará analisar e você receberá uma mensagem como [Imagem]: [Descrição]. Se for um comprovante de pagamento, use a ferramenta 'check_payment_status' para verificar no banco de dados se o pagamento já caiu.` },
      ...(history?.reverse().map(m => ({ role: m.sender === "USER" ? "user" : "assistant", content: m.content })) || []),
      { role: "user", content: textToProcess }
    ];

    const callOpenAI = async (msgs: any, toolList: any) => {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${Deno.env.get("OPENAI_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4o-mini", messages: msgs, tools: toolList, temperature: agent?.temperature || 0.7 })
      });
      return await res.json();
    };

    let response = await callOpenAI(messages, tools);

    while (response.choices?.[0]?.message?.tool_calls) {
      const toolCalls = response.choices[0].message.tool_calls;
      messages.push(response.choices[0].message);

      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);
        let result = "";

        try {
          if (functionName === "list_services") {
            const { data } = await supabase.from("services").select("id, name, price, duration_minutes").eq("company_id", inst.company_id);
            result = JSON.stringify(data);
          }
          else if (functionName === "list_professionals") {
            const { data } = await supabase.from("professionals").select("id, name, role").eq("company_id", inst.company_id);
            result = JSON.stringify(data);
          }
          else if (functionName === "list_my_appointments") {
            const { data, error } = await supabase
              .from("appointments")
              .select(`
                id,
                appointment_date,
                appointment_time,
                status,
                services(name, price),
                professionals(name)
              `)
              .eq("contact_id", conversation.contact_id)
              .order("appointment_date", { ascending: false })
              .limit(5);

            if (error) result = `Erro ao buscar agendamentos: ${error.message}`;
            else if (!data || data.length === 0) result = "Nenhum agendamento encontrado para este usuário.";
            else {
              result = "Agendamentos encontrados:\n" + data.map(a =>
                `- ID: ${a.id} | Serviço: ${a.services.name} | Profissional: ${a.professionals.name} | Data: ${a.appointment_date} | Hora: ${a.appointment_time} | Status: ${a.status}`
              ).join("\n");
            }
          }
          else if (functionName === "get_available_slots") {
            const { professional_id, service_id, date } = args;
            const { data: service } = await supabase.from('services').select('duration_minutes').eq('id', service_id).single();
            const { data: prof } = await supabase.from('professionals').select('start_time, end_time').eq('id', professional_id).single();
            const { data: existing } = await supabase.from('appointments').select('appointment_time').eq('professional_id', professional_id).eq('appointment_date', date).not('status', 'eq', 'CANCELLED');

            if (!service || !prof) result = "Erro: Profissional ou serviço não encontrado.";
            else {
              const occupied = existing?.map(a => a.appointment_time.substring(0, 5)) || [];
              const slots = [];

              // Ajusta para o fuso de Brasília para comparar se o horário já passou
              const nowBR = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
              const todayStr = nowBR.toISOString().split('T')[0];

              let curr = new Date(`${date}T${prof.start_time}`);
              const end = new Date(`${date}T${prof.end_time}`);

              while (curr < end) {
                const hourMinute = curr.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });

                // Se for hoje, filtra horários que já passaram
                let isPast = false;
                if (date === todayStr) {
                  const [slotH, slotM] = hourMinute.split(':').map(Number);
                  const nowH = nowBR.getHours();
                  const nowM = nowBR.getMinutes();
                  if (slotH < nowH || (slotH === nowH && slotM <= nowM)) {
                    isPast = true;
                  }
                }

                if (!occupied.includes(hourMinute) && !isPast) {
                  slots.push(hourMinute);
                }
                curr.setMinutes(curr.getMinutes() + service.duration_minutes);
              }
              result = slots.length > 0 ? JSON.stringify(slots) : "Nenhum horário disponível para esta data.";
            }
          }
          else if (functionName === "create_appointment") {
            const { data, error } = await supabase.from("appointments").insert({
              contact_id: conversation.contact_id,
              service_id: args.service_id,
              professional_id: args.professional_id,
              appointment_date: args.date,
              appointment_time: args.time,
              company_id: inst.company_id,
              status: 'PENDING'
            }).select().single();
            result = error ? `Erro: ${error.message}` : `Sucesso! Agendamento criado. ID_DO_AGENDAMENTO: ${data.id}. Peça ao usuário se ele deseja gerar o pagamento PIX agora.`;
          }
          else if (functionName === "generate_payment") {
            const urlGerar = Deno.env.get("VITE_WEBHOOK_URL_GERAR_FATURA");
            if (!urlGerar) result = "Erro: URL de faturamento não configurada.";
            else {
              const { data: apt } = await supabase.from('appointments').select('*, contacts(name, cpf), services(price)').eq('id', args.appointment_id).single();
              if (!apt) result = "Agendamento não encontrado.";
              else {
                const res = await fetch(urlGerar, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ appointment_id: apt.id, contact_id: apt.contact_id, valor: apt.services.price, nome_cliente: apt.contacts.name, cpf: apt.contacts.cpf })
                });
                const resJson = await res.json();
                console.log(`[Tools]: Webhook Raw Response:`, JSON.stringify(resJson));

                // Extração robusta do objeto PIX
                let pix = Array.isArray(resJson) ? resJson[0] : resJson;
                if (pix && pix.response) pix = pix.response; // Se estiver aninhado em 'response'

                if (pix && pix.txid) {
                  let { data: invoice } = await supabase.from('invoices').select('id').eq('appointment_id', apt.id).maybeSingle();
                  if (!invoice) {
                    const { data: newInv } = await supabase.from('invoices').insert({
                      appointment_id: apt.id,
                      contact_id: apt.contact_id,
                      company_id: inst.company_id,
                      valor: pix.valor_original || apt.services.price,
                      status_fatura: 'Aberta'
                    }).select().single();
                    invoice = newInv;
                  }

                  if (invoice) {
                    await supabase.from('pix_charges').upsert({
                      invoice_id: invoice.id,
                      txid: pix.txid,
                      qrcode_copia_cola: pix.pixCopiaECola,
                      valor_original: pix.valor_original,
                      data_expiracao: pix.dataExpiracao,
                      status_sicredi: 'PENDENTE'
                    }, { onConflict: 'txid' });

                    result = `PIX Gerado com sucesso!\nID_DO_AGENDAMENTO: ${apt.id}\nTXID: ${pix.txid}\nCopia e Cola: ${pix.pixCopiaECola}\nValor: R$ ${pix.valor_original}\n\nEnvie o código Copia e Cola ao usuário agora.`;
                  } else {
                    result = "Erro ao garantir fatura.";
                  }
                } else {
                  result = "Erro: Dados do PIX não encontrados no retorno do webhook.";
                }
              }
            }
          }
          else if (functionName === "check_payment_status") {
            const urlCheck = Deno.env.get("VITE_WEBHOOK_URL_CHECK_PAGAMENTO");
            if (!urlCheck) result = "Erro: URL de verificação não configurada.";
            else {
              const { data: aptData } = await supabase
                .from('appointments')
                .select(`
                  id,
                  invoices (
                    id,
                    pix_charges (
                      txid
                    )
                  )
                `)
                .eq('id', args.appointment_id)
                .maybeSingle();

              if (!aptData) {
                result = `Erro: Agendamento ${args.appointment_id} não encontrado. Solicite o ID correto ao usuário.`;
              } else {
                // Tenta pegar o txid da primeira fatura e primeira carga pix encontrada
                const txid = aptData.invoices?.[0]?.pix_charges?.[0]?.txid || null;

                const res = await fetch(urlCheck, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    appointment_id: aptData.id,
                    txid: txid
                  })
                });
                const resJson = await res.json();

                // Busca status de várias formas possíveis no JSON
                let statusRaw = "";
                if (Array.isArray(resJson)) {
                  statusRaw = resJson[0]?.response?.status || resJson[0]?.status || "";
                } else {
                  statusRaw = resJson?.response?.status || resJson?.status || "";
                }

                // Limpeza robusta da string de status (remove espaços, chaves e converte para maiúsculo)
                const statusClean = statusRaw.toString().replace(/[^a-zA-Z]/g, '').toUpperCase();
                console.log(`[Tools]: Status detectado: ${statusClean} (Original: ${statusRaw})`);

                if (statusClean === "CONCLUIDA" || statusClean === "PAGO") {
                  console.log(`[Tools]: Pagamento confirmado! Agendamento: ${aptData.id}`);

                  // 1. Atualiza Agendamento
                  const { error: e3 } = await supabase.from('appointments').update({ status: 'CONFIRMED' }).eq('id', aptData.id);
                  if (e3) console.error(`[Tools]: Erro appointments:`, e3);

                  // 2. Atualiza TODAS as faturas vinculadas a este agendamento (Bulk por appointment_id)
                  const { data: updatedInvoices, error: eInv } = await supabase
                    .from('invoices')
                    .update({ status_fatura: 'Paga' })
                    .eq('appointment_id', aptData.id)
                    .select('id');

                  if (eInv) console.error(`[Tools]: Erro invoices bulk:`, eInv);

                  // 3. Atualiza TODAS as cargas PIX destas faturas
                  const invIds = updatedInvoices?.map(i => i.id) || [];
                  if (invIds.length > 0) {
                    const { error: ePix } = await supabase
                      .from('pix_charges')
                      .update({ status_sicredi: 'CONCLUIDA' })
                      .in('invoice_id', invIds);
                    if (ePix) console.error(`[Tools]: Erro pix_charges bulk:`, ePix);
                  }

                  // 4. Fallback por TXID
                  const realTxid = txid || aptData.invoices?.[0]?.pix_charges?.[0]?.txid;
                  if (realTxid) {
                    await supabase.from('pix_charges').update({ status_sicredi: 'CONCLUIDA' }).eq('txid', realTxid);
                  }

                  result = `Status do pagamento para o agendamento ${aptData.id}: CONCLUÍDA. O agendamento e o financeiro foram atualizados com sucesso.`;
                } else {
                  console.log(`[Tools]: Pagamento ainda pendente: ${statusClean}`);
                  result = `Status do pagamento para o agendamento ${aptData.id} (TXID: ${txid || 'Não encontrado'}): ${statusRaw || 'Pendente'}`;
                }
              }
            }
          }
        } catch (e) {
          result = `Erro: ${e.message}`;
        }

        messages.push({ tool_call_id: toolCall.id, role: "tool", name: functionName, content: result });
      }
      response = await callOpenAI(messages, tools);
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
