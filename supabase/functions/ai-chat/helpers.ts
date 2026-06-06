import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Envia uma mensagem de texto utilizando a API do WAScript
 * Conforme formato: POST https://api-whatsapp.wascript.com.br/api/enviar-texto/{token}
 */
export async function sendWhatsAppMessage(phone: string, text: string): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Busca o token do WAScript nas configurações
  const { data: config, error: configError } = await supabase
    .from("configuracoes")
    .select("valor")
    .eq("chave", "wascript_token")
    .single();

  if (configError || !config?.valor) {
    console.error("❌ Erro ao recuperar 'wascript_token':", configError);
    throw new Error("Token WAScript não configurado na tabela 'configuracoes'.");
  }

  const token = config.valor;
  const apiUrl = `https://api-whatsapp.wascript.com.br/api/enviar-texto/${token}`;
  
  // O WAScript geralmente espera apenas os dígitos do número
  const cleanPhone = phone.replace(/\D/g, "");

  console.log(`🚀 Enviando mensagem via WAScript para ${cleanPhone}...`);

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { 
      "accept": "application/json", 
      "content-type": "application/json" 
    },
    body: JSON.stringify({ 
      phone: cleanPhone, 
      message: text 
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`❌ Falha no WhatsApp WAScript (${response.status}):`, errorBody);
    throw new Error(`Falha no WhatsApp: ${response.statusText}`);
  }
  
  console.log("✅ Mensagem enviada com sucesso pelo WAScript.");
}

export const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const getNowBR = () => {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
};

export const checkBusinessHours = (config: Record<string, string>) => {
    const nowBR = getNowBR();
    const currentDay = nowBR.getDay(); 
    const currentTimeMinutes = nowBR.getHours() * 60 + nowBR.getMinutes();

    const daysMap: Record<string, number | number[]> = {
        'Domingo': 0, 'Segunda': 1, 'Terça': 2, 'Quarta': 3, 'Quinta': 4, 'Sexta': 5, 'Sábado': 6,
        'Segunda a Sexta': [1, 2, 3, 4, 5],
        'Segunda a Sábado': [1, 2, 3, 4, 5, 6],
        'Todos os dias': [0, 1, 2, 3, 4, 5, 6]
    };

    let isWorkingDay = false;
    const workingDaysRaw = config['working_days'] || 'Segunda a Sábado';
    const workingDays = workingDaysRaw.split(',').map(d => d.trim());
    
    workingDays.forEach((day: string) => {
        const val = daysMap[day];
        if (Array.isArray(val)) {
            if (val.includes(currentDay)) isWorkingDay = true;
        } else if (val === currentDay) {
            isWorkingDay = true;
        }
    });

    const [startH, startM] = (config['horario_abertura'] || '08:00').split(':').map(Number);
    const [endH, endM] = (config['horario_fechamento'] || '20:00').split(':').map(Number);

    const startTimeMinutes = startH * 60 + (startM || 0);
    const endTimeMinutes = endH * 60 + (endM || 0);

    const isWithinHours = currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes;
    return isWorkingDay && isWithinHours;
};

export const getBusinessContext = (config: Record<string, string>, isOpen: boolean) => {
    return `
[CONFIGURAÇÕES DA CLÍNICA]
- Status Atual: ${isOpen ? 'ABERTO(A)' : 'FECHADO(A)'}
- Horário de Funcionamento: ${config['horario_abertura'] || '08:00'} às ${config['horario_fechamento'] || '20:00'}
- Informações: ${config['informacoes_clinica'] || 'Clínica de Massoterapia de Alta Performance.'}
- Endereço: ${config['endereco'] || 'Consulte o atendente.'}
- Mensagem de Ausência: ${config['mensagem_ausencia'] || 'No momento nossa equipe não está disponível, mas eu (IA) posso ajudar com agendamentos.'}

[REGRAS]
1. Se FECHADO(A), informe que a equipe humana retorna no horário comercial, mas você pode agendar.
2. Use a "Mensagem de Ausência" se estiver fora do horário.
    `;
};

export const triggerGoogleSync = async (appointmentId: string, action?: string) => {
    try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/google-calendar-sync`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ appointmentId, action })
        });
    } catch (err) {
        console.error(`[Sync] Erro:`, err.message);
    }
};

export const getGoogleAccessToken = async (supabase: any) => {
    const { data: config } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'google_refresh_token')
        .maybeSingle();

    if (!config?.valor) return null;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        body: new URLSearchParams({
            client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
            client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
            refresh_token: config.valor,
            grant_type: 'refresh_token',
        })
    });
    const data = await tokenRes.json();
    return data.access_token;
};
