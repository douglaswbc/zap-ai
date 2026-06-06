import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const { code } = await req.json()

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

        if (!tokens.refresh_token) {
            throw new Error("Não foi recebido um Refresh Token. Tente desvincular o app no painel de segurança do Google e conectar novamente.")
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 2. Guardar o Refresh Token GLOBAL na tabela configuracoes
        const { error: configError } = await supabaseAdmin
            .from('configuracoes')
            .upsert({
                chave: 'google_refresh_token',
                valor: tokens.refresh_token
            }, { onConflict: 'chave' })

        if (configError) throw configError

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