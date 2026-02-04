
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
  role: string;
  specialty: string;
  avatar?: string;
  status: 'AVAILABLE' | 'BUSY' | 'AWAY';
  company_id: string;
}

export interface Appointment {
  id: string;
  contactName: string;
  serviceName: string;
  professionalName: string;
  date: string;
  time: string;
  status: 'CONFIRMED' | 'PENDING' | 'CANCELLED';
  company_id: string;
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
