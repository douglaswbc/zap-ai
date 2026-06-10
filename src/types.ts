
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

export interface JornadaTrabalho {
  [key: string]: {
    inicio: string;
    fim: string;
    ativo: boolean;
  };
}

export interface Professional {
  id: string;
  name: string;
  specialty: string;
  google_calendar_id: string;
  is_active: boolean;
  jornada_trabalho?: JornadaTrabalho;
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
