export const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const getNowBR = () => {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
};

export const checkBusinessHours = (settings: any) => {
    const nowBR = getNowBR();
    const currentHour = nowBR.getHours();
    const currentMinute = nowBR.getMinutes();
    const currentDay = nowBR.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado

    const daysMap: Record<string, number | number[]> = {
        'Domingo': 0, 'Segunda': 1, 'Terça': 2, 'Quarta': 3, 'Quinta': 4, 'Sexta': 5, 'Sábado': 6,
        'Segunda a Sexta': [1, 2, 3, 4, 5],
        'Segunda a Sábado': [1, 2, 3, 4, 5, 6],
        'Todos os dias': [0, 1, 2, 3, 4, 5, 6]
    };

    let isWorkingDay = false;
    const workingDays = settings?.working_days || ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
    workingDays.forEach((day: string) => {
        const val = daysMap[day];
        if (Array.isArray(val)) {
            if (val.includes(currentDay)) isWorkingDay = true;
        } else if (val === currentDay) {
            isWorkingDay = true;
        }
    });

    const [startH, startM] = (settings?.business_hours_start || '09:00').split(':').map(Number);
    const [endH, endM] = (settings?.business_hours_end || '18:00').split(':').map(Number);

    const currentTimeMinutes = currentHour * 60 + currentMinute;
    const startTimeMinutes = startH * 60 + (startM || 0);
    const endTimeMinutes = endH * 60 + (endM || 0);

    const isWithinHours = currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes;
    return isWorkingDay && isWithinHours;
};

export const getBusinessContext = (settings: any, isOpen: boolean, workingDays: string[]) => {
    return `
[CONFIGURAÇÕES DA EMPRESA]
- Status Atual: ${isOpen ? 'ABERTO(A)' : 'FECHADO(A)'}
- Horário de Funcionamento: ${settings?.business_hours_start || '09:00'} às ${settings?.business_hours_end || '18:00'}
- Dias de Trabalho: ${workingDays.join(', ')}
- Informações Institucionais: ${settings?.informacoes || ''}
- Endereço: ${settings?.address || ''}
- Website: ${settings?.website || ''}
- Mensagem de Ausência: ${settings?.offline_message || 'No momento nossa equipe humana não está disponível, mas eu (IA) posso te ajudar com agendamentos e informações gerais.'}

[REGRAS DE ATENDIMENTO]
1. Se o status da empresa for FECHADO(A), você DEVE informar ao cliente que a equipe humana não está disponível no momento.
2. Seja cortês e informe que o atendimento humano retornará no horário comercial.
3. SEMPRE tente ajudar com informações da base de conhecimento ou realize agendamentos, pois você (IA) funciona 24h.
4. Se estiver fechado, use a "Mensagem de Ausência" como base para sua resposta inicial.
    `;
};

export const triggerGoogleSync = async (appointmentId: string, action?: string) => {
    console.log(`[Sync]: Triggering Google Calendar Sync for Appointment: ${appointmentId}, Action: ${action || 'UPSERT'}`);
    try {
        const syncRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/google-calendar-sync`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ appointmentId, action })
        });
        const syncData = await syncRes.json();
        console.log(`[Sync]: Response:`, JSON.stringify(syncData));
        return syncData;
    } catch (err) {
        console.error(`[Sync]: Failed:`, err.message);
        return { error: err.message };
    }
};
