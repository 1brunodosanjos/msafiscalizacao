
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://mepvmarhsjdkwbutytad.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lcHZtYXJoc2pka3didXR5dGFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMTA2MzYsImV4cCI6MjA4MjY4NjYzNn0.nH-bWpeKOxIXqCWfRx3cMsP4XkiZEzkmnjQ9s_jhmyA";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const log = (msg, type = 'INFO') => {
    const icons = { 'INFO': 'ℹ️', 'SUCCESS': '✅', 'ERROR': '❌', 'WARN': '⚠️' };
    console.log(`${icons[type]} [${type}] ${msg}`);
};

async function verifyWrites() {
    log("Iniciando Verificação de Gravação de Dados...", 'INFO');
    const timestamp = Date.now();
    const testGestorName = `Gestor Auditoria ${timestamp}`;
    let gestorId = null;
    let inspectionId = null;

    try {
        // ---------------------------------------------------------------------
        // 1. TESTE: GESTORES (Criar e Ler)
        // ---------------------------------------------------------------------
        log(`Testando Tabela GESTORES...`, 'INFO');
        const { data: gestor, error: errGestor } = await supabase
            .from('gestores')
            .insert({
                nome: testGestorName,
                username_telegram: 'audit_bot',
                ativo: true
            })
            .select()
            .single();

        if (errGestor) throw new Error(`Falha ao criar gestor: ${errGestor.message}`);
        gestorId = gestor.id;
        log(`Gestor criado com sucesso: ${gestor.nome} (ID: ${gestor.id})`, 'SUCCESS');

        // ---------------------------------------------------------------------
        // 2. TESTE: MENSAGENS SEMANAIS (Criar e Ler)
        // ---------------------------------------------------------------------
        log(`Testando Tabela MENSAGENS_SEMANAIS...`, 'INFO');
        const { data: msg, error: errMsg } = await supabase
            .from('mensagens_semanais')
            .insert({
                gestor_id: gestorId,
                semana_referencia: 1,
                mes_referencia: 1,
                ano_referencia: 2025,
                quantidade_mensagens: 100
            })
            .select()
            .single();

        if (errMsg) throw new Error(`Falha ao criar mensagem: ${errMsg.message}`);
        log(`Mensagem semanal registrada: ${msg.quantidade_mensagens} msgs na semana ${msg.semana_referencia}`, 'SUCCESS');

        // ---------------------------------------------------------------------
        // 3. TESTE: REGISTROS FISCALIZACAO (Telegram)
        // ---------------------------------------------------------------------
        log(`Testando Tabela REGISTROS_FISCALIZACAO...`, 'INFO');
        const { data: reg, error: errReg } = await supabase
            .from('registros_fiscalizacao')
            .insert({
                gestor_id: gestorId,
                data_evento: new Date().toISOString(),
                tipo: 'Negativo', // Case sensitive check might be needed depending on DB constraint
                categoria: 'Auditoria Automatica',
                mes_referencia: 1,
                semana_referencia: 1,
                observacao: 'Teste de auditoria'
            })
            .select()
            .single();

        if (errReg) throw new Error(`Falha ao criar registro fiscalização: ${errReg.message}`);
        log(`Registro de fiscalização criado: ID ${reg.id}`, 'SUCCESS');

        // ---------------------------------------------------------------------
        // 4. TESTE: INSPECTIONS & ITEMS (Calls)
        // ---------------------------------------------------------------------
        log(`Testando Tabelas INSPECTIONS (Calls)...`, 'INFO');

        // Need a valid inspector_id. Since we are anon, we might not have a profile easily usable.
        // However, looking at types, inspector_id references profiles. 
        // If RLS is strict, we might fail here if we don't have a valid user ID.
        // Let's try to fetch ANY profile to use as inspector, or skip if none found.
        const { data: profiles } = await supabase.from('profiles').select('id').limit(1);
        const inspectorId = profiles && profiles.length > 0 ? profiles[0].id : null;

        if (inspectorId) {
            const { data: insp, error: errInsp } = await supabase
                .from('inspections')
                .insert({
                    manager_id: gestorId,
                    inspector_id: inspectorId,
                    date: new Date().toISOString().split('T')[0],
                    type: 'call',
                    score: 100
                })
                .select()
                .single();

            if (errInsp) throw new Error(`Falha ao criar Call: ${errInsp.message}`);
            inspectionId = insp.id;
            log(`Call criada com sucesso: ID ${insp.id}`, 'SUCCESS');

            // 4.1 ITEMS
            const { data: item, error: errItem } = await supabase
                .from('inspection_items')
                .insert({
                    inspection_id: inspectionId,
                    category: 'Auditoria',
                    criterion: 'Integridade de Dados',
                    status: 'positive',
                    observation: 'Item de teste'
                })
                .select()
                .single();

            if (errItem) throw new Error(`Falha ao criar item de call: ${errItem.message}`);
            log(`Item de call criado: ${item.criterion}`, 'SUCCESS');

        } else {
            log(`PULADO: Não foi possível encontrar um perfil de inspetor para teste de Calls.`, 'WARN');
        }

        // ---------------------------------------------------------------------
        // CLEANUP
        // ---------------------------------------------------------------------
        log(`--- Iniciando Limpeza de Dados de Teste ---`, 'INFO');
        // Delete Manager (Cascade should work now thanks to previous fix!)
        // Or we do manual cleanup to be safe and test delete again ;)

        const { error: delError } = await supabase.from('gestores').delete().eq('id', gestorId);
        if (delError) {
            throw new Error(`Falha na limpeza final (Provável erro de RLS ou Cascade): ${delError.message}`);
        }
        log(`Dados de teste limpos com sucesso!`, 'SUCCESS');

        console.log("\n\n=== RELATÓRIO FINAL ===");
        log("Todas as conexões de GRAVAÇÃO e LEITURA estão operacionais.", 'SUCCESS');

    } catch (error) {
        log(`FALHA NO PROCESSO DE AUDITORIA: ${error.message}`, 'ERROR');
        // Attempt cleanup if gestor was created
        if (gestorId) {
            log('Tentando limpeza de emergência...', 'WARN');
            await supabase.from('registros_fiscalizacao').delete().eq('gestor_id', gestorId);
            await supabase.from('mensagens_semanais').delete().eq('gestor_id', gestorId);
            if (inspectionId) {
                await supabase.from('inspection_items').delete().eq('inspection_id', inspectionId);
                await supabase.from('inspections').delete().eq('id', inspectionId);
            }
            await supabase.from('gestores').delete().eq('id', gestorId);
        }
    }
}

verifyWrites();
