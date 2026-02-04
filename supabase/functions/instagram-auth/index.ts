import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEFAULT_APP_ID = Deno.env.get("META_APP_ID")!;
const DEFAULT_APP_SECRET = Deno.env.get("META_APP_SECRET")!;
const REDIRECT_URI = Deno.env.get("META_REDIRECT_URI")!;

const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const { code, company_id } = await req.json();

        if (!code || !company_id) {
            throw new Error("Code and company_id are required");
        }

        // 0. Busca as credenciais da empresa no banco
        const { data: settings } = await supabase
            .from("settings")
            .select("meta_app_id, meta_app_secret")
            .eq("company_id", company_id)
            .single();

        const appId = settings?.meta_app_id || DEFAULT_APP_ID;
        const appSecret = settings?.meta_app_secret || DEFAULT_APP_SECRET;

        if (!appId || !appSecret) {
            throw new Error("Meta App ID ou Secret não configurados.");
        }

        // 1. Troca o code por um short-lived token
        const tokenResponse = await fetch(
            `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${appId}&redirect_uri=${REDIRECT_URI}&client_secret=${appSecret}&code=${code}`
        );
        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
            throw new Error(`Meta API Error: ${tokenData.error.message}`);
        }

        const shortToken = tokenData.access_token;

        // 2. Troca o short-lived por um long-lived token (60 dias)
        const longTokenResponse = await fetch(
            `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken}`
        );
        const longTokenData = await longTokenResponse.json();
        const longToken = longTokenData.access_token;

        // 3. Busca o Instagram Business ID do usuário
        const pagesResponse = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${longToken}`);
        const pagesData = await pagesResponse.json();
        const page = pagesData.data?.[0];

        if (!page) throw new Error("Nenhuma página do Facebook vinculada encontrada.");

        const igResponse = await fetch(`https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account&access_token=${longToken}`);
        const igData = await igResponse.json();
        const igId = igData.instagram_business_account?.id;

        if (!igId) throw new Error("Esta página do Facebook não tem uma conta do Instagram Business vinculada.");

        // 4. Salva no banco de dados
        const { error: dbError } = await supabase
            .from("settings")
            .update({
                instagram_access_token: longToken,
                instagram_business_id: igId,
                instagram_page_id: page.id,
                instagram_connected: true,
                updated_at: new Date().toISOString()
            })
            .eq("company_id", company_id);

        if (dbError) throw dbError;

        return new Response(JSON.stringify({ success: true, ig_id: igId }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
