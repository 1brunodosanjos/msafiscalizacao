import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, RefreshCw, Trash2, Key, Check, Copy } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { logActivity } from '@/lib/activityLogger';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface TokenConvite {
    id: string;
    token: string;
    role_permitida: string;
    ativo: boolean;
    usado_em: string | null;
    criado_em: string;
    usado_por_email?: string;
}

export default function Tokens() {
    const [tokens, setTokens] = useState<TokenConvite[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [rolePermitida, setRolePermitida] = useState<'admin' | 'fiscalizador'>('fiscalizador');

    // Dialog States
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [tokenToDelete, setTokenToDelete] = useState<string | null>(null);

    const { toast } = useToast();
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!authLoading && !user) {
            navigate('/auth');
        }
    }, [user, authLoading, navigate]);

    const fetchTokens = async () => {
        setLoading(true);
        try {
            const { data, error } = await (supabase
                .from('tokens_convite') as any)
                .select(`
                  *,
                  usado_por_info:profiles!tokens_convite_usado_por_fkey(email)
                `)
                .order('criado_em', { ascending: false });

            if (error) throw error;

            const mappedTokens = data.map((t: any) => ({
                ...t,
                usado_por_email: t.usado_por_info?.email
            }));

            setTokens(mappedTokens);
        } catch (error: any) {
            toast({
                title: 'Erro ao carregar tokens',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTokens();
    }, []);

    const generateToken = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 12; i++) {
            if (i > 0 && i % 4 === 0) result += '-';
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    };

    const handleCreateToken = async () => {
        if (!user?.id) {
            toast({
                title: 'Erro',
                description: 'Usuário não autenticado.',
                variant: 'destructive',
            });
            return;
        }

        setCreating(true);
        try {
            const newToken = generateToken();
            const { error } = await (supabase
                .from('tokens_convite') as any)
                .insert({
                    token: newToken,
                    role_permitida: rolePermitida,
                    criado_por: user.id,
                    ativo: true
                });

            if (error) throw error;

            // Log activity
            if (user) {
                await logActivity({
                    userId: user.id,
                    actionType: 'CREATE',
                    entityType: 'permissao', // Tokens are essentially permissions
                    entityId: newToken,
                    details: { role: rolePermitida, token: newToken }
                });
            }

            toast({
                title: 'Token gerado!',
                description: `Token para ${rolePermitida} criado com sucesso.`,
            });
            fetchTokens();
            setCreateDialogOpen(false);
        } catch (error: any) {
            toast({
                title: 'Erro ao gerar token',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setCreating(false);
        }
    };

    const handleToggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await (supabase
                .from('tokens_convite') as any)
                .update({ ativo: !currentStatus })
                .eq('id', id);

            if (error) throw error;

            // Log activity
            if (user) {
                await logActivity({
                    userId: user.id,
                    actionType: 'UPDATE',
                    entityType: 'permissao',
                    entityId: id,
                    details: { action: 'TOGGLE_TOKEN_STATUS', active: !currentStatus }
                });
            }

            fetchTokens();
        } catch (error: any) {
            toast({
                title: 'Erro ao atualizar status',
                description: error.message,
                variant: 'destructive',
            });
        }
    };

    const confirmDeleteToken = (id: string) => {
        setTokenToDelete(id);
        setDeleteDialogOpen(true);
    };

    const handleDeleteToken = async () => {
        if (!tokenToDelete) return;

        try {
            const { error } = await (supabase
                .from('tokens_convite') as any)
                .delete()
                .eq('id', tokenToDelete);

            if (error) throw error;

            // Log activity
            if (user) {
                await logActivity({
                    userId: user.id,
                    actionType: 'DELETE',
                    entityType: 'permissao',
                    entityId: tokenToDelete,
                    details: { action: 'DELETE_TOKEN' }
                });
            }

            toast({
                title: 'Token excluído',
                description: 'Token removido com sucesso.',
            });
            fetchTokens();
        } catch (error: any) {
            toast({
                title: 'Erro ao excluir token',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setDeleteDialogOpen(false);
            setTokenToDelete(null);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({
            title: 'Copiado!',
            description: 'Token copiado para a área de transferência.',
        });
    };

    return (
        <DashboardLayout>
            <div className="p-4 lg:p-8 pt-20 lg:pt-8 space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Tokens de Convite</h1>
                        <p className="text-muted-foreground">Gerencie tokens para novos cadastros.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={fetchTokens} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>

                        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="hero">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Novo Token
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Novo Token de Convite</DialogTitle>
                                    <DialogDescription>
                                        Gere um token exclusivo para permitir o cadastro de um novo usuário.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label>Permissão do Usuário</Label>
                                        <Select value={rolePermitida} onValueChange={(v: any) => setRolePermitida(v)}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="fiscalizador">Fiscalizador (Acesso restrito)</SelectItem>
                                                <SelectItem value="admin">Administrador (Acesso total)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground">
                                            Fiscalizadores têm permissões personalizáveis. Administradores acessam tudo.
                                        </p>
                                    </div>
                                    <Button className="w-full" onClick={handleCreateToken} disabled={creating}>
                                        {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                                        Gerar Token
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Tokens Gerados</CardTitle>
                        <CardDescription>Lista de todos os tokens ativos e utilizados.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex justify-center p-8">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : tokens.length === 0 ? (
                            <div className="text-center p-8 border-2 border-dashed rounded-lg">
                                <Key className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                                <p className="text-muted-foreground">Nenhum token encontrado.</p>
                                <Button variant="link" onClick={() => setCreateDialogOpen(true)}>
                                    Criar o primeiro token
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {tokens.map((token) => (
                                    <div key={token.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg bg-card/50 hover:bg-card transition-colors gap-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <code className="text-lg font-bold font-mono tracking-wider bg-muted px-2 py-0.5 rounded">{token.token}</code>
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(token.token)}>
                                                    <Copy className="h-3 w-3" />
                                                </Button>
                                                <Badge variant={token.role_permitida === 'admin' ? 'hero' : 'outline'}>
                                                    {token.role_permitida === 'admin' ? 'Admin' : 'Fiscalizador'}
                                                </Badge>
                                                {!token.ativo && !token.usado_em && (
                                                    <Badge variant="secondary">Inativo</Badge>
                                                )}
                                            </div>
                                            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                                                <span>Gerado em: {new Date(token.criado_em).toLocaleDateString()}</span>
                                                {token.usado_em ? (
                                                    <span className="text-primary font-medium flex items-center gap-1">
                                                        <Check className="h-3 w-3" />
                                                        Usado por: {token.usado_por_email || 'Desconhecido'} em {new Date(token.usado_em).toLocaleDateString()}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">Aguardando uso...</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 self-end md:self-auto">
                                            {!token.usado_em && (
                                                <Button
                                                    variant={token.ativo ? "outline" : "default"}
                                                    size="sm"
                                                    onClick={() => handleToggleStatus(token.id, token.ativo)}
                                                >
                                                    {token.ativo ? 'Desativar' : 'Ativar'}
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => confirmDeleteToken(token.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Excluir Token?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta ação não pode ser desfeita. O token será removido permanentemente do histórico.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setTokenToDelete(null)}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteToken} className="bg-destructive hover:bg-destructive/90">
                                Excluir
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </DashboardLayout>
    );
}
