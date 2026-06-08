import {
    handleListProfessionals,
    handleListProfessionalHours,
    handleListMyAppointments,
    handleCancelAppointment,
    handleGetAvailableSlots,
    handleCreateAppointment
} from "./tools_agendamentos.ts";

export async function executeTool(
    functionName: string,
    args: any,
    supabase: any,
    phone: string,
    clientName: string
) {
    try {
        switch (functionName) {
            case "list_services":
                // No novo schema os serviços são implícitos ou fixos
                return "Atualmente oferecemos sessões de massoterapia padrão de 60 minutos.";
            case "list_professionals":
                return await handleListProfessionals(supabase);
            case "list_professional_hours":
                return await handleListProfessionalHours(supabase);
            case "list_my_appointments":
                return await handleListMyAppointments(supabase, phone);
            case "cancel_appointment":
                return await handleCancelAppointment(supabase, args.appointment_id);
            case "get_available_slots":
                return await handleGetAvailableSlots(supabase, args);
            case "create_appointment": {
                const result = await handleCreateAppointment(supabase, args, phone, clientName);
                if (result.includes("Sucesso")) {
                    try {
                        const { data: configRows } = await supabase.from("configuracoes").select("chave, valor").in("chave", ["wascript_token", "label_id_agendado", "label_id_novo_lead"]);
                        const config: Record<string, string> = {};
                        configRows?.forEach((row: any) => { config[row.chave] = row.valor; });

                        if (config.wascript_token) {
                            const actions = [];
                            if (config.label_id_agendado) actions.push({ labelId: config.label_id_agendado, type: 'add' });
                            if (config.label_id_novo_lead) actions.push({ labelId: config.label_id_novo_lead, type: 'remove' });

                            if (actions.length > 0) {
                                fetch(`https://api-whatsapp.wascript.com.br/api/modificar-etiquetas/${config.wascript_token}`, {
                                    method: 'POST',
                                    headers: { 'accept': 'application/json', 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ phone: [phone], actions })
                                }).catch(err => console.error("Erro async fetch etiqueta:", err));
                            }
                        }
                    } catch (e) {
                        console.error("❌ Erro ao processar etiquetas post-agendamento:", e);
                    }
                }
                return result;
            }
            default:
                return `Erro: Ferramenta ${functionName} não implementada.`;
        }
    } catch (e: any) {
        return `Erro ao executar ${functionName}: ${e.message}`;
    }
}