-- Add UPDATE and DELETE policies for mensagens_semanais
-- Allow creators to update their own records
CREATE POLICY "Users can update own messages" ON public.mensagens_semanais
    FOR UPDATE TO authenticated
    USING (auth.uid() = criado_por)
    WITH CHECK (auth.uid() = criado_por);

-- Allow creators to delete their own records
CREATE POLICY "Users can delete own messages" ON public.mensagens_semanais
    FOR DELETE TO authenticated
    USING (auth.uid() = criado_por);

-- Add UPDATE and DELETE policies for registros_fiscalizacao
CREATE POLICY "Users can update own fiscalizacao records" ON public.registros_fiscalizacao
    FOR UPDATE TO authenticated
    USING (auth.uid() = criado_por)
    WITH CHECK (auth.uid() = criado_por);

CREATE POLICY "Users can delete own fiscalizacao records" ON public.registros_fiscalizacao
    FOR DELETE TO authenticated
    USING (auth.uid() = criado_por);

-- Add UPDATE and DELETE policies for inspections (for Call fiscalization)
-- Assuming table 'inspections' exists as per frontend code, and owner column is 'inspector_id'
CREATE POLICY "Users can update own inspections" ON public.inspections
    FOR UPDATE TO authenticated
    USING (auth.uid() = inspector_id)
    WITH CHECK (auth.uid() = inspector_id);

CREATE POLICY "Users can delete own inspections" ON public.inspections
    FOR DELETE TO authenticated
    USING (auth.uid() = inspector_id);
