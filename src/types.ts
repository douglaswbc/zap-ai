
export type UserRole = 'admin' | 'company' | 'profissional' | 'operador';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  company_id?: string;
  google_connected?: boolean;
  google_calendar_id?: string;
}

export interface Instance {
  id: string;        // UUID do Supabase
  name: string;      // Nome da instância (ex: "comercial")
  token: string;     // Hash/apikey da Evolution API
  company_id: string;
  agent_id?: string;
  status: string;
  phoneNumber?: string;
  qrCode?: string;
}

export enum MessageSender {
  USER = 'USER',
  AI = 'AI',
  SYSTEM = 'SYSTEM'
}

export interface Message {
  id: string;
  sender: MessageSender;
  content: string;
  timestamp: Date;
  isHumanActive?: boolean;
  company_id: string;
}

export interface Conversation {
  id: string;
  contactName: string;
  lastMessage: string;
  lastTimestamp: Date;
  isHumanActive: boolean;
  instanceId: string;
  unreadCount: number;
  company_id: string;
}

export interface Agent {
  id: string;
  name: string;
  prompt: string;
  papel?: string;
  acao?: string;
  contexto?: string;
  regras?: string;
  intencao?: string;
  formato?: string;
  knowledge_base?: string;
  temperature?: number;
  presence_penalty?: number;
  enableAudio: boolean;
  enableImage: boolean;
  isMultiAgent: boolean;
  parentAgentId?: string;
  company_id: string;
}

export interface Service {
  id: string;
  name: string;
  price: number;
  duration: string;
  description: string;
  category: 'SERVICE' | 'PRODUCT';
  company_id: string;
}

export interface Professional {
  id: string;
  name: string;
  specialty: string;
  google_calendar_id: string;
  is_active: boolean;
  created_at: string;
  company_id?: string;
}

export interface Room {
  id: string;
  name: string; // Ex: "Sala 1"
  is_available: boolean;
  company_id?: string;
}

export interface AppointmentLog {
  id: string;
  client_name: string;
  client_phone: string;
  professional_id: string;
  room_id: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  google_event_id?: string;
  company_id?: string;
}

// Novos tipos Financeiros baseados no SQL fornecido
export type InvoiceStatus = 'Aberta' | 'Paga' | 'Cancelada' | 'Vencida';

export interface Invoice {
  fatura_id: number;
  contato_id: number;
  contato_nome?: string; // Campo virtual para UI
  valor: number;
  data_emissao: string;
  status_fatura: InvoiceStatus;
  company_id: string;
}

export interface PixCharge {
  txid: string;
  fatura_id: number;
  status_sicredi: string;
  valor_original: number;
  qrcode_copia_cola: string;
  data_expiracao?: string;
  id_location_sicredi?: string;
  company_id: string;
}
