import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEFAULT_VERIFY_TOKEN = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN")!;

const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
    const { method } = req;

    // 1. Webhook Verification (GET)
    if (method === "GET") {
        const url = new URL(req.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const companyId = url.searchParams.get("company_id");

        let verifyToken = DEFAULT_VERIFY_TOKEN;
        if (companyId) {
            const { data } = await supabase.from("settings").select("meta_webhook_verify_token").eq("company_id", companyId).single();
            if (data?.meta_webhook_verify_token) verifyToken = data.meta_webhook_verify_token;
        }

        if (mode === "subscribe" && token === verifyToken) return new Response(challenge, { status: 200 });
        return new Response("Forbidden", { status: 403 });
    }

    // 2. Event Handling (POST)
    if (method === "POST") {
        try {
            const body = await req.json();
            console.log("--- Instagram Webhook Start ---");

            const entry = body.entry?.[0];
            if (!entry) return new Response("NO_ENTRY", { status: 200 });

            const businessId = entry.id; // Business Account ID

            // --- CASE 1: MESSAGING (DM / Button Click) ---
            if (entry.messaging) {
                const messaging = entry.messaging[0];
                const senderId = messaging?.sender?.id;
                const messageText = messaging?.message?.text;
                const quickReply = messaging?.message?.quick_reply;

                const triggerText = (quickReply?.payload || messageText || "").trim();

                if (senderId === businessId) {
                    console.log("[DM] Ignoring message from business account itself.");
                } else if (triggerText && businessId) {
                    const { data: settings } = await supabase
                        .from("settings")
                        .select("company_id, instagram_access_token")
                        .eq("instagram_business_id", businessId)
                        .single();

                    if (settings?.instagram_access_token) {
                        const { data: rules } = await supabase
                            .from("instagram_keywords")
                            .select("*")
                            .eq("company_id", settings.company_id)
                            .eq("active", true);

                        const normalizedTrigger = triggerText.toLowerCase().trim();
                        const matchedRule = rules?.find(r =>
                            r.keyword.toLowerCase().trim() === normalizedTrigger
                        );

                        if (matchedRule) {
                            console.log(`[DM] Rule matched: "${matchedRule.keyword}"`);
                            const messageBody: any = {
                                recipient: { id: senderId },
                                message: { text: matchedRule.reply_text }
                            };

                            // Standard DMs support quick replies
                            if (matchedRule.quick_replies?.length > 0) {
                                messageBody.message.quick_replies = matchedRule.quick_replies.map((qr: any) => ({
                                    content_type: "text",
                                    title: qr.title,
                                    payload: qr.payload
                                }));
                            }

                            const fbResp = await fetch(`https://graph.facebook.com/v24.0/${businessId}/messages?access_token=${settings.instagram_access_token}`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(messageBody)
                            });

                            const fbResult = await fbResp.json();
                            console.log(`[DM] Response Status: ${fbResp.status}`, JSON.stringify(fbResult));
                        }
                    }
                }
            }

            // --- CASE 2: COMMENTS ---
            if (entry.changes) {
                const change = entry.changes[0];
                if (change.field === "comments") {
                    const comment = change.value;
                    const commentId = comment.id;
                    const commentText = (comment.text || "").trim();
                    const commenterId = comment.from?.id;
                    const commenterUsername = comment.from?.username;

                    console.log(`[Comment] ID: ${commentId}, Text: "${commentText}", By: ${commenterUsername}`);

                    if (commenterId === businessId) {
                        console.log("[Comment] Ignoring self-comment.");
                    } else if (commentText && businessId) {
                        const { data: settings } = await supabase
                            .from("settings")
                            .select("company_id, instagram_access_token")
                            .eq("instagram_business_id", businessId)
                            .single();

                        if (settings?.instagram_access_token) {
                            // 1. Lead Capture
                            if (commenterId && commenterUsername) {
                                try {
                                    await supabase.from('instagram_leads').upsert({
                                        company_id: settings.company_id,
                                        instagram_id: commenterId,
                                        username: commenterUsername,
                                        last_comment: commentText,
                                        last_comment_at: new Date().toISOString()
                                    }, { onConflict: 'instagram_id' });
                                } catch (e) { console.error("[Comment] Lead error:", e.message); }
                            }

                            // 2. Keyword Matching
                            const { data: rules } = await supabase
                                .from("instagram_keywords")
                                .select("*")
                                .eq("company_id", settings.company_id)
                                .eq("active", true);

                            const normalizedText = commentText.toLowerCase().trim();
                            const matchedRule = rules?.find(r =>
                                r.keyword.toLowerCase().trim() === normalizedText
                            );

                            if (matchedRule) {
                                console.log(`[Comment] Rule matched: "${matchedRule.keyword}"`);

                                // A. Public Reply
                                const publicMsg = matchedRule.public_reply_text || "Acabei de te enviar uma mensagem privada! 🚀";
                                await fetch(`https://graph.facebook.com/v24.0/${commentId}/replies?message=${encodeURIComponent(publicMsg)}&access_token=${settings.instagram_access_token}`, {
                                    method: "POST"
                                });

                                // B. Private Reply (DM)
                                // Standard: /me/messages with { recipient: { comment_id } }
                                // Limitation: Only TEXT is supported in the FIRST private reply.
                                const dmBody = {
                                    recipient: { comment_id: commentId },
                                    message: { text: matchedRule.reply_text }
                                };

                                console.log(`[Comment] Sending Private Reply to /${businessId}/messages`);
                                const dmResp = await fetch(`https://graph.facebook.com/v24.0/${businessId}/messages?access_token=${settings.instagram_access_token}`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify(dmBody)
                                });

                                const dmResult = await dmResp.json();
                                console.log(`[Comment] Private DM Status ${dmResp.status}:`, JSON.stringify(dmResult));
                            }
                        }
                    }
                }
            }

            console.log("--- Instagram Webhook End ---");
            return new Response("OK", { status: 200 });
        } catch (err) {
            console.error("Critical Webhook Error:", err.message);
            return new Response("Error", { status: 500 });
        }
    }

    return new Response("Method Not Allowed", { status: 405 });
});
