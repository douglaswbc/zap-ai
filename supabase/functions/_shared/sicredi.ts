import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Configura o cliente HTTP com mTLS (Mutual TLS).
 * Corresponde à configuração 'SSL Certificates' do n8n.
 */
export function getSicrediHttpClient() {
  const cert = Deno.env.get("SICREDI_CERT_PEM");
  const key = Deno.env.get("SICREDI_KEY_PEM");

  if (!cert || !key) {
    throw new Error("Erro: Secrets SICREDI_CERT_PEM ou SICREDI_KEY_PEM não configuradas.");
  }

  return Deno.createHttpClient({
    certChain: cert.trim(),
    privateKey: key.trim(),
  });
}

/**
 * Gere o Token OAuth 2.0 com reuso obrigatório de 60 minutos.
 */
export async function getSicrediToken(supabase: any) {
  // 1. Tenta recuperar token válido do banco
  const { data: auth } = await supabase
    .from('integrations')
    .select('*')
    .eq('provider', 'sicredi')
    .maybeSingle();

  if (auth?.access_token && new Date(auth.expires_at) > new Date()) {
    console.log("✅ Reutilizando token válido.");
    return auth.access_token;
  }

  console.log("🔄 Gerando novo token mTLS...");

  const clientID = Deno.env.get("SICREDI_CLIENT_ID");
  const clientSecret = Deno.env.get("SICREDI_CLIENT_SECRET");
  const baseUrl = Deno.env.get("SICREDI_BASE_URL")?.replace(/\/$/, "");

  const credentials = btoa(`${clientID}:${clientSecret}`);
  const client = getSicrediHttpClient();

  // 2. Solicita novo token
  const response = await fetch(`${baseUrl}/oauth/token`, {
    method: "POST",
    client, 
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      "grant_type": "client_credentials",
      "scope": "cob.read cob.write pix.read webhook.read webhook.write"
    })
  });

  const rawText = await response.text();

  // Captura o erro HTML (Handshake mTLS falhou)
  if (rawText.includes("<html") || rawText.includes("<HTML")) {
    console.error("❌ ERRO SICREDI: O servidor barrou a conexão mTLS e enviou HTML.");
    console.log("Resposta bruta:", rawText.substring(0, 500));
    throw new Error("Falha no handshake mTLS. Verifique se o Certificado e a Chave são o par correto.");
  }

  const data = JSON.parse(rawText);
  const expiresAt = new Date(Date.now() + (data.expires_in * 1000));

  // 3. Salva para reuso
  await supabase.from('integrations').upsert({
    provider: 'sicredi',
    access_token: data.access_token,
    expires_at: expiresAt.toISOString(),
    updated_at: new Date().toISOString()
  });

  return data.access_token;
}