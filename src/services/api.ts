// src/services/api.ts
import { Instance, User } from '../types';
import { supabase } from './supabase';

/* =====================================================
 * ENV
 * ===================================================== */
const EVO_URL =
  import.meta.env.VITE_EVO_API_URL || process.env.EVO_API_URL;

const EVO_KEY =
  import.meta.env.VITE_EVO_API_KEY || process.env.EVO_API_KEY;

const GLOBAL_WEBHOOK_URL =
  import.meta.env.VITE_WEBHOOK_URL_WHATSAPP;

const GERAR_FATURA_WEBHOOK_URL =
  import.meta.env.VITE_WEBHOOK_URL_GERAR_FATURA;

const CHECK_PAGAMENTO_WEBHOOK_URL =
  import.meta.env.VITE_WEBHOOK_URL_CHECK_PAGAMENTO;

const headers = {
  apikey: EVO_KEY || '',
  'Content-Type': 'application/json',
};

/* =====================================================
 * HELPERS
 * ===================================================== */

/**
 * Retorna o ID raiz da empresa
 */
const getTargetId = (user: User) => user.company_id || user.id;

/**
 * Dispara mensagem via WhatsApp
 * e registra no histórico da conversa
 */
async function dispatchWA(appointment: any, message: string) {
  const { data: inst } = await supabase
    .from('instances')
    .select('name, token')
    .eq('company_id', appointment.company_id)
    .limit(1)
    .single();

  if (!inst) {
    throw new Error('Nenhuma instância conectada para esta empresa.');
  }

  await fetch(`${EVO_URL}/message/sendText/${inst.name}`, {
    method: 'POST',
    headers: {
      apikey: inst.token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      number: appointment.contacts.phone,
      text: message,
    }),
  });

  const { data: conv } = await supabase
    .from('conversations')
    .select('id')
    .eq('contact_id', appointment.contact_id)
    .maybeSingle();

  if (conv) {
    await supabase.from('messages').insert({
      conversation_id: conv.id,
      sender: 'AI',
      content: message,
    });
  }
}

/* =====================================================
 * API
 * ===================================================== */

export const api = {
  /* ================= USERS ================= */
  users: {
    listProfiles: async (user: User) => {
      if (!user?.id) return [];

      // Buscamos o perfil e tentamos trazer o nome da empresa vinculada (auto-relacionamento)
      let query = supabase
        .from('users_profile')
        .select('*, company:company_id(name)');

      if (user.role === 'company') {
        // Empresa quer ver os seus colaboradores
        query = query.eq('company_id', user.id);
      } else if (user.role !== 'admin') {
        // Outras roles não deveriam listar perfis, mas por segurança filtramos pelo ID deles
        query = query.eq('id', user.id);
      }
      // Admins veem tudo por padrão, o filtro será feito no Frontend para melhor UX.

      const { data, error } = await query.order('name');
      if (error) throw error;

      return data || [];
    },

    upsert: async (userData: any) => {
      const { data, error } = await supabase
        .from('users_profile')
        .upsert(userData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    delete: async (id: string) => {
      const { error } = await supabase
        .from('users_profile')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },

    register: async (userData: any) => {
      const { data, error } = await supabase.functions.invoke(
        'create-user-admin',
        { body: userData }
      );

      if (error) throw error;
      return data;
    },
  },

  /* ================= TEMPLATES ================= */
  templates: {
    listAll: async (user: User) => {
      const cid = getTargetId(user);

      const { data, error } = await supabase
        .from('prompt_templates')
        .select('*')
        .or(`company_id.eq.${cid},is_global.eq.true`)
        .order('name');

      if (error) throw error;
      return data;
    },

    save: async (template: any) => {
      const { data, error } = await supabase
        .from('prompt_templates')
        .upsert(template)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  },

  /* ================= INSTANCES ================= */
  instances: {
    list: async (user: User): Promise<Instance[]> => {
      const { data: dbInstances, error } = await supabase
        .from('instances')
        .select('id, name, token, company_id, agent_id')
        .eq('company_id', getTargetId(user));

      if (error) throw error;
      if (!dbInstances?.length) return [];

      try {
        const response = await fetch(
          `${EVO_URL}/instance/fetchInstances`,
          { headers }
        );
        const evoArray = await response.json();

        return dbInstances.map((dbInst) => {
          const evoInst = Array.isArray(evoArray)
            ? evoArray.find(
              (e: any) =>
                e.name?.toLowerCase().trim() ===
                dbInst.name?.toLowerCase().trim()
            )
            : null;

          return {
            ...dbInst,
            status: evoInst?.connectionStatus || 'close',
            phoneNumber: evoInst?.ownerJid
              ? evoInst.ownerJid.split('@')[0]
              : 'Não vinculado',
            profilePicUrl: evoInst?.profilePicUrl || null,
          };
        });
      } catch {
        return dbInstances.map((i) => ({ ...i, status: 'close' }));
      }
    },

    create: async (name: string, user: User) => {
      const companyId = getTargetId(user);

      const body = {
        instanceName: name,
        integration: 'WHATSAPP-BAILEYS',
        webhook: {
          url: GLOBAL_WEBHOOK_URL,
          byEvents: false,
          base64: true,
          events: ['MESSAGES_UPSERT'],
        },
      };

      const response = await fetch(`${EVO_URL}/instance/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error('Erro na Evolution API');
      }

      const evoData = await response.json();

      const { error } = await supabase.from('instances').insert({
        name,
        token: evoData.hash || evoData.instance?.hash,
        company_id: companyId,
      });

      if (error) throw error;
    },

    connect: async (instanceName: string) => {
      const res = await fetch(
        `${EVO_URL}/instance/connect/${instanceName}`,
        { headers }
      );
      const data = await res.json();
      return data.base64 || data.code || '';
    },

    logout: async (name: string) =>
      fetch(`${EVO_URL}/instance/logout/${name}`, {
        method: 'DELETE',
        headers,
      }),

    restart: async (name: string) =>
      fetch(`${EVO_URL}/instance/restart/${name}`, {
        method: 'POST',
        headers,
      }),

    delete: async (name: string) => {
      await fetch(`${EVO_URL}/instance/delete/${name}`, {
        method: 'DELETE',
        headers,
      });

      await supabase.from('instances').delete().eq('name', name);
    },

    checkStatus: async (instanceName: string) => {
      try {
        const response = await fetch(
          `${EVO_URL}/instance/connectionState/${instanceName}`,
          { headers }
        );
        if (!response.ok) return 'close';
        const data = await response.json();
        return data.instance?.state || 'close';
      } catch {
        return 'close';
      }
    },

    updateAgent: async (name: string, agentId: string | null) => {
      await supabase
        .from('instances')
        .update({ agent_id: agentId })
        .eq('name', name);
    },
  },

  /* ================= CONVERSATIONS ================= */
  conversations: {
    list: async (user: User) => {
      let query = supabase
        .from('conversations')
        .select(`*, contacts!inner(*), instances!inner(*)`)
        .order('last_timestamp', { ascending: false });

      if (user.role !== 'admin') {
        query = query.eq(
          'instances.company_id',
          getTargetId(user)
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },

    markAsRead: async (conversationId: string) => {
      // 1. Marca mensagens como lidas
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .eq('sender', 'USER');

      // 2. Reseta o contador na conversa
      await supabase
        .from('conversations')
        .update({ unread_count: 0 })
        .eq('id', conversationId);
    },

    updateMode: async (id: string, isHuman: boolean) => {
      await supabase
        .from('conversations')
        .update({ is_human_active: isHuman })
        .eq('id', id);
    },

    getUnreadCount: async (user: User) => {
      const { count, error } = await supabase
        .from('messages')
        .select(
          '*, conversations!inner(instances!inner(company_id))',
          { count: 'exact', head: true }
        )
        .eq('sender', 'USER')
        .eq('is_read', false)
        .eq(
          'conversations.instances.company_id',
          getTargetId(user)
        );

      if (error) throw error;
      return count || 0;
    },
  },

  /* ================= MESSAGES ================= */
  messages: {
    list: async (conversationId: string) => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('timestamp');

      if (error) throw error;
      return data;
    },

    send: async (
      instanceName: string,
      number: string,
      text: string,
      conversationId: string
    ) => {
      const res = await fetch(
        `${EVO_URL}/message/sendText/${instanceName}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ number, text }),
        }
      );

      if (!res.ok) {
        throw new Error('Erro ao enviar WhatsApp');
      }

      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender: 'OPERATOR',
        content: text,
      });
    },

    sendMedia: async (
      instanceName: string,
      number: string,
      mediaBase64: string,
      fileName: string,
      caption: string,
      conversationId: string
    ) => {
      const res = await fetch(
        `${EVO_URL}/message/sendMedia/${instanceName}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            number,
            media: mediaBase64,
            fileName,
            caption,
            mediaType: fileName.toLowerCase().endsWith('.pdf') ? 'document' : 'image'
          }),
        }
      );

      if (!res.ok) {
        throw new Error('Erro ao enviar mídia via WhatsApp');
      }

      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender: 'OPERATOR',
        content: caption || `(Mídia: ${fileName})`
      });
    },

    resetChat: async (conversationId: string) => {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId);

      if (error) throw error;

      // Opcional: Limpar a última mensagem na tabela de conversas
      await supabase
        .from('conversations')
        .update({ last_message: 'Histórico limpo' })
        .eq('id', conversationId);
    },
  },

  /* ================= APPOINTMENTS ================= */
  appointments: {
    list: async (user: User) => {
      const cid = getTargetId(user);
      const { data, error } = await supabase
        .from('appointments')
        .select('*, contacts(id,name,cpf), services(id,name,price), professionals(id,name)')
        .eq('company_id', cid)
        .order('appointment_date');

      if (error) throw error;

      return (data || []).map((ap) => ({
        ...ap,
        contactId: ap.contact_id,
        serviceId: ap.service_id,
        professionalId: ap.professional_id,
        date: ap.appointment_date,
        time: ap.appointment_time,
        contactName: ap.contacts?.name || 'Cliente',
        contactCpf: ap.contacts?.cpf || '',
        serviceName: ap.services?.name || 'Serviço',
        professionalName: ap.professionals?.name || 'Profissional',
        price: ap.services?.price || 0,
      }));
    },

    save: async (formData: any, user: User, editingId: string | null) => {
      const payload = {
        contact_id: formData.contactId,
        service_id: formData.serviceId,
        professional_id: formData.professionalId,
        appointment_date: formData.date,
        appointment_time: formData.time,
        status: formData.status,
        company_id: user.company_id || user.id
      };

      const { data: result, error } = editingId
        ? await supabase.from('appointments').update(payload).eq('id', editingId).select('id').single()
        : await supabase.from('appointments').insert(payload).select('id').single();

      if (error) throw error;

      // Se estiver CONFIRMADO, processa side-effects
      if (formData.status === 'CONFIRMED') {
        // 1. Google Sync
        if (user.google_connected) {
          supabase.functions.invoke('google-calendar-sync', { body: { appointmentId: result.id, action: 'UPSERT' } });
        }
        // 2. WhatsApp Notification
        api.appointments.sendConfirmation(result.id);
      }

      return result;
    },

    getAvailableSlots: async (professionalId: string, serviceId: string, date: string) => {
      // 1. Busca duração do serviço e jornada do profissional
      const { data: service } = await supabase.from('services').select('duration_minutes').eq('id', serviceId).single();
      const { data: prof } = await supabase.from('professionals').select('*').eq('id', professionalId).single();

      if (!service || !prof) return [];

      // 2. Busca agendamentos já existentes no dia para este profissional
      const { data: existing } = await supabase
        .from('appointments')
        .select('appointment_time')
        .eq('professional_id', professionalId)
        .eq('appointment_date', date)
        .not('status', 'eq', 'CANCELLED');

      const occupiedTimes = existing?.map(a => a.appointment_time.substring(0, 5)) || [];

      // 3. Gera slots baseados na jornada (Ex: 08:00 até 18:00)
      const slots: string[] = [];
      let current = new Date(`${date}T${prof.start_time}`);
      const end = new Date(`${date}T${prof.end_time}`);
      const duration = service.duration_minutes;

      while (current < end) {
        const timeLabel = current.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        // Só adiciona se o horário não estiver ocupado
        if (!occupiedTimes.includes(timeLabel)) {
          slots.push(timeLabel);
        }

        // Avança o relógio de acordo com a duração do serviço
        current.setMinutes(current.getMinutes() + duration);
      }

      return slots;
    },

    updateStatus: async (id: string, status: string, user: User) => {
      const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
      if (error) throw error;

      if (status === 'CONFIRMED') {
        if (user.google_connected) {
          supabase.functions.invoke('google-calendar-sync', { body: { appointmentId: id, action: 'UPSERT' } });
        }
        api.appointments.sendConfirmation(id);
      }
    },

    delete: async (id: string, user: User) => {
      // Se tiver Google, remove de lá primeiro
      if (user.google_connected) {
        await supabase.functions.invoke('google-calendar-sync', {
          body: { appointmentId: id, action: 'DELETE' }
        });
      }
      const { error } = await supabase.from('appointments').delete().eq('id', id);
      if (error) throw error;
    },

    sendConfirmation: async (appointmentId: string) => {
      const { data: apt } = await supabase
        .from('appointments')
        .select(
          `contact_id, appointment_date, appointment_time, company_id,
           contacts(phone, name), services(name)`
        )
        .eq('id', appointmentId)
        .single();

      if (!apt) return;

      const dateStr = new Date(
        `${apt.appointment_date}T00:00:00`
      ).toLocaleDateString('pt-BR');

      const msg = `Olá *${apt.contacts.name}*! Seu agendamento para *${apt.services.name}* no dia *${dateStr}* às *${apt.appointment_time.substring(
        0,
        5
      )}* foi *CONFIRMADO*! ✅`;

      await dispatchWA(apt, msg);
    },

    sendManualReminder: async (appointmentId: string) => {
      const { data: apt } = await supabase
        .from('appointments')
        .select(
          `contact_id, appointment_date, appointment_time, company_id,
           contacts(phone, name), services(name)`
        )
        .eq('id', appointmentId)
        .single();

      if (!apt) return;

      const dateStr = new Date(
        `${apt.appointment_date}T00:00:00`
      ).toLocaleDateString('pt-BR');

      const msg = `Oi *${apt.contacts.name}*, tudo bem? 🔔 Passando para te lembrar do seu agendamento de *${apt.services.name}* para o dia *${dateStr}* às *${apt.appointment_time.substring(
        0,
        5
      )}*.\n\nPodemos confirmar sua presença?`;

      await dispatchWA(apt, msg);
    },
  },

  /* ================= BUSINESS ================= */
  business: {
    services: {
      list: async (user: User) => {
        const { data, error } = await supabase
          .from('services')
          .select('*')
          .eq('company_id', getTargetId(user))
          .order('name');

        if (error) throw error;
        return data;
      },

      upsert: async (data: any) =>
        supabase.from('services').upsert(data),
    },

    professionals: {
      list: async (user: User) => {
        const { data, error } = await supabase
          .from('professionals')
          .select('*')
          .eq('company_id', getTargetId(user))
          .order('name');

        if (error) throw error;
        return data;
      },

      upsert: async (data: any) =>
        supabase.from('professionals').upsert(data),
    },
  },

  /* ================= AGENTS ================= */
  agents: {
    list: async (user: User) => {
      const cid = user.company_id || user.id;
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('company_id', cid)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },

    upsert: async (agentData: any, user: User) => {
      const cid = user.company_id || user.id;

      // MAPEAMENTO: De camelCase (Frontend) para snake_case (Banco de Dados)
      const payload = {
        id: agentData.id || undefined, // Se for novo, o id é gerado pelo banco
        name: agentData.name,
        prompt: agentData.prompt,
        company_id: cid,
        // Mapeando as colunas que deram erro
        enable_audio: agentData.enableAudio ?? agentData.enable_audio ?? false,
        enable_image: agentData.enableImage ?? agentData.enable_image ?? false,
        is_multi_agent: agentData.isMultiAgent ?? agentData.is_multi_agent ?? false,
        parent_agent_id: agentData.parentAgentId ?? agentData.parent_agent_id ?? null,
        knowledge_base: agentData.knowledge_base ?? '',
        papel: agentData.papel ?? '',
        acao: agentData.acao ?? '',
        contexto: agentData.contexto ?? '',
        regras: agentData.regras ?? '',
        intencao: agentData.intencao ?? '',
        formato: agentData.formato ?? '',
        temperature: parseFloat(agentData.temperature) || 0,
        presence_penalty: parseFloat(agentData.presence_penalty) || 0.6
      };

      const { data, error } = await supabase
        .from('agents')
        .upsert(payload)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    delete: async (id: string) => {
      const { error } = await supabase.from('agents').delete().eq('id', id);
      if (error) throw error;
    },

    save: async (agent: any, user: User) => {
      const payload = {
        name: agent.name,
        prompt: agent.prompt,
        enable_audio: agent.enableAudio,
        enable_image: agent.enableImage,
        is_multi_agent: agent.isMultiAgent,
        parent_agent_id: agent.isMultiAgent
          ? null
          : agent.parentAgentId,
        company_id: getTargetId(user),
      };

      const query = agent.id
        ? supabase.from('agents').update(payload).eq('id', agent.id)
        : supabase.from('agents').insert(payload);

      const { data, error } = await query.select().single();
      if (error) throw error;
      return data;
    },
  },

  /* ================= BILLING ================= */
  billing: {
    listInvoices: async (user: User) => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, contacts(name)')
        .eq('company_id', getTargetId(user))
        .order('data_emissao', { ascending: false });

      if (error) throw error;
      return data;
    },

    getStats: async (user: User) => {
      const { data, error } = await supabase
        .from('invoices')
        .select('valor, status_fatura')
        .eq('company_id', getTargetId(user));

      if (error) throw error;

      const stats = {
        totalOpen: 0,
        totalReceived: 0,
        overdueCount: 0,
      };

      data.forEach((inv) => {
        const valor = Number(inv.valor);
        if (inv.status_fatura === 'Aberta')
          stats.totalOpen += valor;
        if (inv.status_fatura === 'Paga')
          stats.totalReceived += valor;
        if (inv.status_fatura === 'Vencida')
          stats.overdueCount++;
      });

      return stats;
    },

    createInvoiceWithPix: async (apt: any) => {
      // 1. Verifica se já existe um PIX ativo para este agendamento (Cache)
      const { data: existingPix } = await supabase
        .from('pix_charges')
        .select('*, invoices!inner(*)')
        .eq('invoices.appointment_id', apt.id)
        .gt('data_expiracao', new Date().toISOString())
        .maybeSingle();

      if (existingPix) {
        return {
          txid: existingPix.txid,
          pixCopiaECola: existingPix.qrcode_copia_cola,
          valor: existingPix.valor_original,
          dataExpiracao: existingPix.data_expiracao,
          fromCache: true,
        };
      }

      // 2. Chamada Direta ao Webhook do n8n (com a URL da variável de ambiente)
      const response = await fetch(GERAR_FATURA_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointment_id: apt.id,
          contact_id: apt.contact_id || apt.contactId,
          valor: apt.price,
          nome_cliente: apt.contactName,
          cpf: apt.contactCpf, // CPF enviado aqui
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao chamar o Webhook de faturamento');
      }

      const data = await response.json();

      // Tratamento da resposta do n8n (geralmente vem em array [0])
      const res = data[0]?.response || data.response;

      if (!res) throw new Error('Resposta do Sicredi inválida através do n8n');

      // 3. Salva a Fatura no Banco de Dados (Supabase)
      const { data: newInv, error: invError } = await supabase
        .from('invoices')
        .upsert(
          {
            appointment_id: apt.id,
            contact_id: apt.contact_id || apt.contactId,
            valor: Number(res.valor_original),
            company_id: apt.company_id,
            status_fatura: 'Aberta',
          },
          { onConflict: 'appointment_id' }
        )
        .select()
        .single();

      if (invError) throw invError;

      // 4. Salva os detalhes do PIX na tabela pix_charges
      await supabase.from('pix_charges').upsert({
        txid: res.txid,
        invoice_id: newInv.id,
        status_sicredi: 'PENDENTE',
        valor_original: res.valor_original,
        qrcode_copia_cola: res.pixCopiaECola,
        data_expiracao: res.dataExpiracao,
      });

      return {
        txid: res.txid,
        pixCopiaECola: res.pixCopiaECola,
        valor: res.valor_original,
        dataExpiracao: res.dataExpiracao,
      };
    },

    checkPaymentStatus: async (txid: string) => {
      const response = await fetch(
        CHECK_PAGAMENTO_WEBHOOK_URL,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ txid }),
        }
      );

      if (!response.ok) {
        throw new Error(
          'Erro ao consultar webhook de status'
        );
      }

      const data = await response.json();
      const res = data[0]?.response;
      const status = res?.status || data.status;

      if (status) {
        const { data: pixCharge } =
          await supabase
            .from('pix_charges')
            .update({ status_sicredi: status })
            .eq('txid', txid)
            .select('invoice_id')
            .single();

        if (
          status === 'CONCLUIDA' ||
          status === 'PAGO'
        ) {
          await supabase
            .from('invoices')
            .update({ status_fatura: 'Paga' })
            .eq('id', pixCharge?.invoice_id);
        }
      }

      return status;
    },

    getPixCharge: async (invoiceId: string) => {
      const { data, error } = await supabase
        .from('pix_charges')
        .select('*')
        .eq('invoice_id', invoiceId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  },

  /* ================= SETTINGS ================= */
  settings: {
    get: async (user: User) => {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('company_id', getTargetId(user))
        .maybeSingle();

      if (error) throw error;
      return data;
    },

    save: async (user: User, formData: any) => {
      const { error } = await supabase.from('settings').upsert({
        company_id: getTargetId(user),
        // Mapeamento dos campos de horário e dias
        business_hours_start: formData.businessHoursStart || formData.business_hours_start,
        business_hours_end: formData.businessHoursEnd || formData.business_hours_end,
        working_days: formData.workingDays || formData.working_days,

        // Mensagem e informações institucionais
        offline_message: formData.offlineMessage || formData.offline_message,
        address: formData.address,
        website: formData.website,
        instagram: formData.instagram,

        // NOVOS CAMPOS ADICIONADOS AQUI:
        informacoes: formData.informacoes,
        is_24h: formData.is24h ?? formData.is_24h ?? false,

        // CAMPOS INSTAGRAM:
        instagram_access_token: formData.instagram_access_token ?? formData.instagramAccessToken,
        instagram_business_id: formData.instagram_business_id ?? formData.instagramBusinessId,
        instagram_connected: formData.instagram_connected ?? formData.instagramConnected,
        instagram_page_id: formData.instagram_page_id ?? formData.instagramPageId,

        // CREDENCIAIS META APP:
        meta_app_id: formData.meta_app_id ?? formData.metaAppId,
        meta_app_secret: formData.meta_app_secret ?? formData.metaAppSecret,
        meta_webhook_verify_token: formData.meta_webhook_verify_token ?? formData.metaVerifyToken,

        updated_at: new Date().toISOString()
      }, { onConflict: 'company_id' });

      if (error) throw error;
    },

    // Função para desconectar Google permanece igual
    disconnectGoogle: async (user: User) => {
      const { error } = await supabase.from('users_profile')
        .update({
          google_connected: false,
          google_refresh_token: null,
          google_calendar_id: null
        })
        .eq('id', user.id);

      if (error) throw error;
    }
  },

  /* ================= LEADS / CRM ================= */
  leads: {
    // Alterar entre IA e Humano, criando a conversa se não existir
    toggleAtendimento: async (lead: any, isHuman: boolean) => {
      // 1. Tenta buscar uma conversa existente para este contato
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', lead.id)
        .maybeSingle();

      if (existingConv) {
        // Se existe, apenas atualiza o status
        const { error } = await supabase
          .from('conversations')
          .update({ is_human_active: isHuman })
          .eq('id', existingConv.id);

        if (error) throw error;
        return existingConv.id;
      } else {
        // 2. Se não existe (lead novo), precisamos vincular a uma instância
        const { data: inst } = await supabase
          .from('instances')
          .select('id')
          .eq('company_id', lead.company_id)
          .limit(1)
          .single();

        if (!inst) throw new Error("Nenhuma instância de WhatsApp configurada para esta empresa.");

        // Criamos a conversa inicial
        const { data: newConv, error: convErr } = await supabase
          .from('conversations')
          .insert({
            contact_id: lead.id,
            instance_id: inst.id,
            is_human_active: isHuman,
            last_message: 'Atendimento iniciado manualmente via CRM'
          })
          .select()
          .single();

        if (convErr) throw convErr;
        return newConv.id;
      }
    }
  },

  /* ================= INSTAGRAM / META ================= */
  instagram: {
    getFeed: async (user: User) => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/instagram-feed`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`
        }
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      return data.feed || [];
    },

    publishPost: async (user: User, formData: FormData) => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/instagram-post`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: formData
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      return data;
    },

    deletePost: async (user: User, postId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/instagram-post?postId=${postId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`
        }
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      return data;
    }
  },

  automations: {
    getRules: async (companyId: string) => {
      const { data, error } = await supabase
        .from('instagram_keywords')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    saveRule: async (rule: any) => {
      const { data, error } = await supabase
        .from('instagram_keywords')
        .upsert(rule)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    deleteRule: async (id: string) => {
      const { error } = await supabase
        .from('instagram_keywords')
        .delete()
        .eq('id', id);
      if (error) throw error;
    }
  },

  /* ================= HELPERS ================= */
  helpers: {
    fetchFormDeps: async (user: User) => {
      const cid = getTargetId(user);

      const [contacts, services, professionals] =
        await Promise.all([
          supabase
            .from('contacts')
            .select('id, name')
            .eq('company_id', cid)
            .order('name'),

          supabase
            .from('services')
            .select('id, name, price')
            .eq('company_id', cid)
            .order('name'),

          supabase
            .from('professionals')
            .select('id, name')
            .eq('company_id', cid)
            .order('name'),
        ]);

      if (contacts.error) throw contacts.error;
      if (services.error) throw services.error;
      if (professionals.error)
        throw professionals.error;

      return {
        contacts: contacts.data || [],
        services: services.data || [],
        professionals: professionals.data || [],
      };
    },
  },
};
