import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const { appointmentId, action } = await req.json()
        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

        // 1. Buscamos os dados incluindo a duração do serviço
        const { data: apt, error: aptError } = await supabaseAdmin
            .from('appointments')
            .select('*, contacts(name), services(name, duration_minutes), users_profile!appointments_company_id_fkey(google_refresh_token)')
            .eq('id', appointmentId)
            .single()

        if (aptError || !apt.users_profile?.google_refresh_token) {
            throw new Error("Dados insuficientes para sincronismo ou token ausente.")
        }

        // 2. Refresh do Token do Google
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            body: new URLSearchParams({
                client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
                client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
                refresh_token: apt.users_profile.google_refresh_token,
                grant_type: 'refresh_token',
            })
        })
        const { access_token } = await tokenRes.json()

        // 3. Lógica de Deleção
        if (action === 'DELETE' && apt.google_event_id) {
            await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${apt.google_event_id}`, {
                method: 'DELETE', headers: { Authorization: `Bearer ${access_token}` }
            })
            return new Response(JSON.stringify({ success: true }), { headers: corsHeaders })
        }

        // 4. CÁLCULO DE HORÁRIOS (FIX TIMEZONE)
        // appointment_time vem como "HH:mm:ss". Pegamos apenas "HH:mm"
        const timeClean = apt.appointment_time.substring(0, 5);
        const duration = apt.services?.duration_minutes || 60; // Padrão 60min se não houver no banco

        // Criamos a string de início com o offset correto de Brasília (-03:00)
        const startDateTime = `${apt.appointment_date}T${timeClean}:00-03:00`;

        // Para calcular o fim, usamos o objeto Date, mas formatamos manualmente para evitar o erro do ISOString
        const startDate = new Date(startDateTime);
        const endDate = new Date(startDate.getTime() + (duration * 60 * 1000));

        // Função auxiliar para formatar a data de saída sem converter para UTC
        const formatToISOWithOffset = (date: Date) => {
            const tzf = new Intl.DateTimeFormat('pt-BR', {
                timeZone: 'America/Sao_Paulo',
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                hour12: false
            });
            const parts = tzf.formatToParts(date);
            const f = (type: string) => parts.find(p => p.type === type)?.value;
            return `${f('year')}-${f('month')}-${f('day')}T${f('hour')}:${f('minute')}:${f('second')}-03:00`;
        };

        const endDateTime = formatToISOWithOffset(endDate);



        const eventBody = {
            summary: `${apt.services?.name || 'Agendamento'} - ${apt.contacts?.name || 'Cliente'}`,
            description: `Agendamento gerenciado pelo Zap AI`,
            start: {
                dateTime: startDateTime,
                timeZone: 'America/Sao_Paulo'
            },
            end: {
                dateTime: endDateTime,
                timeZone: 'America/Sao_Paulo'
            },
            status: 'confirmed'
        }

        const url = apt.google_event_id
            ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${apt.google_event_id}`
            : `https://www.googleapis.com/calendar/v3/calendars/primary/events`

        const googleRes = await fetch(url, {
            method: apt.google_event_id ? 'PUT' : 'POST',
            headers: {
                Authorization: `Bearer ${access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventBody)
        })

        const googleData = await googleRes.json()

        // Se for um novo evento, salvamos o ID retornado pelo Google no nosso banco
        if (!apt.google_event_id && googleData.id) {
            await supabaseAdmin
                .from('appointments')
                .update({ google_event_id: googleData.id })
                .eq('id', apt.id)
        }

        return new Response(JSON.stringify({ success: true, googleEventId: googleData.id }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (e) {
        console.error("Erro na Sincronia Google:", e.message)
        return new Response(JSON.stringify({ error: e.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})