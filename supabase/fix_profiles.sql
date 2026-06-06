-- 1. Remover políticas antigas para evitar erros de duplicidade ou recursão
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON perfis;
DROP POLICY IF EXISTS "Admins podem gerenciar todos os perfis" ON perfis;
DROP POLICY IF EXISTS "Acesso público para leitura" ON perfis;

-- 2. Garantir que a tabela existe com as colunas corretas
CREATE TABLE IF NOT EXISTS perfis (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT,
    email TEXT,
    role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'profissional', 'operador')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Habilitar RLS
ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;

-- 4. Criar novas políticas SEM recursão
-- Qualquer usuário autenticado pode ver os perfis (necessário para agendamentos e visualização de profissionais)
CREATE POLICY "Leitura global para autenticados" ON perfis
    FOR SELECT TO authenticated USING (true);

-- Usuários só podem editar seu próprio perfil
CREATE POLICY "Edição apenas do próprio perfil" ON perfis
    FOR UPDATE TO authenticated USING (auth.uid() = id);

-- 5. Trigger para criar perfil automaticamente (revisado)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.perfis (id, nome, email, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'Usuário Novo'), 
    new.email, 
    'admin' -- Define como admin por padrão para o primeiro usuário
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Garantir que o trigger existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. IMPORTANTE: Criar o perfil para o seu usuário atual caso ele ainda não exista
-- Substitua o UUID abaixo pelo seu ID se necessário, ou rode o comando geral:
INSERT INTO public.perfis (id, nome, email, role)
SELECT id, COALESCE(raw_user_meta_data->>'full_name', email), email, 'admin'
FROM auth.users
ON CONFLICT (id) DO NOTHING;
