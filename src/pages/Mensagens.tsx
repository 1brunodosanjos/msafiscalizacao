import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import {
  MessageSquare,
  Plus,
  Loader2,
  User,
  Pencil,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import { MONTHS } from '@/lib/constants';
import { logActivity } from '@/lib/activityLogger';


interface Gestor {
  id: string;
  nome: string;
  username_telegram: string | null;
}

interface MensagemSemanal {
  id: string;
  gestor_id: string;
  gestor_nome?: string;
  quantidade_mensagens: number;
  semana_referencia: number;
  mes_referencia: number;
  ano_referencia: number;
  criado_em: string;
}

// MONTHS moved to src/lib/constants.ts


export default function Mensagens() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [gestores, setGestores] = useState<Gestor[]>([]);
  const [mensagens, setMensagens] = useState<MensagemSemanal[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Filters
  const now = new Date();
  const [selectedWeek, setSelectedWeek] = useState(Math.ceil(now.getDate() / 7));
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  // Form
  const [formData, setFormData] = useState({
    gestor_id: '',
    quantidade_mensagens: '0',
    semana_referencia: selectedWeek.toString(),
    mes_referencia: selectedMonth.toString(),
    ano_referencia: selectedYear.toString(),
  });


  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchGestores();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchMensagens();
    }
  }, [user, gestores, selectedWeek, selectedMonth, selectedYear]);



  // Editing & Deleting
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);

  const fetchGestores = async () => {
    const { data } = await (supabase
      .from('gestores') as any)
      .select('id, nome')
      .order('nome');

    if (data) {
      setGestores(data.map(p => ({
        id: p.id,
        nome: p.nome,
        username_telegram: null
      })));
    }
  };

  const getWeekDateRange = (year: number, month: number, week: number) => {
    const startDay = (week - 1) * 7 + 1;
    let endDay = week * 7;

    const lastDayOfMonth = new Date(year, month, 0).getDate();
    if (endDay > lastDayOfMonth || week === 5) {
      endDay = lastDayOfMonth;
    }

    const startDate = new Date(year, month - 1, startDay);
    const endDate = new Date(year, month - 1, endDay);

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    return { start: startDate, end: endDate };
  };

  /* 
    Updated to use reference columns to support backdating. 
    Rankings.tsx also uses these columns for Mensagens.
  */
  /* 
    Updated to use hybrid filtering:
    1. Matches reference columns (for backdated entries)
    2. OR matches created_at date range (for legacy/current entries)
    This ensures ALL records are visible.
  */
  const fetchMensagens = async () => {
    setLoadingData(true);

    // Get date range for the selected week (for created_at fallback)
    const { start, end } = getWeekDateRange(selectedYear, selectedMonth, selectedWeek);

    const { data } = await (supabase
      .from('mensagens_semanais') as any)
      .select('id, gestor_id, quantidade_mensagens, semana_referencia, mes_referencia, ano_referencia, created_at')
      .or(`and(ano_referencia.eq.${selectedYear},mes_referencia.eq.${selectedMonth},semana_referencia.eq.${selectedWeek}),and(created_at.gte.${start.toISOString()},created_at.lte.${end.toISOString()})`)
      .order('created_at', { ascending: false });

    if (data) {
      const mensagensWithGestor = data.map(m => ({
        id: m.id,
        gestor_id: m.gestor_id,
        quantidade_mensagens: m.quantidade_mensagens || 0,
        semana_referencia: m.semana_referencia || 0,
        mes_referencia: m.mes_referencia || 0,
        ano_referencia: m.ano_referencia || 0,
        criado_em: m.created_at || new Date().toISOString(),
        gestor_nome: gestores.find(g => g.id === m.gestor_id)?.nome || 'Desconhecido',
      }));
      setMensagens(mensagensWithGestor);
    }

    setLoadingData(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.gestor_id) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Selecione um gestor.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    const messageData = {
      gestor_id: formData.gestor_id,
      quantidade_mensagens: parseInt(formData.quantidade_mensagens) || 0,
      semana_referencia: parseInt(formData.semana_referencia),
      mes_referencia: parseInt(formData.mes_referencia),
      ano_referencia: parseInt(formData.ano_referencia),
    };

    let error;

    if (editingId) {
      const { error: updateError } = await (supabase
        .from('mensagens_semanais') as any)
        .update(messageData)
        .eq('id', editingId);
      error = updateError;
    } else {
      // Check for existing record
      const { data: existing } = await (supabase
        .from('mensagens_semanais') as any)
        .select('id')
        .eq('gestor_id', messageData.gestor_id)
        .eq('ano_referencia', messageData.ano_referencia)
        .eq('mes_referencia', messageData.mes_referencia)
        .eq('semana_referencia', messageData.semana_referencia);

      if (existing && existing.length > 0) {
        toast({
          title: 'Registro duplicado',
          description: 'Já existe um registro para este gestor nesta semana. Edite o existente.',
          variant: 'destructive',
        });
        setSubmitting(false);
        return;
      }

      const { error: insertError } = await (supabase
        .from('mensagens_semanais') as any)
        .insert(messageData);
      error = insertError;
    }

    if (error) {
      toast({
        title: editingId ? 'Erro ao atualizar' : 'Erro ao registrar',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      const gestorNome = gestores.find(g => g.id === formData.gestor_id)?.nome;
      const total = messageData.quantidade_mensagens;

      toast({
        title: editingId ? 'Registro atualizado!' : 'Mensagens registradas!',
        description: editingId
          ? `Registro de ${gestorNome} atualizado.`
          : `${total} mensagens no total para ${gestorNome}.`,
      });
      resetForm();
      fetchMensagens();

      await logActivity({
        userId: user?.id || '',
        actionType: editingId ? 'UPDATE' : 'CREATE',
        entityType: 'mensagem',
        entityId: editingId || undefined, // ID might not be available for new inserts without returning it, but we can log the details
        details: {
          gestor_id: formData.gestor_id,
          quantidade_mensagens: formData.quantidade_mensagens,
          semana: formData.semana_referencia,
          mes: formData.mes_referencia,
          ano: formData.ano_referencia
        }
      });
    }

    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const resetFormData = () => {
    setFormData({
      gestor_id: '',
      quantidade_mensagens: '0',
      semana_referencia: selectedWeek.toString(),
      mes_referencia: selectedMonth.toString(),
      ano_referencia: selectedYear.toString(),
    });
    setEditingId(null);
  };

  const resetForm = () => {
    resetFormData();
    setDialogOpen(false);
  };

  const handleEditClick = (msg: MensagemSemanal) => {
    setEditingId(msg.id);
    setFormData({
      gestor_id: msg.gestor_id,
      quantidade_mensagens: msg.quantidade_mensagens.toString(),
      semana_referencia: msg.semana_referencia.toString(),
      mes_referencia: msg.mes_referencia.toString(),
      ano_referencia: msg.ano_referencia.toString(),
    });
    setDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setMessageToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!messageToDelete) return;

    const message = mensagens.find(m => m.id === messageToDelete);
    if (!message) return;

    // Optimistic: Remove ALL records that look like this one (duplicates)
    const previousList = [...mensagens];
    setMensagens(current => current.filter(m =>
      !(m.gestor_id === message.gestor_id &&
        m.semana_referencia === message.semana_referencia &&
        m.mes_referencia === message.mes_referencia &&
        m.ano_referencia === message.ano_referencia)
    ));
    setDeleteDialogOpen(false);

    // Delete matching records
    const { error } = await (supabase
      .from('mensagens_semanais') as any)
      .delete()
      .eq('gestor_id', message.gestor_id)
      .eq('semana_referencia', message.semana_referencia)
      .eq('mes_referencia', message.mes_referencia)
      .eq('ano_referencia', message.ano_referencia);

    if (error) {
      console.error('Error deleting:', error);
      toast({
        title: 'Erro de Permissão',
        description: `O banco de dados rejeitou a exclusão. Você provavelmente precisa rodar a migração de permissões. Erro: ${error.message}`,
        variant: 'destructive',
        duration: 8000
      });
      // Revert
      setMensagens(previousList);
    } else {
      toast({
        title: 'Registros excluídos',
        description: 'Registro e duplicatas foram removidos.',
      });

      await logActivity({
        userId: user?.id || '',
        actionType: 'DELETE',
        entityType: 'mensagem',
        entityId: messageToDelete,
        details: {
          gestor_id: message.gestor_id,
          semana: message.semana_referencia
        }
      });
      // We don't fetch immediately to avoid UI flickering, relying on optimistic update
    }
    setMessageToDelete(null);
  };



  return (
    <DashboardLayout>
      <div className="p-4 lg:p-8 pt-20 lg:pt-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Relatórios Semanais</h1>
            <p className="text-muted-foreground">Controle de mensagens enviadas por gestor.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={fetchMensagens}
              className="flex-1 md:flex-none"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loadingData ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button
              variant="hero"
              onClick={() => {
                resetFormData();
                setDialogOpen(true);
              }}
              className="flex-[2] md:flex-none"
            >
              <Plus className="w-4 h-4 mr-2" />
              Lançar Mensagens
            </Button>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          else setDialogOpen(true);
        }}>
          <DialogTrigger asChild>
            {/* This trigger is now redundant as the button above opens the dialog directly */}
            {/* <Button variant="hero" onClick={() => resetForm()}>
                  <Plus className="w-4 h-4" />
                  Registrar Mensagens
                </Button> */}
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Registro' : 'Registrar Mensagens'}</DialogTitle>
              <DialogDescription>
                {editingId ? 'Altere os dados do registro' : 'Informe a quantidade de mensagens'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Gestor *</Label>
                <Select
                  value={formData.gestor_id}
                  onValueChange={(value) => setFormData({ ...formData, gestor_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o gestor" />
                  </SelectTrigger>
                  <SelectContent>
                    {gestores.map((gestor) => (
                      <SelectItem key={gestor.id} value={gestor.id}>
                        {gestor.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MessageSquare className="w-3 h-3 text-muted-foreground" />
                  Quantidade de Mensagens
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.quantidade_mensagens}
                  onChange={(e) => setFormData({ ...formData, quantidade_mensagens: e.target.value })}
                  placeholder="0"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Ano</Label>
                  <Select
                    value={formData.ano_referencia}
                    onValueChange={(value) => setFormData({ ...formData, ano_referencia: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2024, 2025, 2026].map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Mês</Label>
                  <Select
                    value={formData.mes_referencia}
                    onValueChange={(value) => setFormData({ ...formData, mes_referencia: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((month, index) => (
                        <SelectItem key={index + 1} value={(index + 1).toString()}>
                          {month}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Semana</Label>
                  <Select
                    value={formData.semana_referencia}
                    onValueChange={(value) => setFormData({ ...formData, semana_referencia: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((week) => (
                        <SelectItem key={week} value={week.toString()}>
                          Semana {week}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    <>
                      <MessageSquare className="w-4 h-4" />
                      {editingId ? 'Salvar Alterações' : 'Registrar'}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <MonthYearPicker
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onMonthChange={(v) => setSelectedMonth(parseInt(v))}
            onYearChange={(v) => setSelectedYear(parseInt(v))}
          />

          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Semana:</Label>
            <Select
              value={selectedWeek.toString()}
              onValueChange={(v) => setSelectedWeek(parseInt(v))}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((week) => (
                  <SelectItem key={week} value={week.toString()}>
                    Semana {week}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Messages List */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Registros - Semana {selectedWeek}, {MONTHS[selectedMonth - 1]} {selectedYear}</CardTitle>
            <CardDescription>
              Mensagens registradas para o período selecionado
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingData ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : mensagens.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma mensagem registrada para este período</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    resetFormData();
                    setDialogOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4" />
                  Registrar primeira mensagem
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {mensagens.map((msg) => (
                  <Card key={msg.id} className="bg-secondary/30 transition-all hover:bg-secondary/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <User className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{msg.gestor_nome}</p>
                            <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                              <span className="flex items-center gap-1" title="Mensagens">
                                <MessageSquare className="w-3 h-3" /> {msg.quantidade_mensagens} mensagens
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">
                            {msg.quantidade_mensagens}
                          </p>
                          <p className="text-xs text-muted-foreground">total</p>
                        </div>

                        <div className="flex gap-2 ml-4">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditClick(msg)}
                          >
                            <Pencil className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(msg.id)}
                          >
                            <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Tem certeza que deseja excluir este registro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. O registro será removido permanentemente do banco de dados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setMessageToDelete(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
