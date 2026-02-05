import { triggerGoogleSync, getNowBR } from "./helpers.ts";

export async function handleListServices(supabase: any, companyId: string) {
    const { data } = await supabase.from("services").select("id, name, price, duration_minutes").eq("company_id", companyId);
    return JSON.stringify(data);
}

export async function handleListProfessionals(supabase: any, companyId: string) {
    const { data } = await supabase.from("professionals").select("id, name, role").eq("company_id", companyId);
    return JSON.stringify(data);
}

export async function handleListMyAppointments(supabase: any, contactId: string) {
    const nowBR = getNowBR();
    const todayISO = nowBR.toISOString().split('T')[0];
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
        .eq("contact_id", contactId)
        .gte("appointment_date", todayISO)
        .order("appointment_date", { ascending: true })
        .limit(10);

    if (error) return `Erro ao buscar agendamentos: ${error.message}`;
    if (!data || data.length === 0) return "Nenhum agendamento futuro encontrado para este usuário.";

    return "Agendamentos encontrados (hoje e futuros):\n" + data.map((a: any) =>
        `- ID: ${a.id} | Serviço: ${a.services.name} | Profissional: ${a.professionals.name} | Data: ${a.appointment_date} | Hora: ${a.appointment_time} | Status: ${a.status}`
    ).join("\n");
}

export async function handleCancelAppointment(supabase: any, appointmentId: string) {
    const { error } = await supabase.from("appointments").update({ status: 'CANCELLED' }).eq("id", appointmentId);
    if (!error) {
        await triggerGoogleSync(appointmentId, 'DELETE');
    }
    return error ? `Erro ao cancelar: ${error.message}` : "Sucesso! O agendamento foi cancelado e removido do calendário Google.";
}

export async function handleGetAvailableSlots(supabase: any, args: any) {
    const { professional_id, service_id, date } = args;
    const nowBR = getNowBR();

    const { data: service } = await supabase.from('services').select('duration_minutes').eq('id', service_id).single();
    const { data: prof } = await supabase.from('professionals').select('start_time, end_time').eq('id', professional_id).single();
    const { data: existing } = await supabase.from('appointments').select('appointment_time').eq('professional_id', professional_id).eq('appointment_date', date).not('status', 'eq', 'CANCELLED');

    if (!service || !prof) return "Erro: Profissional ou serviço não encontrado.";

    const occupied = existing?.map((a: any) => a.appointment_time.substring(0, 5)) || [];
    const slots = [];
    const todayStr = nowBR.toISOString().split('T')[0];
    const [startH, startM] = prof.start_time.split(':').map(Number);
    const [endH, endM] = prof.end_time.split(':').map(Number);

    let curr = new Date(`${date}T${startH.toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')}:00`);
    const end = new Date(`${date}T${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}:00`);

    while (curr < end) {
        const hourMinute = curr.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });
        let isPast = false;
        if (date === todayStr) {
            const [slotH, slotM] = hourMinute.split(':').map(Number);
            if (slotH < nowBR.getHours() || (slotH === nowBR.getHours() && slotM <= nowBR.getMinutes())) isPast = true;
        }
        if (!occupied.includes(hourMinute) && !isPast) slots.push(hourMinute);
        curr.setMinutes(curr.getMinutes() + service.duration_minutes);
    }
    return slots.length > 0 ? JSON.stringify(slots) : "Nenhum horário disponível para esta data.";
}

export async function handleCreateAppointment(supabase: any, args: any, contactId: string, companyId: string) {
    const { data, error } = await supabase.from("appointments").insert({
        contact_id: contactId,
        service_id: args.service_id,
        professional_id: args.professional_id,
        appointment_date: args.date,
        appointment_time: args.time,
        company_id: companyId,
        status: 'PENDING'
    }).select().single();

    if (!error && data) await triggerGoogleSync(data.id);

    return error ? `Erro: ${error.message}` : `Sucesso! Agendamento criado e sincronizado com o calendário Google. ID_DO_AGENDAMENTO: ${data.id}. Peça ao usuário se ele deseja gerar o pagamento PIX agora.`;
}
