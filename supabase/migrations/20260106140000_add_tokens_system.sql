-- Tabela de tokens de convite
CREATE TABLE IF NOT EXISTS public.tokens_convite (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT UNIQUE NOT NULL,
    role_permitida TEXT NOT NULL CHECK (role_permitida IN ('admin', 'fiscalizador')),
    criado_por UUID REFERENCES auth.users(id),
    ativo BOOLEAN DEFAULT true,
    usado_por UUID REFERENCES public.profiles(id),
    usado_em TIMESTAMPTZ,
    criado_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- RLS para tokens_convite
ALTER TABLE public.tokens_convite ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver/criar tokens
DROP POLICY IF EXISTS "Admins can manage tokens" ON public.tokens_convite;
CREATE POLICY "Admins can manage tokens" ON public.tokens_convite
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Atualização da função handle_new_user para validar tokens
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    v_token_id UUID;
    v_role_permitida TEXT;
    v_invitation_token TEXT;
BEGIN
    v_invitation_token := new.raw_user_meta_data->>'invitation_token';

    -- Se não houver token, bloqueia (sistema fechado)
    IF v_invitation_token IS NULL THEN
        RAISE EXCEPTION 'Um token de convite válido é obrigatório para o cadastro.';
    END IF;

    -- Valida o token
    SELECT id, role_permitida INTO v_token_id, v_role_permitida
    FROM public.tokens_convite
    WHERE token = v_invitation_token AND ativo = true AND usado_por IS NULL;

    IF v_token_id IS NULL THEN
        RAISE EXCEPTION 'Token de convite inválido, inativo ou já utilizado.';
    END IF;

    -- Insere o perfil com a role definida no TOKEN (ignora a role informada no meta_data por segurança)
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data->>'full_name', new.email),
        v_role_permitida
    );

    -- Marcar token como usado
    UPDATE public.tokens_convite
    SET usado_por = new.id,
        usado_em = now(),
        ativo = false
    WHERE id = v_token_id;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
