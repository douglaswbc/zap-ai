import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Lidar com requisições OPTIONS (CORS)
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { code, userId } = await req.json()

        const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')
        const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')
        const GOOGLE_REDIRECT_URI = Deno.env.get('GOOGLE_REDIRECT_URI')

        // 1. Trocar o código pelos Tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: GOOGLE_CLIENT_ID!,
                client_secret: GOOGLE_CLIENT_SECRET!,
                redirect_uri: GOOGLE_REDIRECT_URI!,
                grant_type: 'authorization_code',
            }),
        })

        const tokens = await tokenResponse.json()

        if (tokens.error) {
            throw new Error(`Erro Google: ${tokens.error_description}`)
        }

        // 2. Inicializar cliente Supabase com a Service Role (para ignorar RLS)
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 3. Guardar o Refresh Token e marcar como conectado
        const { error: updateError } = await supabaseAdmin
            .from('users_profile')
            .update({
                google_refresh_token: tokens.refresh_token,
                google_connected: true,
                // Opcional: buscar o e-mail do calendário principal do utilizador
                google_calendar_id: 'primary'
            })
            .eq('id', userId)

        if (updateError) throw updateError

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})