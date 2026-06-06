-- Adiciona a coluna jornada_trabalho na tabela de profissionais
ALTER TABLE profissionais ADD COLUMN IF NOT EXISTS jornada_trabalho JSONB DEFAULT '{
  "seg": {"inicio": "08:00", "fim": "18:00", "ativo": true},
  "ter": {"inicio": "08:00", "fim": "18:00", "ativo": true},
  "qua": {"inicio": "08:00", "fim": "18:00", "ativo": true},
  "qui": {"inicio": "08:00", "fim": "18:00", "ativo": true},
  "sex": {"inicio": "08:00", "fim": "18:00", "ativo": true},
  "sab": {"inicio": "08:00", "fim": "12:00", "ativo": false},
  "dom": {"inicio": "08:00", "fim": "12:00", "ativo": false}
}'::jsonb;
