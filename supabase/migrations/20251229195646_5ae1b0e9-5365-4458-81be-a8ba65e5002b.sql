-- =========================
-- PERFIS DE USUÁRIO (linked to auth.users)
-- =========================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    perfil TEXT CHECK (perfil IN ('admin', 'fiscalizador')) NOT NULL DEFAULT 'fiscalizador',
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- =========================
-- USER ROLES TABLE (for admin/fiscalizador roles)
-- =========================
CREATE TYPE public.app_role AS ENUM ('admin', 'fiscalizador');

CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- RLS for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" ON public.user_roles
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles" ON public.user_roles
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =========================
-- GESTORES (ENTIDADE AVALIADA)
-- =========================
CREATE TABLE public.gestores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    username_telegram TEXT,
    status TEXT CHECK (status IN ('ativo', 'pausado')) DEFAULT 'ativo',
    observacoes TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.gestores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view gestores" ON public.gestores
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage gestores" ON public.gestores
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Fiscalizadores can insert gestores" ON public.gestores
    FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'fiscalizador') OR public.has_role(auth.uid(), 'admin'));

-- =========================
-- REGISTROS DE FISCALIZAÇÃO
-- =========================
CREATE TABLE public.registros_fiscalizacao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gestor_id UUID NOT NULL REFERENCES public.gestores(id) ON DELETE CASCADE,
    tipo TEXT CHECK (tipo IN ('positivo', 'negativo')) NOT NULL,
    categoria TEXT NOT NULL,
    observacao TEXT,
    data_evento DATE NOT NULL,
    semana_referencia INTEGER NOT NULL,
    mes_referencia INTEGER NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    criado_por UUID NOT NULL REFERENCES auth.users(id)
);

ALTER TABLE public.registros_fiscalizacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view registros" ON public.registros_fiscalizacao
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Fiscalizadores can insert registros" ON public.registros_fiscalizacao
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = criado_por);

CREATE POLICY "Admins can manage registros" ON public.registros_fiscalizacao
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =========================
-- MENSAGENS SEMANAIS
-- =========================
CREATE TABLE public.mensagens_semanais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gestor_id UUID NOT NULL REFERENCES public.gestores(id) ON DELETE CASCADE,
    quantidade_mensagens INTEGER NOT NULL CHECK (quantidade_mensagens >= 0),
    semana_referencia INTEGER NOT NULL,
    mes_referencia INTEGER NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    criado_por UUID NOT NULL REFERENCES auth.users(id),
    UNIQUE (gestor_id, semana_referencia, mes_referencia)
);

ALTER TABLE public.mensagens_semanais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view mensagens" ON public.mensagens_semanais
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Fiscalizadores can insert mensagens" ON public.mensagens_semanais
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = criado_por);

CREATE POLICY "Admins can manage mensagens" ON public.mensagens_semanais
    FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =========================
-- AUDITORIA DE AÇÕES
-- =========================
CREATE TABLE public.auditoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    acao TEXT NOT NULL,
    entidade_afetada TEXT NOT NULL,
    entidade_id UUID,
    descricao TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view auditoria" ON public.auditoria
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can insert auditoria" ON public.auditoria
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- =========================
-- ÍNDICES PARA PERFORMANCE
-- =========================
CREATE INDEX idx_registros_data ON public.registros_fiscalizacao (data_evento);
CREATE INDEX idx_registros_mes ON public.registros_fiscalizacao (mes_referencia);
CREATE INDEX idx_mensagens_mes ON public.mensagens_semanais (mes_referencia);
CREATE INDEX idx_auditoria_user ON public.auditoria (user_id);

-- =========================
-- TRIGGER FOR NEW USER PROFILE
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, nome, email, perfil)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.email),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'perfil', 'fiscalizador')
    );
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (
        NEW.id,
        COALESCE((NEW.raw_user_meta_data ->> 'perfil')::app_role, 'fiscalizador')
    );
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- UPDATE TIMESTAMP FUNCTION
-- =========================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gestores_updated_at
    BEFORE UPDATE ON public.gestores
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();