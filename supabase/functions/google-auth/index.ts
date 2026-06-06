import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const { code, redirectUri } = await req.json()

        const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')
        const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')
        // Usa o redirectUri enviado pelo frontend ou o padrão da env
        const GOOGLE_REDIRECT_URI = redirectUri || Deno.env.get('GOOGLE_REDIRECT_URI')

        if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
            throw new Error("Configuração Google (Client ID/Secret) ausente no servidor.")
        }

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
            console.error("Erro Google Token:", tokens)
            throw new Error(`Erro Google: ${tokens.error_description || tokens.error}`)
        }

        if (!tokens.refresh_token) {
            throw new Error("Não foi recebido um Refresh Token. Se você já conectou antes, remova a permissão no painel do Google e tente novamente.")
        }

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 2. Guardar o Refresh Token GLOBAL
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