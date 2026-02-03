-- 1. Tabela 'grupos' (se não existir, cria)
CREATE TABLE IF NOT EXISTS grupos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now()
);

-- Ativa RLS para grupos
ALTER TABLE grupos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON grupos FOR SELECT USING (true);
CREATE POLICY "Enable all access for admins" ON grupos FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- Seed groups if empty
INSERT INTO grupos (nome) VALUES ('T1'), ('T2'), ('T3'), ('T4'), ('T5'), ('Extra') ON CONFLICT (nome) DO NOTHING;

-- 2. Modificação na tabela 'gestores'
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gestores' AND column_name = 'setor') THEN
        ALTER TABLE gestores ADD COLUMN setor text NOT NULL DEFAULT 'telegram';
        ALTER TABLE gestores ADD CONSTRAINT check_gestores_setor CHECK (setor IN ('calls', 'telegram'));
        CREATE INDEX idx_gestores_setor ON gestores(setor);
    END IF;
END $$;

-- 3. Tabela 'escala_telegram_carga_semanal'
CREATE TABLE IF NOT EXISTS escala_telegram_carga_semanal (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    gestor_id uuid NOT NULL REFERENCES gestores(id) ON DELETE CASCADE,
    grupo_id uuid NOT NULL REFERENCES grupos(id),
    dia_semana text NOT NULL CHECK (dia_semana IN ('seg','ter','qua','qui','sex','sab','dom')),
    hora_entrada text,
    hora_saida text,
    hora_intervalo_inicio text,
    hora_intervalo_fim text,
    status text NOT NULL DEFAULT 'Trabalha' CHECK (status IN ('Trabalha','Folga')),
    observacao text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(gestor_id, dia_semana)
);

-- 4. Tabela 'escala_telegram_folgas'
CREATE TABLE IF NOT EXISTS escala_telegram_folgas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    gestor_id uuid NOT NULL REFERENCES gestores(id) ON DELETE CASCADE,
    grupo_id uuid NOT NULL REFERENCES grupos(id),
    data date NOT NULL,
    motivo text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(gestor_id, data)
);

-- 5. Tabela 'escala_calls_cronograma'
CREATE TABLE IF NOT EXISTS escala_calls_cronograma (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    gestor_id uuid NOT NULL REFERENCES gestores(id) ON DELETE CASCADE,
    grupo_id uuid NOT NULL REFERENCES grupos(id),
    dia_semana text NOT NULL CHECK (dia_semana IN ('seg','ter','qua','qui','sex','sab','dom')),
    horario text NOT NULL,
    tipo_call text NOT NULL DEFAULT 'Call',
    observacao text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(gestor_id, dia_semana, horario)
);

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_escala_telegram_semanal_gestor ON escala_telegram_carga_semanal(gestor_id);
CREATE INDEX IF NOT EXISTS idx_escala_telegram_semanal_grupo ON escala_telegram_carga_semanal(grupo_id);
CREATE INDEX IF NOT EXISTS idx_escala_telegram_semanal_dia ON escala_telegram_carga_semanal(dia_semana);

CREATE INDEX IF NOT EXISTS idx_escala_telegram_folgas_gestor ON escala_telegram_folgas(gestor_id);
CREATE INDEX IF NOT EXISTS idx_escala_telegram_folgas_grupo ON escala_telegram_folgas(grupo_id);
CREATE INDEX IF NOT EXISTS idx_escala_telegram_folgas_data ON escala_telegram_folgas(data);

CREATE INDEX IF NOT EXISTS idx_escala_calls_cronograma_gestor ON escala_calls_cronograma(gestor_id);
CREATE INDEX IF NOT EXISTS idx_escala_calls_cronograma_grupo ON escala_calls_cronograma(grupo_id);
CREATE INDEX IF NOT EXISTS idx_escala_calls_cronograma_dia ON escala_calls_cronograma(dia_semana);

-- 7. Triggers update_at (assumindo function handle_updated_at já existe, padrão supabase)
-- Se não existir, melhor criar ou ignorar por enquanto se não for crítico. O create_at já ajuda.
-- Vou tentar criar se não existir.
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS on_update_escala_telegram_semanal ON escala_telegram_carga_semanal;
CREATE TRIGGER on_update_escala_telegram_semanal
    BEFORE UPDATE ON escala_telegram_carga_semanal
    FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

DROP TRIGGER IF EXISTS on_update_escala_telegram_folgas ON escala_telegram_folgas;
CREATE TRIGGER on_update_escala_telegram_folgas
    BEFORE UPDATE ON escala_telegram_folgas
    FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

DROP TRIGGER IF EXISTS on_update_escala_calls_cronograma ON escala_calls_cronograma;
CREATE TRIGGER on_update_escala_calls_cronograma
    BEFORE UPDATE ON escala_calls_cronograma
    FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

-- 8. Policies (RLS)
ALTER TABLE escala_telegram_carga_semanal ENABLE ROW LEVEL SECURITY;
ALTER TABLE escala_telegram_folgas ENABLE ROW LEVEL SECURITY;
ALTER TABLE escala_calls_cronograma ENABLE ROW LEVEL SECURITY;

-- Policy Select (Public/Authenticated)
CREATE POLICY "Enable read access for all users" ON escala_telegram_carga_semanal FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON escala_telegram_folgas FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON escala_calls_cronograma FOR SELECT USING (true);

-- Policy Admin (CRUD)
CREATE POLICY "Enable all for admins" ON escala_telegram_carga_semanal FOR ALL USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Enable all for admins" ON escala_telegram_folgas FOR ALL USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
CREATE POLICY "Enable all for admins" ON escala_calls_cronograma FOR ALL USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
