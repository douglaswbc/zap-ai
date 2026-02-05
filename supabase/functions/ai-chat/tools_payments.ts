import { triggerGoogleSync } from "./helpers.ts";

export async function handleGeneratePayment(supabase: any, args: any, companyId: string) {
    const urlGerar = Deno.env.get("VITE_WEBHOOK_URL_GERAR_FATURA");
    if (!urlGerar) return "Erro: URL de faturamento não configurada.";

    const { data: apt } = await supabase.from('appointments').select('*, contacts(name, cpf), services(price)').eq('id', args.appointment_id).single();
    if (!apt) return "Agendamento não encontrado.";

    const res = await fetch(urlGerar, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_id: apt.id, contact_id: apt.contact_id, valor: apt.services.price, nome_cliente: apt.contacts.name, cpf: apt.contacts.cpf })
    });
    const resJson = await res.json();
    let pix = Array.isArray(resJson) ? resJson[0] : resJson;
    if (pix && pix.response) pix = pix.response;

    if (pix && (pix.txid || pix.pixCopiaECola)) {
        let { data: invoice } = await supabase.from('invoices').select('id').eq('appointment_id', apt.id).maybeSingle();
        if (!invoice) {
            const { data: newInv } = await supabase.from('invoices').insert({
                appointment_id: apt.id,
                contact_id: apt.contact_id,
                company_id: companyId,
                valor: pix.valor_original || apt.services.price,
                status_fatura: 'Aberta'
            }).select().single();
            invoice = newInv;
        }

        if (invoice) {
            let cleanPixCode = pix.pixCopiaECola || "";
            if (cleanPixCode.startsWith("https://")) cleanPixCode = cleanPixCode.replace(/^https?:\/\//i, "");

            await supabase.from('pix_charges').upsert({
                invoice_id: invoice.id,
                txid: pix.txid || `temp_${Date.now()}`,
                qrcode_copia_cola: cleanPixCode,
                valor_original: pix.valor_original || apt.services.price,
                data_expiracao: pix.data_expiracao,
                status_sicredi: 'PENDENTE'
            }, { onConflict: 'txid' });

            return `PIX Gerado com sucesso!\nID_DO_AGENDAMENTO: ${apt.id}\nTXID: ${pix.txid || 'N/A'}\nCopia e Cola: ${cleanPixCode}\nValor: R$ ${pix.valor_original || apt.services.price}\n\nEnvie o código Copia e Cola ao usuário agora.`;
        }
    }
    return "Erro ao gerar PIX.";
}

export async function handleCheckPaymentStatus(supabase: any, args: any) {
    const urlCheck = Deno.env.get("VITE_WEBHOOK_URL_CHECK_PAGAMENTO");
    if (!urlCheck) return "Erro: URL de verificação não configurada.";

    const { data: aptData } = await supabase.from('appointments').select(`id, invoices (id, pix_charges (txid))`).eq('id', args.appointment_id).maybeSingle();
    if (!aptData) return `Erro: Agendamento ${args.appointment_id} não encontrado.`;

    const txid = aptData.invoices?.[0]?.pix_charges?.[0]?.txid || null;
    const res = await fetch(urlCheck, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_id: aptData.id, txid })
    });
    const resJson = await res.json();
    let statusRaw = Array.isArray(resJson) ? (resJson[0]?.response?.status || resJson[0]?.status || "") : (resJson?.response?.status || resJson?.status || "");
    const statusClean = statusRaw.toString().replace(/[^a-zA-Z]/g, '').toUpperCase();

    if (statusClean === "CONCLUIDA" || statusClean === "PAGO") {
        await supabase.from('appointments').update({ status: 'CONFIRMED' }).eq('id', aptData.id);
        const { data: updatedInvoices } = await supabase.from('invoices').update({ status_fatura: 'Paga' }).eq('appointment_id', aptData.id).select('id');
        const invIds = updatedInvoices?.map((i: any) => i.id) || [];
        if (invIds.length > 0) await supabase.from('pix_charges').update({ status_sicredi: 'CONCLUIDA' }).in('invoice_id', invIds);
        if (txid) await supabase.from('pix_charges').update({ status_sicredi: 'CONCLUIDA' }).eq('txid', txid);
        await triggerGoogleSync(aptData.id);
        return `Status do pagamento para o agendamento ${aptData.id}: CONCLUÍDA. O agendamento foi confirmado.`;
    }
    return `Status do pagamento para o agendamento ${aptData.id}: ${statusRaw || 'Pendente'}`;
}
