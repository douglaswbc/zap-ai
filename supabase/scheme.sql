-- ====================================================================
-- 1. LIMPEZA DE TABELAS EXISTENTES (OPCIONAL PARA RESET)
-- ====================================================================
-- DROP TABLE IF EXISTS agendamentos CASCADE;
-- DROP TABLE IF EXISTS salas CASCADE;
-- DROP TABLE IF EXISTS profissionais CASCADE;
-- DROP TABLE IF EXISTS configuracoes CASCADE;
-- DROP TABLE IF EXISTS perfis CASCADE;

-- ====================================================================
-- 2. CRIAÇÃO DAS TABELAS
-- ====================================================================

-- Tabela de Configurações Gerais da Clínica
CREATE TABLE configuracoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chave VARCHAR(100) UNIQUE NOT NULL,
    valor TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Perfis de Usuários (Admin, Profissional, Operador)
CREATE TABLE perfis (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT,
    email TEXT,
    role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'profissional', 'operador')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Profissionais / Massoterapeutas
CREATE TABLE profissionais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    especialidade VARCHAR(255) NOT NULL,
    google_calendar_id VARCHAR(255) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    jornada_trabalho JSONB DEFAULT '{
      "seg": {"inicio": "08:00", "fim": "18:00", "ativo": true},
      "ter": {"inicio": "08:00", "fim": "18:00", "ativo": true},
      "qua": {"inicio": "08:00", "fim": "18:00", "ativo": true},
      "qui": {"inicio": "08:00", "fim": "18:00", "ativo": true},
      "sex": {"inicio": "08:00", "fim": "18:00", "ativo": true},
      "sab": {"inicio": "08:00", "fim": "12:00", "ativo": false},
      "dom": {"inicio": "08:00", "fim": "12:00", "ativo": false}
    }'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Salas Físicas (Limite rígido de 4 salas)
CREATE TABLE salas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(50) UNIQUE NOT NULL, -- Ex: 'Sala 1', 'Sala 2', 'Sala 3', 'Sala 4'
    is_available BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Logs e Espelhamento de Agendamentos (Usada pela IA e pela Interface React)
CREATE TABLE agendamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name VARCHAR(255) NOT NULL,
    client_phone VARCHAR(50) NOT NULL,
    professional_id UUID REFERENCES profissionais(id) ON DELETE RESTRICT NOT NULL,
    room_id UUID REFERENCES salas(id) ON DELETE RESTRICT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'confirmed' NOT NULL, -- 'pending', 'confirmed', 'cancelled'
    google_event_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Validação básica para evitar que a data de término seja anterior ou igual à de início
    CONSTRAINT check_datas_coerentes CHECK (end_time > start_time)
);

-- ====================================================================
-- 3. POVOAMENTO INICIAL (SEED DATA)
-- ====================================================================

-- Inserindo as 4 salas físicas obrigatórias
INSERT INTO salas (nome, is_available) VALUES
('Sala 1', true),
('Sala 2', true),
('Sala 3', true),
('Sala 4', true)
ON CONFLICT (nome) DO NOTHING;

-- Configurações padrão de funcionamento
INSERT INTO configuracoes (chave, valor) VALUES
('horario_abertura', '08:00'),
('horario_fechamento', '20:00'),
('duracao_sessao_minutos', '60')
ON CONFLICT (chave) DO NOTHING;


-- ====================================================================
-- 4. OTIMIZAÇÃO (ÍNDICES)
-- ====================================================================

-- Índice crucial para buscas de conflitos de horário no Calendário
-- Otimiza queries que barram agendamentos sobrepostos (start_time e end_time)
CREATE INDEX idx_agendamentos_horario ON agendamentos (start_time, end_time);

-- Índices de chaves estrangeiras para acelerar JOINS na listagem do gerente
CREATE INDEX idx_agendamentos_professional_id ON agendamentos (professional_id);
CREATE INDEX idx_agendamentos_room_id ON agendamentos (room_id);

-- Filtro rápido de profissionais ativos para alimentar o Chat de IA
CREATE INDEX idx_profissionais_ativos ON profissionais (is_active) WHERE is_active = true;


-- ====================================================================
-- 5. SEGURANÇA (ROW LEVEL SECURITY - RLS)
-- ====================================================================

-- Habilitando RLS em todas as tabelas
ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE profissionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE salas ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- Políticas para Usuários Autenticados (O Gerente logado na interface React)
-- --------------------------------------------------------------------

-- Controle total para usuários autenticados (Gerentes)
CREATE POLICY "Permitir tudo para usuários autenticados" 
ON agendamentos FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Permitir tudo para usuários autenticados" 
ON profissionais FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Permitir tudo para usuários autenticados" 
ON salas FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Permitir tudo para usuários autenticados" 
ON configuracoes FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Políticas para Perfis
CREATE POLICY "Leitura global para autenticados" ON perfis
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Edição apenas do próprio perfil" ON perfis
    FOR UPDATE TO authenticated USING (auth.uid() = id);

-- --------------------------------------------------------------------
-- Políticas para Edge Functions (Uso da IA e Webhooks - Service Role)
-- --------------------------------------------------------------------
-- Nota: As Edge Functions que usam a chave `service_role` (como a ai-chat
-- ou whatsapp-webhook do seu repositório) ignoram o RLS por padrão, 
-- garantindo que a automação do WhatsApp sempre consiga ler/escrever 
-- no banco de dados sem travar o cliente.


-- ====================================================================
-- 6. TRIGGERS E FUNÇÕES ESPECIAIS
-- ====================================================================

-- Função que valida as regras de negócio rígidas antes de salvar qualquer agendamento
CREATE OR REPLACE FUNCTION validar_concorrencia_agendamento() 
RETURNS TRIGGER AS $$
DECLARE
    total_agendamentos_horario INT;
BEGIN
    -- Só validamos conflitos se o agendamento NÃO estiver cancelado
    IF NEW.status = 'cancelled' THEN
        RETURN NEW;
    END IF;

    -- 1. Verifica se o mesmo profissional já está ocupado nesse intervalo de tempo
    IF EXISTS (
        SELECT 1 FROM agendamentos 
        WHERE professional_id = NEW.professional_id 
          AND status != 'cancelled'
          AND id <> NEW.id
          AND (NEW.start_time, NEW.end_time) OVERLAPS (start_time, end_time)
    ) THEN
        RAISE EXCEPTION 'O profissional selecionado já possui um agendamento (confirmado ou pendente) neste horário.';
    END IF;

    -- 2. Verifica se a mesma sala física já está ocupada nesse intervalo de tempo
    IF EXISTS (
        SELECT 1 FROM agendamentos 
        WHERE room_id = NEW.room_id 
          AND status != 'cancelled'
          AND id <> NEW.id
          AND (NEW.start_time, NEW.end_time) OVERLAPS (start_time, end_time)
    ) THEN
        RAISE EXCEPTION 'A sala física selecionada já está ocupada (agendamento confirmado ou pendente) neste horário.';
    END IF;

    -- 3. Garante o teto estrutural de concorrência simultânea (Máximo 4 agendamentos ao mesmo tempo)
    SELECT COUNT(*) INTO total_agendamentos_horario 
    FROM agendamentos 
    WHERE status != 'cancelled'
      AND id <> NEW.id
      AND (NEW.start_time, NEW.end_time) OVERLAPS (start_time, end_time);

    IF total_agendamentos_horario >= 4 THEN
        RAISE EXCEPTION 'Limite máximo da clínica atingido (4 salas/profissionais ocupados simultaneamente).';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criação do trigger associado à tabela de agendamentos
CREATE TRIGGER trigger_validar_concorrencia
BEFORE INSERT OR UPDATE ON agendamentos
FOR EACH ROW
EXECUTE FUNCTION validar_concorrencia_agendamento();

-- Trigger para criar perfil automaticamente ao cadastrar usuário no Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.perfis (id, nome, email, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'Usuário Novo'), 
    new.email, 
    'admin' -- Define como admin por padrão
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
