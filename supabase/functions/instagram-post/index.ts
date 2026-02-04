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

    const { method } = req;
    const authHeader = req.headers.get('Authorization');

    try {
        if (!authHeader) throw new Error('No authorization header');
        const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        if (userError || !user) throw new Error('Unauthorized');

        const { data: profile } = await supabase
            .from('users_profile')
            .select('company_id')
            .eq('id', user.id)
            .single();

        const companyId = profile?.company_id || user.id;

        const { data: settings, error: settingsFetchError } = await supabase
            .from('settings')
            .select('instagram_access_token, instagram_business_id')
            .eq('company_id', companyId)
            .single();

        if (settingsFetchError) throw new Error(`Erro ao buscar configurações: ${settingsFetchError.message}`);
        if (!settings?.instagram_access_token) throw new Error('Instagram não conectado (Token ausente)');
        if (!settings?.instagram_business_id) throw new Error('Instagram não conectado (ID de Negócio ausente)');

        const token = settings.instagram_access_token.trim();
        console.log(`Using token of length ${token.length}, starts with ${token.substring(0, 4)}...`);

        if (method === "DELETE") {
            const url = new URL(req.url);
            const postId = url.searchParams.get("postId");
            if (!postId) throw new Error("postId is required");

            const response = await fetch(`https://graph.facebook.com/v18.0/${postId}?access_token=${token}`, {
                method: "DELETE"
            });
            const result = await response.json();
            if (result.error) throw new Error(`Meta API Error: ${result.error.message || JSON.stringify(result.error)}`);

            return new Response(JSON.stringify(result), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        if (method === "POST") {
            const formData = await req.formData();
            const caption = formData.get("caption") as string;
            const file = formData.get("file") as File;

            if (!file) throw new Error("Arquivo é obrigatório");

            const fileName = `${companyId}/${Date.now()}-${file.name}`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('instagram-media')
                .upload(fileName, file);

            if (uploadError) throw new Error(`Erro no Storage: ${uploadError.message}`);

            const { data: { publicUrl } } = supabase.storage
                .from('instagram-media')
                .getPublicUrl(fileName);

            // 1. Criar container de mídia
            const containerResponse = await fetch(
                `https://graph.facebook.com/v18.0/${settings.instagram_business_id}/media?image_url=${encodeURIComponent(publicUrl)}&caption=${encodeURIComponent(caption || '')}&access_token=${token}`,
                { method: "POST" }
            );
            const containerData = await containerResponse.json();
            if (containerData.error) {
                console.error("Meta Media Container Error:", containerData.error);
                throw new Error(`Meta API (Media): ${containerData.error.message || JSON.stringify(containerData.error)}`);
            }

            // 2. Publicar container
            const publishResponse = await fetch(
                `https://graph.facebook.com/v18.0/${settings.instagram_business_id}/media_publish?creation_id=${containerData.id}&access_token=${token}`,
                { method: "POST" }
            );
            const publishData = await publishResponse.json();
            if (publishData.error) {
                console.error("Meta Publish Error:", publishData.error);
                throw new Error(`Meta API (Publish): ${publishData.error.message || JSON.stringify(publishData.error)}`);
            }

            return new Response(JSON.stringify(publishData), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        return new Response("Method not allowed", {
            status: 405,
            headers: corsHeaders
        });
    } catch (err) {
        console.error("Edge Function Error:", err.message);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
