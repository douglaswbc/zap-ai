// supabase/functions/create-user-admin/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Validar quem está a chamar (Segurança)
        const authHeader = req.headers.get('Authorization')
        const token = authHeader?.replace('Bearer ', '')
        const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token)

        // 2. Capturar dados do Request (ADICIONADO company_id)
        const { email, password, name, role, company_id } = await req.json()

        // 3. Criar Utilizador no Auth
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: name, role }
        })

        if (authError) throw authError

        // 4. Gravar no Perfil (IMPORTANTE: Adicionado o vínculo company_id)
        // Usamos upsert para garantir que os dados sejam gravados mesmo que o trigger falhe
        const { error: profileError } = await supabaseAdmin
            .from('users_profile')
            .upsert({
                id: authUser.user.id,
                name,
                email,
                role,
                company_id: company_id, // Aqui está o vínculo que faltava
                updated_at: new Date().toISOString()
            })

        if (profileError) throw profileError

        return new Response(JSON.stringify({ user: authUser.user }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})