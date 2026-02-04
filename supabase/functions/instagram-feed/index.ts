import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'No authorization header' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        if (userError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const { data: profile } = await supabase
            .from('users_profile')
            .select('company_id')
            .eq('id', user.id)
            .single();

        const companyId = profile?.company_id || user.id;

        const { data: settings, error: settingsError } = await supabase
            .from('settings')
            .select('instagram_access_token, instagram_business_id')
            .eq('company_id', companyId)
            .single();

        if (settingsError || !settings?.instagram_access_token || !settings?.instagram_business_id) {
            return new Response(JSON.stringify({ error: 'Instagram não conectado ou chaves ausentes.' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const token = settings.instagram_access_token.trim();
        console.log(`Fetching feed with token of length ${token.length}`);

        const response = await fetch(
            `https://graph.facebook.com/v18.0/${settings.instagram_business_id}/media?fields=id,caption,media_url,media_type,timestamp,permalink&access_token=${token}`
        );

        const data = await response.json();

        if (data.error) {
            console.error("Meta Feed Error:", data.error);
            return new Response(JSON.stringify({ error: `Meta API Error: ${data.error.message || JSON.stringify(data.error)}` }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ feed: data.data || [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });
    } catch (err) {
        console.error("Edge Function (Feed) Error:", err.message);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
