import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const { appointmentId, action, date } = await req.json()
        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

        // 1. Refresh Token global
        const { data: config } = await supabaseAdmin
            .from('configuracoes')
            .select('valor')
            .eq('chave', 'google_refresh_token')
            .single();

        if (!config?.valor) throw new Error("Google Refresh Token não configurado.");

        // 2. Access Token
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            body: new URLSearchParams({
                client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
                client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
                refresh_token: config.valor,
                grant_type: 'refresh_token',
            })
        })
        const { access_token } = await tokenRes.json()

        // FUNÇÃO AUXILIAR PARA UPSERT
        const syncAppointment = async (apt: any) => {
            const calendarId = apt.profissionais?.google_calendar_id || 'primary';
            const eventBody = {
                summary: `Massoterapia: ${apt.client_name}`,
                description: `Profissional: ${apt.profissionais?.nome}\nSala: ${apt.salas?.nome}\nTelefone: ${apt.client_phone}`,
                location: apt.salas?.nome || '',
                start: { dateTime: apt.start_time, timeZone: 'America/Sao_Paulo' },
                end: { dateTime: apt.end_time, timeZone: 'America/Sao_Paulo' },
                status: 'confirmed'
            }

            const url = apt.google_event_id
                ? `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${apt.google_event_id}`
                : `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`

            const res = await fetch(url, {
                method: apt.google_event_id ? 'PUT' : 'POST',
                headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(eventBody)
            })

            const data = await res.json()
            if (!apt.google_event_id && data.id) {
                await supabaseAdmin.from('agendamentos').update({ google_event_id: data.id }).eq('id', apt.id)
            }
            return data;
        }

        // 3. LÓGICA DE BATCH (Sincronizar Dia)
        if (action === 'SYNC_DAY' && date) {
            const { data: apts } = await supabaseAdmin
                .from('agendamentos')
                .select('*, profissionais(nome, google_calendar_id), salas(nome)')
                .gte('start_time', `${date}T00:00:00`)
                .lte('start_time', `${date}T23:59:59`)
                .eq('status', 'confirmed');

            if (apts) {
                for (const apt of apts) {
                    await syncAppointment(apt);
                }
            }
            return new Response(JSON.stringify({ success: true, count: apts?.length || 0 }), { 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            })
        }

        // 4. LÓGICA SINGLE
        if (appointmentId) {
            const { data: apt } = await supabaseAdmin
                .from('agendamentos')
                .select('*, profissionais(nome, google_calendar_id), salas(nome)')
                .eq('id', appointmentId)
                .single()

            if (action === 'DELETE' && apt.google_event_id) {
                const calendarId = apt.profissionais?.google_calendar_id || 'primary';
                await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${apt.google_event_id}`, {
                    method: 'DELETE', headers: { Authorization: `Bearer ${access_token}` }
                })
                return new Response(JSON.stringify({ success: true }), { headers: corsHeaders })
            }

            await syncAppointment(apt);
            return new Response(JSON.stringify({ success: true }), { headers: corsHeaders })
        }

        return new Response(JSON.stringify({ error: "Parâmetros inválidos." }), { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})