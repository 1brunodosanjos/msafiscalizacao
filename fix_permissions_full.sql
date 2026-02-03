
-- CORREÇÃO COMPLETA DE PERMISSÕES (LIBERAR GRAVAÇÃO/EDIÇÃO/EXCLUSÃO)
-- Rode este script no Editor SQL do seu Supabase.

-- 1. GESTORES
DROP POLICY IF EXISTS "Acesso total a gestores" ON "public"."gestores";
CREATE POLICY "Acesso total a gestores" ON "public"."gestores"
FOR ALL USING (true); 
-- Nota: "FOR ALL" libera SELECT, INSERT, UPDATE, DELETE de uma só vez para quem passar na checagem.
-- Se preferir mais seguro: TO authenticated USING (true);

-- 2. REGISTROS FISCALIZAÇÃO
DROP POLICY IF EXISTS "Acesso total a fiscalizações" ON "public"."registros_fiscalizacao";
CREATE POLICY "Acesso total a fiscalizações" ON "public"."registros_fiscalizacao"
FOR ALL USING (true);

-- 3. MENSAGENS SEMANAIS
DROP POLICY IF EXISTS "Acesso total a mensagens" ON "public"."mensagens_semanais";
CREATE POLICY "Acesso total a mensagens" ON "public"."mensagens_semanais"
FOR ALL USING (true);

-- 4. INSPECTIONS
DROP POLICY IF EXISTS "Acesso total a calls" ON "public"."inspections";
CREATE POLICY "Acesso total a calls" ON "public"."inspections"
FOR ALL USING (true);

-- 5. INSPECTION ITEMS
DROP POLICY IF EXISTS "Acesso total a itens" ON "public"."inspection_items";
CREATE POLICY "Acesso total a itens" ON "public"."inspection_items"
FOR ALL USING (true);

-- 6. PERMISSÕES DE USUÁRIO (Opcional, mas recomendado para o admin funcionar)
DROP POLICY IF EXISTS "Acesso total a permissoes" ON "public"."user_permissions";
CREATE POLICY "Acesso total a permissoes" ON "public"."user_permissions"
FOR ALL USING (true);
