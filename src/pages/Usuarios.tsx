import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Loader2,
  Lock,
  History,
  Download,
  Users,
  Shield,
  Eye,
  Search
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { logActivity } from '@/lib/activityLogger';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  ativo: boolean;
  criado_em: string;
}

interface UserPermissions {
  access_telegram: boolean;
  access_calls: boolean;
  access_rankings: boolean;
  access_dashboard: boolean;
  access_reports: boolean;
  access_scales: boolean;
}

export default function Usuarios() {
  const { user, profile, loading: authLoading, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);

  // Permissions Dialog State
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserPermissions, setSelectedUserPermissions] = useState<UserPermissions>({
    access_telegram: false,
    access_calls: false,
    access_rankings: false,
    access_dashboard: false,
    access_reports: false,
    access_scales: false
  });
  const [savingPermissions, setSavingPermissions] = useState(false);

  // Activity Log State
  const [activityLogOpen, setActivityLogOpen] = useState(false);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [gestoresMap, setGestoresMap] = useState<Record<string, string>>({});
  const [logStartDate, setLogStartDate] = useState<string>('');
  const [logEndDate, setLogEndDate] = useState<string>('');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!authLoading && user && !isAdmin) {
      navigate('/dashboard');
      toast.error('Acesso negado. Apenas administradores podem acessar esta página.');
    }
  }, [user, authLoading, isAdmin, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchUsers();
    }
  }, [user, isAdmin]);

  const fetchUsers = async () => {
    try {
      setLoading(true);

      const { data: profiles, error: profilesError } = await (supabase
        .from('profiles') as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const rolesMap: Record<string, string> = {};
      const mappedProfiles: UserProfile[] = (profiles || []).map((p) => {
        rolesMap[p.id] = p.role;
        return {
          id: p.id,
          full_name: p.full_name || 'Sem Nome',
          email: p.email,
          role: p.role,
          ativo: p.ativo ?? true,
          criado_em: p.created_at
        };
      });

      setUsers(mappedProfiles);
      setUserRoles(rolesMap);

      // Fetch gestores for log formatting
      const { data: gestoresData } = await (supabase
        .from('gestores') as any)
        .select('id, nome');

      if (gestoresData) {
        const gMap: Record<string, string> = {};
        gestoresData.forEach((g) => {
          gMap[g.id] = g.nome;
        });
        setGestoresMap(gMap);
      }

    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'fiscalizador') => {
    if (userId === user?.id) {
      toast.error('Você não pode alterar seu próprio perfil');
      return;
    }

    try {
      setUpdatingUser(userId);

      const { error: profileError } = await (supabase
        .from('profiles') as any)
        .update({ role: newRole })
        .eq('id', userId);

      if (profileError) throw profileError;

      // Log activity
      if (user) {
        await logActivity({
          userId: user.id,
          actionType: 'UPDATE',
          entityType: 'usuario',
          entityId: userId,
          details: { new_role: newRole }
        });
      }

      setUserRoles(prev => ({ ...prev, [userId]: newRole }));
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, role: newRole } : u
      ));

      toast.success('Perfil atualizado com sucesso');
    } catch (error: any) {
      console.error('Erro ao atualizar perfil:', error);
      toast.error(`Erro ao atualizar perfil: ${error.message || 'Erro desconhecido'}`);
      fetchUsers();
    } finally {
      setUpdatingUser(null);
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    if (userId === user?.id) {
      toast.error('Você não pode desativar seu próprio perfil');
      return;
    }

    try {
      setUpdatingUser(userId);
      const newStatus = !currentStatus;

      const { error } = await (supabase
        .from('profiles') as any)
        .update({ ativo: newStatus })
        .eq('id', userId);

      if (error) throw error;

      // Log activity
      if (user) {
        await logActivity({
          userId: user.id,
          actionType: 'UPDATE',
          entityType: 'usuario',
          entityId: userId,
          details: { status_change: newStatus ? 'ACTIVATED' : 'DEACTIVATED' }
        });
      }

      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, ativo: newStatus } : u
      ));

      toast.success(`Usuário ${newStatus ? 'ativado' : 'desativado'} com sucesso`);
    } catch (error: any) {
      console.error('Erro ao alterar status:', error);
      toast.error('Erro ao alterar status do usuário');
    } finally {
      setUpdatingUser(null);
    }
  };

  const openPermissionDialog = async (userId: string) => {
    setSelectedUserId(userId);
    setPermissionDialogOpen(true);
    setSavingPermissions(false); // Reset saving state

    // Fetch existing permissions
    const { data, error } = await (supabase
      .from('user_permissions') as any)
      .select('*')
      .eq('user_id', userId)
      .single();

    if (data) {
      setSelectedUserPermissions({
        access_telegram: data.access_telegram,
        access_calls: data.access_calls,
        access_rankings: data.access_rankings,
        access_dashboard: data.access_dashboard,
        access_reports: data.access_reports ?? false,
        access_scales: data.access_scales ?? false
      });
    } else {
      // Default to all false for new
      setSelectedUserPermissions({
        access_telegram: false,
        access_calls: false,
        access_rankings: false,
        access_dashboard: false,
        access_reports: false,
        access_scales: false
      });
    }
  };

  const savePermissions = async () => {
    if (!selectedUserId) return;
    setSavingPermissions(true);

    try {
      const { error } = await (supabase
        .from('user_permissions') as any)
        .upsert({
          user_id: selectedUserId,
          ...selectedUserPermissions,
          // updated_by removed as it doesn't exist in schema
        });

      if (error) throw error;

      // Log activity
      if (user) {
        await logActivity({
          userId: user.id,
          actionType: 'UPDATE',
          entityType: 'permissao',
          entityId: selectedUserId,
          details: selectedUserPermissions
        });
      }

      toast.success('Permissões atualizadas com sucesso');
      setPermissionDialogOpen(false);
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast.error('Erro ao salvar permissões');
    } finally {
      setSavingPermissions(false);
    }
  };

  const openActivityLog = async (userId: string) => {
    setSelectedUserId(userId);
    setActivityLogOpen(true);
    setLoadingLogs(true);

    // Default range: last 30 days
    if (!logStartDate) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      setLogStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
    }
    if (!logEndDate) {
      setLogEndDate(new Date().toISOString().split('T')[0]);
    }

    await fetchActivityLogs(userId);
  };

  const fetchActivityLogs = async (userId: string) => {
    setLoadingLogs(true);
    try {
      let query = (supabase
        .from('activity_logs') as any)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (logStartDate) {
        query = query.gte('created_at', `${logStartDate}T00:00:00`);
      }
      if (logEndDate) {
        query = query.lte('created_at', `${logEndDate}T23:59:59`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setActivityLogs(data || []);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      toast.error('Erro ao carregar histórico de atividades');
    } finally {
      setLoadingLogs(false);
    }
  };

  // Refetch logs when filters change, if dialog is open
  useEffect(() => {
    if (activityLogOpen && selectedUserId) {
      // Debounce or just fetch
      const timer = setTimeout(() => {
        fetchActivityLogs(selectedUserId);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [logStartDate, logEndDate]);


  const formatLogMessage = (log: any) => {
    const action = log.action_type;
    const entity = log.entity_type;
    const details = log.details || {};
    const gestorName = details.gestor_id ? gestoresMap[details.gestor_id] : 'Gestor desconhecido';

    // Helper helpers
    const getGestorText = () => details.gestor_id ? `para o gestor ${gestorName}` : '';

    switch (entity) {
      case 'fiscalizacao':
        if (action === 'CREATE') return `Criou uma nova fiscalização ${getGestorText()}. Referência: ${details.score !== undefined ? `Pontuação ${details.score > 0 ? '+' : ''}${details.score}` : ''}`;
        if (action === 'UPDATE') return `Atualizou uma fiscalização existente ${getGestorText()}.`;
        if (action === 'DELETE') return `Excluiu uma fiscalização ${getGestorText()} (Data evento: ${details.data_evento ? format(new Date(details.data_evento + 'T12:00:00'), 'dd/MM/yyyy') : 'N/A'}).`;
        break;
      case 'mensagem':
        if (action === 'CREATE') return `Criou/Lançou mensagens semanais ${getGestorText()}.`;
        if (action === 'UPDATE') return `Atualizou mensagens semanais ${getGestorText()}.`;
        if (action === 'DELETE') return `Excluiu registro de mensagens ${getGestorText()}.`;
        break;
      case 'gestor':
        if (action === 'CREATE') return `Adicionou um novo gestor: ${details.nome || 'N/A'}.`;
        if (action === 'UPDATE') return `Atualizou dados do gestor ${details.nome || 'N/A'}.`;
        break;
      case 'usuario':
      case 'permissao':
        if (action === 'UPDATE') return `Atualizou permissões/dados de usuário.`;
        break;
      case 'LOGIN':
        return 'Realizou login no sistema.';
    }

    // Fallback
    const actionMap: Record<string, string> = {
      'CREATE': 'Criou',
      'UPDATE': 'Atualizou',
      'DELETE': 'Excluiu',
      'LOGIN': 'Login'
    };
    return `${actionMap[action] || action} um item do tipo ${entity}.`;
  };

  const handleExportLogs = () => {
    if (activityLogs.length === 0) {
      toast.error('Não há dados para exportar.');
      return;
    }

    // CSV Headers
    const headers = ['Data', 'Hora', 'Tipo', 'Ação', 'Descrição', 'Detalhes JSON'];

    // Map data
    const rows = activityLogs.map(log => {
      const date = format(new Date(log.created_at), "dd/MM/yyyy", { locale: ptBR });
      const time = format(new Date(log.created_at), "HH:mm:ss", { locale: ptBR });
      const type = log.entity_type;
      const action = log.action_type;
      const description = formatLogMessage(log).replace(/"/g, '""'); // Escape quotes
      const details = JSON.stringify(log.details || {}).replace(/"/g, '""');

      return `"${date}","${time}","${type}","${action}","${description}","${details}"`;
    });

    // Combine
    const csvContent = [headers.join(','), ...rows].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `historico_atividades_${selectedUserId}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const filteredUsers = users.filter(u =>
    u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-8 pt-20 lg:pt-8 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Usuários & Permissões</h1>
            <p className="text-muted-foreground">Gerencie o acesso dos membros da equipe.</p>
          </div>
        </div>

        {[/* Stats Cards - Keeping these as is */]}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card variant="glass">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Usuários</p>
                  <p className="text-3xl font-bold">{users.length}</p>
                </div>
                <Users className="h-10 w-10 text-primary opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card variant="glass">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Administradores</p>
                  <p className="text-3xl font-bold text-primary">
                    {Object.values(userRoles).filter(r => r === 'admin').length}
                  </p>
                </div>
                <Shield className="h-10 w-10 text-primary opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card variant="glass">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Fiscalizadores</p>
                  <p className="text-3xl font-bold text-accent">
                    {Object.values(userRoles).filter(r => r === 'fiscalizador').length}
                  </p>
                </div>
                <Eye className="h-10 w-10 text-accent opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Usuários do Sistema</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar usuário..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Perfil Atual</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((userItem) => (
                  <TableRow key={userItem.id}>
                    <TableCell className="font-medium">{userItem.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{userItem.email}</TableCell>
                    <TableCell>
                      <Badge variant={userRoles[userItem.id] === 'admin' ? 'default' : 'secondary'}>
                        {userRoles[userItem.id] === 'admin' ? 'Administrador' : 'Fiscalizador'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={userItem.ativo ? 'active' : 'paused'}>
                        {userItem.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-2">
                        {userItem.id === user?.id ? (
                          <span className="text-sm text-muted-foreground">Você</span>
                        ) : (
                          <>
                            <Select
                              value={userRoles[userItem.id] || 'fiscalizador'}
                              onValueChange={(value) => handleRoleChange(userItem.id, value as 'admin' | 'fiscalizador')}
                              disabled={updatingUser === userItem.id}
                            >
                              <SelectTrigger className="w-32">
                                {updatingUser === userItem.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <SelectValue />
                                )}
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="fiscalizador">Fiscalizador</SelectItem>
                                <SelectItem value="admin">Administrador</SelectItem>
                              </SelectContent>
                            </Select>

                            {userRoles[userItem.id] === 'fiscalizador' && (
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => openPermissionDialog(userItem.id)}
                                title="Configurar Permissões"
                              >
                                <Lock className="h-4 w-4" />
                              </Button>
                            )}


                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleToggleStatus(userItem.id, userItem.ativo)}
                              disabled={updatingUser === userItem.id}
                              title={userItem.ativo ? 'Desativar Usuário' : 'Ativar Usuário'}
                            >
                              {updatingUser === userItem.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : userItem.ativo ? (
                                <Eye className="h-4 w-4 text-primary" />
                              ) : (
                                <Lock className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>

                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => openActivityLog(userItem.id)}
                              title="Ver Histórico de Atividades"
                            >
                              <History className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum usuário encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={permissionDialogOpen} onOpenChange={setPermissionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Permissões</DialogTitle>
            <DialogDescription>
              Defina o que este fiscalizador pode acessar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="perm-telegram"
                checked={selectedUserPermissions.access_telegram}
                onCheckedChange={(checked) => setSelectedUserPermissions(prev => ({ ...prev, access_telegram: checked as boolean }))}
              />
              <Label htmlFor="perm-telegram">Acesso à Fiscalização Telegram</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="perm-calls"
                checked={selectedUserPermissions.access_calls}
                onCheckedChange={(checked) => setSelectedUserPermissions(prev => ({ ...prev, access_calls: checked as boolean }))}
              />
              <Label htmlFor="perm-calls">Acesso à Fiscalização de Calls</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="perm-rankings"
                checked={selectedUserPermissions.access_rankings}
                onCheckedChange={(checked) => setSelectedUserPermissions(prev => ({ ...prev, access_rankings: checked as boolean }))}
              />
              <Label htmlFor="perm-rankings">Visualizar Rankings e Mensagens</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="perm-dashboard"
                checked={selectedUserPermissions.access_dashboard}
                onCheckedChange={(checked) => setSelectedUserPermissions(prev => ({ ...prev, access_dashboard: checked as boolean }))}
              />
              <Label htmlFor="perm-dashboard">Visualizar Relatórios (Dashboard)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="perm-reports"
                checked={selectedUserPermissions.access_reports}
                onCheckedChange={(checked) => setSelectedUserPermissions(prev => ({ ...prev, access_reports: checked as boolean }))}
              />
              <Label htmlFor="perm-reports">Acesso a Relatórios</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="perm-scales"
                checked={selectedUserPermissions.access_scales}
                onCheckedChange={(checked) => setSelectedUserPermissions(prev => ({ ...prev, access_scales: checked as boolean }))}
              />
              <Label htmlFor="perm-scales">Acesso a Escalas</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermissionDialogOpen(false)}>Cancelar</Button>
            <Button onClick={savePermissions} disabled={savingPermissions}>
              {savingPermissions ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar Permissões
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={activityLogOpen} onOpenChange={setActivityLogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Histórico de Atividades</DialogTitle>
            <DialogDescription>
              Registro de todas as ações realizadas por este usuário.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 flex flex-col gap-4 overflow-hidden pt-4">
            {/* Filters */}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-xs mb-1 block">De</Label>
                <Input
                  type="date"
                  value={logStartDate}
                  onChange={(e) => setLogStartDate(e.target.value)}
                  className="h-8"
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs mb-1 block">Até</Label>
                <Input
                  type="date"
                  value={logEndDate}
                  onChange={(e) => setLogEndDate(e.target.value)}
                  className="h-8"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleExportLogs}
                title="Exportar para CSV"
                disabled={activityLogs.length === 0}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-auto space-y-4 pr-2">

              {loadingLogs ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : activityLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>Nenhuma atividade registrada neste período.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activityLogs.map((log) => (
                    <div key={log.id} className="flex gap-3 p-3 rounded-lg bg-secondary/20 border text-sm items-start">
                      <div className="mt-1 min-w-[80px]">
                        <Badge variant="outline" className="uppercase text-[10px] w-full justify-center">
                          {log.entity_type === 'fiscalizacao' ? 'Fisc.' :
                            log.entity_type === 'mensagem' ? 'Msgs' :
                              log.entity_type}
                        </Badge>
                        <div className="text-[10px] text-muted-foreground text-center mt-1">
                          {format(new Date(log.created_at), "dd/MM", { locale: ptBR })}
                          <br />
                          {format(new Date(log.created_at), "HH:mm", { locale: ptBR })}
                        </div>
                      </div>

                      <div className="flex-1">
                        <p className="text-sm font-medium mb-1">
                          {formatLogMessage(log)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {/* keep detailed json in a tooltip or only if expanded? For now just hide or show specific useful bits if needed, but the requirement is 'descritiva' */}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
