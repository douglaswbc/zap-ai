import {
    handleListProfessionals,
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
            case "list_my_appointments":
                return await handleListMyAppointments(supabase, phone);
            case "cancel_appointment":
                return await handleCancelAppointment(supabase, args.appointment_id);
            case "get_available_slots":
                return await handleGetAvailableSlots(supabase, args);
            case "create_appointment":
                return await handleCreateAppointment(supabase, args, phone, clientName);
            default:
                return `Erro: Ferramenta ${functionName} não implementada.`;
        }
    } catch (e: any) {
        return `Erro ao executar ${functionName}: ${e.message}`;
    }
}