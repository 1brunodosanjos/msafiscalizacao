import { supabase } from '@/integrations/supabase/client';

export type ActionType = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'OTHER';
export type EntityType = 'fiscalizacao' | 'mensagem' | 'gestor' | 'usuario' | 'permissao';

interface LogActivityParams {
    userId: string;
    actionType: ActionType;
    entityType: EntityType;
    entityId?: string;
    details?: Record<string, any>;
}

/**
 * Logs a user activity to the database.
 * @param params The parameters for the activity log.
 */
export const logActivity = async ({
    userId,
    actionType,
    entityType,
    entityId,
    details
}: LogActivityParams) => {
    try {
        const { error } = await (supabase.from('activity_logs') as any).insert({
            user_id: userId,
            action_type: actionType,
            entity_type: entityType,
            entity_id: entityId || null,
            details: details || null,
            created_at: new Date().toISOString(),
        });

        if (error) {
            console.error('Error logging activity:', error);
        }
    } catch (err) {
        console.error('Unexpected error logging activity:', err);
    }
};
