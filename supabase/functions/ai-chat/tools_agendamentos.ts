import { triggerGoogleSync, getNowBR, getGoogleAccessToken } from "./helpers.ts";

async function checkGoogleAvailability(accessToken: string, calendarIds: string[], startTime: string, endTime: string) {
    const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            timeMin: startTime,
            timeMax: endTime,
            items: calendarIds.map(id => ({ id }))
        })
    });
    const data = await res.json();
    return data.calendars || {};
}

export async function handleListProfessionals(supabase: any) {
    const { data } = await supabase.from("profissionais").select("id, nome, especialidade").eq("is_active", true);
    return JSON.stringify(data);
}

export async function handleListProfessionalHours(supabase: any) {
    const { data } = await supabase.from("profissionais").select("id, nome, jornada_trabalho").eq("is_active", true);
    return JSON.stringify(data);
}

export async function handleListMyAppointments(supabase: any, phone: string) {
    const nowBR = getNowBR();
    const { data, error } = await supabase
        .from("agendamentos")
        .select(`
      id,
      start_time,
      end_time,
      status,
      profissionais(nome)
    `)
        .eq("client_phone", phone.replace(/\D/g, ""))
        .gte("start_time", nowBR.toISOString())
        .order("start_time", { ascending: true })
        .limit(10);

    if (error) return `Erro ao buscar agendamentos: ${error.message}`;
    if (!data || data.length === 0) return "Nenhum agendamento futuro encontrado.";

    return "Agendamentos encontrados:\n" + data.map((a: any) =>
        `- ID: ${a.id} | Profissional: ${a.profissionais.nome} | Início: ${new Date(a.start_time).toLocaleString('pt-BR')} | Status: ${a.status}`
    ).join("\n");
}

export async function handleCancelAppointment(supabase: any, appointmentId: string) {
    const { error } = await supabase.from("agendamentos").update({ status: 'cancelled' }).eq("id", appointmentId);
    if (!error) {
        await triggerGoogleSync(appointmentId, 'DELETE');
    }
    return error ? `Erro ao cancelar: ${error.message}` : "Sucesso! O agendamento foi cancelado.";
}

export async function handleGetAvailableSlots(supabase: any, args: any) {
    const { professional_id, date } = args;
    const nowBR = getNowBR();

    const { data: config } = await supabase.from('configuracoes').select('valor').eq('chave', 'duracao_sessao_minutos').single();
    const duration = parseInt(config?.valor || '60');

    // 1. Buscar Profissionais e Salas
    const { data: profissionais } = await supabase.from('profissionais').select('*').eq('is_active', true);
    const { data: salas } = await supabase.from('salas').select('*').eq('is_available', true);

    if (!profissionais?.length || !salas?.length) return "Erro: Sem profissionais ou salas.";

    // 2. Buscar Agendamentos Existentes no DB para o dia
    const startOfDay = `${date}T00:00:00Z`;
    const endOfDay = `${date}T23:59:59Z`;
    const { data: existingApts } = await supabase.from('agendamentos')
        .select('*')
        .gte('start_time', startOfDay)
        .lte('start_time', endOfDay)
        .neq('status', 'cancelled');

    // 3. Google Calendar check
    const accessToken = await getGoogleAccessToken(supabase);
    let googleFreeBusy: any = {};
    if (accessToken) {
        const calIds = profissionais.map((p: any) => p.google_calendar_id).filter(Boolean);
        if (calIds.length > 0) {
            googleFreeBusy = await checkGoogleAvailability(accessToken, calIds, startOfDay, endOfDay);
        }
    }

    // 4. Gerar Slots
    const slots = [];
    
    // Pegar dia da semana (seg, ter, etc) de forma determinística
    const dayNames = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day); // Data local do servidor, mas o getDay() será consistente com a data passada
    const dayKey = dayNames[dateObj.getDay()];

    console.log(`[Slots] Consultando data: ${date}, Dia: ${dayKey}, Profissional: ${professional_id || 'Todos'}`);

    const { data: openTime } = await supabase.from('configuracoes').select('valor').eq('chave', 'horario_abertura').single();
    const { data: closeTime } = await supabase.from('configuracoes').select('valor').eq('chave', 'horario_fechamento').single();

    let curr = new Date(`${date}T${openTime?.valor || '08:00'}:00-03:00`);
    const endLimit = new Date(`${date}T${closeTime?.valor || '20:00'}:00-03:00`);

    const now = new Date();

    while (curr < endLimit) {
        const slotStart = new Date(curr);
        const slotEnd = new Date(curr.getTime() + duration * 60000);
        const slotStartISO = slotStart.toISOString();
        const slotEndISO = slotEnd.toISOString();

        if (slotStart > now) {
            const concurrent = existingApts?.filter((a: any) => {
                const aStart = new Date(a.start_time);
                const aEnd = new Date(a.end_time);
                return (slotStart < aEnd && slotEnd > aStart);
            }) || [];

            if (concurrent.length < 4) {
                const availableProfs = profissionais.filter((p: any) => {
                    if (professional_id && p.id !== professional_id) return false;
                    
                    // Verificação de Jornada de Trabalho (Segura para fuso horário)
                    if (p.jornada_trabalho) {
                        const jornada = p.jornada_trabalho[dayKey];
                        if (!jornada || !jornada.ativo) return false;
                        
                        const [hIni, mIni] = jornada.inicio.split(':').map(Number);
                        const [hFim, mFim] = jornada.fim.split(':').map(Number);
                        const shiftStartMin = hIni * 60 + mIni;
                        const shiftEndMin = hFim * 60 + mFim;

                        const getMin = (d: Date) => {
                            const parts = new Intl.DateTimeFormat("pt-BR", {
                                timeZone: "America/Sao_Paulo",
                                hour: "numeric",
                                minute: "numeric",
                                hour12: false,
                            }).formatToParts(d);
                            const h = parseInt(parts.find(p => p.type === 'hour')!.value);
                            const m = parseInt(parts.find(p => p.type === 'minute')!.value);
                            return h * 60 + m;
                        };
                        
                        const slotStartMin = getMin(slotStart);
                        const slotEndMin = getMin(slotEnd);
                        
                        if (slotStartMin < shiftStartMin || slotEndMin > shiftEndMin) return false;
                    }

                    const hasDbConflict = concurrent.some((a: any) => a.professional_id === p.id);
                    if (hasDbConflict) return false;

                    if (p.google_calendar_id && googleFreeBusy[p.google_calendar_id]) {
                        const busy = googleFreeBusy[p.google_calendar_id].busy || [];
                        return !busy.some((b: any) => {
                            const bStart = new Date(b.start);
                            const bEnd = new Date(b.end);
                            return (slotStart < bEnd && slotEnd > bStart);
                        });
                    }
                    return true;
                });

                const availableRooms = salas.filter((r: any) => !concurrent.some((a: any) => a.room_id === r.id));

                if (availableProfs.length > 0 && availableRooms.length > 0) {
                    slots.push({
                        horario: slotStart.toLocaleTimeString('pt-BR', { 
                            hour: '2-digit', 
                            minute: '2-digit', 
                            hour12: false,
                            timeZone: 'America/Sao_Paulo'
                        }),
                        profissionais_disponiveis: availableProfs.map(p => p.nome)
                    });
                }
            }
        }
        curr.setMinutes(curr.getMinutes() + 30);
    }

    return slots.length > 0 ? JSON.stringify(slots) : "Nenhum horário disponível.";
}

export async function handleCreateAppointment(supabase: any, args: any, phone: string, name: string) {
    const { professional_id, date, time } = args; // professional_id pode vir como UUID ou Nome (ex: "Samara")
    const start_time = new Date(`${date}T${time}:00-03:00`);
    
    const { data: config } = await supabase.from('configuracoes').select('valor').eq('chave', 'duracao_sessao_minutos').single();
    const duration = parseInt(config?.valor || '60');
    const end_time = new Date(start_time.getTime() + duration * 60000);

    const { data: profissionais } = await supabase.from('profissionais').select('*').eq('is_active', true);
    const { data: salas } = await supabase.from('salas').select('*').eq('is_available', true);

    if (!profissionais?.length || !salas?.length) return "Erro: Sem profissionais ou salas disponíveis.";

    // Pegar dia da semana para validar jornada
    const dayNames = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
    const dayKey = dayNames[start_time.getDay()];

    // 1. Buscar Agendamentos no DB
    const { data: concurrent } = await supabase.from('agendamentos')
        .select('*')
        .neq('status', 'cancelled')
        .or(`start_time.lt.${end_time.toISOString()},end_time.gt.${start_time.toISOString()}`);
    
    const overlapping = concurrent?.filter((a: any) => {
        const aStart = new Date(a.start_time);
        const aEnd = new Date(a.end_time);
        return (start_time < aEnd && end_time > aStart);
    }) || [];

    if (overlapping.length >= 4) return "Erro: Limite de 4 salas ocupadas atingido para este horário.";

    // 2. Google Calendar check para consistência final
    const accessToken = await getGoogleAccessToken(supabase);
    let googleFreeBusy: any = {};
    if (accessToken) {
        const startISO = start_time.toISOString();
        const endISO = end_time.toISOString();
        const calIds = profissionais.map((p: any) => p.google_calendar_id).filter(Boolean);
        if (calIds.length > 0) {
            googleFreeBusy = await checkGoogleAvailability(accessToken, calIds, startISO, endISO);
        }
    }

    const getMin = (d: Date) => {
        const parts = new Intl.DateTimeFormat("pt-BR", {
            timeZone: "America/Sao_Paulo",
            hour: "numeric",
            minute: "numeric",
            hour12: false,
        }).formatToParts(d);
        const h = parseInt(parts.find(p => p.type === 'hour')!.value);
        const m = parseInt(parts.find(p => p.type === 'minute')!.value);
        return h * 60 + m;
    };

    const slotStartMin = getMin(start_time);
    const slotEndMin = getMin(end_time);

    console.log(`[Create] Validando reserva: ${date} ${time}, Profissional: ${professional_id}, Dia: ${dayKey}`);

    const availableProfs = profissionais.filter((p: any) => {
        // Suporte flexível para ID ou Nome
        if (professional_id) {
            const isMatchId = p.id === professional_id;
            const isMatchName = p.nome.toLowerCase().includes(professional_id.toLowerCase());
            if (!isMatchId && !isMatchName) return false;
        }
        
        // Validação de Jornada (Shift)
        if (p.jornada_trabalho) {
            const jornada = p.jornada_trabalho[dayKey];
            if (!jornada || !jornada.ativo) return false;
            
            const [hIni, mIni] = jornada.inicio.split(':').map(Number);
            const [hFim, mFim] = jornada.fim.split(':').map(Number);
            const shiftStartMin = hIni * 60 + mIni;
            const shiftEndMin = hFim * 60 + mFim;

            if (slotStartMin < shiftStartMin || slotEndMin > shiftEndMin) return false;
        }

        // Conflito no Banco de Dados
        const hasDbConflict = overlapping.some((a: any) => a.professional_id === p.id);
        if (hasDbConflict) return false;

        // Conflito no Google Calendar
        if (p.google_calendar_id && googleFreeBusy[p.google_calendar_id]) {
            const busy = googleFreeBusy[p.google_calendar_id].busy || [];
            if (busy.some((b: any) => {
                const bStart = new Date(b.start);
                const bEnd = new Date(b.end);
                return (start_time < bEnd && end_time > bStart);
            })) return false;
        }

        return true;
    });

    if (availableProfs.length === 0) {
        return `Erro: O profissional ${professional_id || ''} não está disponível ou fora do horário de atendimento neste momento (Turno: ${dayKey}).`;
    }

    const selectedProf = availableProfs[0];
    const availableRooms = salas.filter((r: any) => !overlapping.some((a: any) => r.id === a.room_id));
    
    if (availableRooms.length === 0) return "Erro: Todas as salas físicas estão ocupadas neste horário.";
    const selectedRoom = availableRooms[0];

    const { data, error } = await supabase.from("agendamentos").insert({
        client_name: name,
        client_phone: phone.replace(/\D/g, ""),
        professional_id: selectedProf.id,
        room_id: selectedRoom.id,
        start_time: start_time.toISOString(),
        end_time: end_time.toISOString(),
        status: 'confirmed'
    }).select().single();

    if (!error && data) await triggerGoogleSync(data.id);

    return error ? `Erro: ${error.message}` : `Sucesso! Agendamento realizado com ${selectedProf.nome} na ${selectedRoom.nome}.`;
}