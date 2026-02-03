import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Users,
  Plus,
  Search,
  MoreVertical,
  Pause,
  Play,
  Pencil,
  Trash2,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  ThumbsUp,
  ThumbsDown,
  LayoutGrid,
  List
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Gestor {
  id: string;
  nome: string;
  username_telegram: string | null;
  status: string;
  observacoes: string | null;
  criado_em: string;

  grupos_calls: string[];
  no_grupo_telegram: boolean;
  setores: string[];
}

export default function Gestores() {
  const { user, profile, signOut, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [gestores, setGestores] = useState<Gestor[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState<'calls' | 'telegram'>('calls');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    username_telegram: '',
    grupos_calls: [] as string[],
    no_grupo_telegram: false,
    setores: [] as string[],
  });
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [gestorToDelete, setGestorToDelete] = useState<Gestor | null>(null);

  // History State
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedGestorHistory, setSelectedGestorHistory] = useState<Gestor | null>(null);
  const [historyData, setHistoryData] = useState({ calls: [] as any[], telegram: [] as any[] });
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Inspection Details State
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<any>(null);

  // Date Filter State
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Filtered Data
  const filteredCalls = historyData.calls.filter(item => {
    if (!dateRange || !dateRange.from) return true;
    const itemDate = new Date(item.date);
    const from = startOfDay(dateRange.from);
    const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
    return isWithinInterval(itemDate, { start: from, end: to });
  });

  const filteredTelegram = historyData.telegram.filter(item => {
    if (!dateRange || !dateRange.from) return true;
    const itemDate = new Date(item.data_evento);
    const from = startOfDay(dateRange.from);
    const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
    return isWithinInterval(itemDate, { start: from, end: to });
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

  const fetchGestores = async () => {
    setLoadingData(true);
    const { data, error } = await (supabase
      .from('gestores') as any)
      .select('*')
      .order('nome');

    if (!error && data) {
      setGestores(data.map(g => ({
        id: g.id,
        nome: g.nome,
        username_telegram: g.username_telegram,
        status: g.ativo ? 'ativo' : 'pausado',
        observacoes: null,
        criado_em: g.created_at,
        grupos_calls: g.grupos_calls || [],
        no_grupo_telegram: g.no_grupo_telegram || false,
        setores: Array.from(new Set([
          ...(g.setores || []),
          g.setor || 'calls',
          ...(g.no_grupo_telegram ? ['telegram'] : [])
        ]))
      })));
    }
    setLoadingData(false);
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      username_telegram: '',
      grupos_calls: [],
      no_grupo_telegram: false,
      setores: [activeTab] // Default to current tab
    });
    setEditingId(null);
    setDialogOpen(false);
  };

  const fetchHistory = async (gestor: Gestor) => {
    setLoadingHistory(true);
    setSelectedGestorHistory(gestor);
    setHistoryOpen(true);

    try {
      const [callsRes, telegramRes] = await Promise.all([
        (supabase.from('inspections') as any)
          .select(`
            *,
            profiles:inspector_id (full_name),
            inspection_items (
              category,
              criterion,
              status,
              observation
            )
          `)
          .eq('manager_id', gestor.id)
          .order('date', { ascending: false }),
        (supabase.from('registros_fiscalizacao') as any).select('*').eq('gestor_id', gestor.id).order('data_evento', { ascending: false })
      ]);

      setHistoryData({
        calls: callsRes.data || [],
        telegram: telegramRes.data || []
      });
    } catch (error) {
      console.error('Error fetching history:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar o histórico.',
        variant: 'destructive'
      });
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleEditClick = (gestor: Gestor) => {
    setEditingId(gestor.id);
    setFormData({
      nome: gestor.nome,
      username_telegram: gestor.username_telegram || '',
      grupos_calls: gestor.grupos_calls || [],
      no_grupo_telegram: gestor.no_grupo_telegram || false,
      setores: gestor.setores || []
    });
    setDialogOpen(true);
  };

  const handleDeleteClick = (gestor: Gestor) => {
    setGestorToDelete(gestor);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const mainSetor = formData.setores.length > 0 ? formData.setores[0] : null;

    const isTelegramMember = formData.setores.includes('telegram');
    const isCallsMember = formData.setores.includes('calls');

    // Legacy mapping: logic to support dual membership via existing columns
    // If has 'calls', Setor = 'calls'. If also has 'telegram', no_grupo_telegram = true.
    // If ONLY 'telegram', Setor = 'telegram'.
    // If nothing, default to 'calls' (safe fallback).
    const derivedSetor = isCallsMember ? 'calls' : (isTelegramMember ? 'telegram' : 'calls');

    if (editingId) {
      // Update existing
      const { error } = await (supabase
        .from('gestores') as any)
        .update({
          nome: formData.nome,
          username_telegram: formData.username_telegram || null,
          no_grupo_telegram: isTelegramMember,
          setor: derivedSetor,
          // setores: formData.setores // Removed to prevent 400 Bad Request (column likely missing)
        })
        .eq('id', editingId);

      if (error) {
        toast({
          title: 'Erro ao atualizar',
          description: error.message,
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Sucesso',
          description: 'Gestor atualizado com sucesso.',
        });
        resetForm();
        fetchGestores();
      }
    } else {
      // Create new
      const { error } = await (supabase
        .from('gestores') as any)
        .insert({
          nome: formData.nome,
          username_telegram: formData.username_telegram || null,
          no_grupo_telegram: isTelegramMember,
          setor: derivedSetor,
          // setores: formData.setores
          // ativo defaults to true
        });

      if (error) {
        toast({
          title: 'Erro ao cadastrar',
          description: error.message,
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Sucesso',
          description: 'Gestor cadastrado com sucesso.',
        });
        resetForm();
        fetchGestores();
      }
    }
    setSubmitting(false);
  };

  /* 
   * Updated confirmDelete to handle CASCADE DELETION manually via frontend
   * because we cannot easily change DB constraints.
   */
  const confirmDelete = async () => {
    if (!gestorToDelete) return;

    console.log(`[Gestores] Iniciando exclusão completa de: ${gestorToDelete.nome} (${gestorToDelete.id})`);

    try {
      // 1. Clean Telegram Fiscalizations
      const { error: rrError } = await (supabase
        .from('registros_fiscalizacao') as any)
        .delete()
        .eq('gestor_id', gestorToDelete.id);

      if (rrError) {
        console.error('Erro ao apagar fiscalizações telegram:', rrError);
        throw new Error(`Erro ao apagar fiscalizações telegram: ${rrError.message}`);
      }

      // 2. Clean Weekly Messages
      const { error: msError } = await (supabase
        .from('mensagens_semanais') as any)
        .delete()
        .eq('gestor_id', gestorToDelete.id);

      if (msError) {
        console.error('Erro ao apagar mensagens:', msError);
        throw new Error(`Erro ao apagar mensagens: ${msError.message}`);
      }

      // 3. Clean Calls (Inspections & Items)
      const { data: inspectionsToDelete, error: fetchError } = await (supabase
        .from('inspections') as any)
        .select('id')
        .eq('manager_id', gestorToDelete.id);

      if (fetchError) {
        console.error('Erro ao buscar fiscalizações calls:', fetchError);
        throw new Error(`Erro ao buscar calls: ${fetchError.message}`);
      }

      if (inspectionsToDelete && inspectionsToDelete.length > 0) {
        const inspectionIds = inspectionsToDelete.map(i => i.id);

        // Delete items first (FK constraint)
        const { error: itemsError } = await (supabase
          .from('inspection_items') as any)
          .delete()
          .in('inspection_id', inspectionIds);

        if (itemsError) throw new Error(`Erro ao limpar itens de calls: ${itemsError.message}`);

        // Delete inspections
        const { error: inspError } = await (supabase
          .from('inspections') as any)
          .delete()
          .in('id', inspectionIds);

        if (inspError) throw new Error(`Erro ao limpar calls: ${inspError.message}`);
      }

      // 4. Finally delete the gestor
      const { error: finalError } = await (supabase
        .from('gestores') as any)
        .delete()
        .eq('id', gestorToDelete.id);

      if (finalError) {
        console.error('Erro final ao apagar gestor:', finalError);
        if (finalError.code === '23503') {
          throw new Error('Erro de dependência: Existem registros vinculados que não puderam ser apagados automaticamente. Verifique logs.');
        }
        throw new Error(`Erro ao excluir gestor: ${finalError.message}`);
      }

      toast({
        title: 'Gestor excluído',
        description: 'Cadastro e todo o histórico foram removidos com sucesso.',
      });

      // Optimistic update
      setGestores(current => current.filter(g => g.id !== gestorToDelete.id));
      await fetchGestores();

    } catch (error: any) {
      console.error('Falha na exclusão:', error);
      toast({
        title: 'Falha na exclusão',
        description: error.message || 'Não foi possível completar a operação.',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setGestorToDelete(null);
    }
  };

  const toggleStatus = async (gestor: Gestor) => {
    const newStatus = gestor.status === 'ativo' ? false : true;
    const { error } = await (supabase
      .from('gestores') as any)
      .update({ ativo: newStatus })
      .eq('id', gestor.id);

    if (error) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Status atualizado',
        description: `${gestor.nome} está agora ${newStatus ? 'ativo' : 'pausado'}.`,
      });
      fetchGestores();
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  // Filter based on the explicit 'setores' column
  const filteredGestores = gestores
    .filter(g => {
      if (activeTab === 'calls') return g.setores?.includes('calls');
      if (activeTab === 'telegram') return g.setores?.includes('telegram');
      return false;
    })
    .filter(g =>
      g.nome.toLowerCase().includes(search.toLowerCase()) ||
      g.username_telegram?.toLowerCase().includes(search.toLowerCase())
    );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-8 pt-20 lg:pt-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gestores</h1>
            <p className="text-muted-foreground">Gerencie a lista de gestores do sistema.</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            if (open) {
              setDialogOpen(true);
            } else {
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Novo Gestor
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? 'Editar Gestor' : 'Cadastrar Gestor'}</DialogTitle>
                <DialogDescription>
                  {editingId ? 'Altere os dados do gestor.' : 'Adicione um novo gestor para ser avaliado no sistema.'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome completo *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Nome do gestor"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Setor *</Label>
                  <div className="flex gap-4 border rounded-md p-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="setor-calls"
                        checked={formData.setores.includes('calls')}
                        onCheckedChange={(checked) => {
                          if (checked) setFormData({ ...formData, setores: [...formData.setores, 'calls'] });
                          else setFormData({ ...formData, setores: formData.setores.filter(s => s !== 'calls') });
                        }}
                      />
                      <Label htmlFor="setor-calls" className="font-normal cursor-pointer">Calls</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="setor-telegram"
                        checked={formData.setores.includes('telegram')}
                        onCheckedChange={(checked) => {
                          if (checked) setFormData({ ...formData, setores: [...formData.setores, 'telegram'] });
                          else setFormData({ ...formData, setores: formData.setores.filter(s => s !== 'telegram') });
                        }}
                      />
                      <Label htmlFor="setor-telegram" className="font-normal cursor-pointer">Telegram</Label>
                    </div>

                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telegram">Username Telegram</Label>
                  <Input
                    id="telegram"
                    value={formData.username_telegram}
                    onChange={(e) => setFormData({ ...formData, username_telegram: e.target.value })}
                    placeholder="@username"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Grupos de Calls</Label>
                  <div className="grid grid-cols-2 gap-2 border rounded-md p-3">
                    {['Grupo Geral', 'Grupo Start', 'Grupo Vip', 'Grupo Premium', 'Grupo Elite'].map((grupo) => (
                      <div key={grupo} className="flex items-center space-x-2">
                        <Checkbox
                          id={`grupo-${grupo}`}
                          checked={formData.grupos_calls.includes(grupo)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFormData({ ...formData, grupos_calls: [...formData.grupos_calls, grupo] });
                            } else {
                              setFormData({ ...formData, grupos_calls: formData.grupos_calls.filter(g => g !== grupo) });
                            }
                          }}
                        />
                        <Label htmlFor={`grupo-${grupo}`} className="text-sm font-normal cursor-pointer">{grupo}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="ghost" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Salvando...' : (editingId ? 'Salvar Alterações' : 'Cadastrar')}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Dialog open={historyOpen} onOpenChange={(open) => {
          setHistoryOpen(open);
          if (!open) {
            setDateRange(undefined);
          }
        }}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Histórico: {selectedGestorHistory?.nome}</DialogTitle>
              <DialogDescription>
                Visualize o histórico completo de calls e registros do Telegram.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-2 py-4 px-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-[240px] justify-start text-left font-normal",
                      !dateRange && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "dd/MM/y", { locale: ptBR })} -{" "}
                          {format(dateRange.to, "dd/MM/y", { locale: ptBR })}
                        </>
                      ) : (
                        format(dateRange.from, "dd/MM/y", { locale: ptBR })
                      )
                    ) : (
                      <span>Selecione um período</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
              {dateRange && (
                <Button variant="ghost" onClick={() => setDateRange(undefined)} size="sm" className="h-8">
                  Limpar filtro
                </Button>
              )}
            </div>

            {loadingHistory ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <>
                {selectedGestorHistory?.setores?.includes('calls') && selectedGestorHistory?.setores?.includes('telegram') ? (
                  <Tabs defaultValue="telegram" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="telegram">Telegram ({filteredTelegram.length})</TabsTrigger>
                      <TabsTrigger value="calls">Calls ({filteredCalls.length})</TabsTrigger>
                    </TabsList>
                    <TabsContent value="telegram" className="space-y-4 pt-4">
                      {filteredTelegram.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">Nenhum registro encontrado.</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Data</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead>Categoria</TableHead>
                              <TableHead>Qtd</TableHead>
                              <TableHead>Observação</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredTelegram.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell>{format(new Date(item.data_evento + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                                <TableCell>
                                  <Badge variant={item.tipo === 'positivo' ? 'success' : 'destructive'} className="capitalize">
                                    {item.tipo}
                                  </Badge>
                                </TableCell>
                                <TableCell>{item.categoria}</TableCell>
                                <TableCell>{item.quantidade}</TableCell>
                                <TableCell className="max-w-xs truncate" title={item.observacao}>
                                  {item.observacao || '-'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </TabsContent>
                    <TabsContent value="calls" className="space-y-4 pt-4">
                      {filteredCalls.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">Nenhuma call registrada.</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Data</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Duração</TableHead>
                              <TableHead>Pontos (Pos/Neg)</TableHead>
                              <TableHead></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredCalls.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="whitespace-nowrap">
                                  {format(new Date(item.date + 'T12:00:00'), 'dd/MM/yyyy')}
                                </TableCell>
                                <TableCell>
                                  {item.is_cancelled ? (
                                    <Badge variant="destructive">Cancelada</Badge>
                                  ) : (
                                    <Badge variant="success">Realizada</Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {item.start_time ? (
                                    <span className="text-xs font-mono">
                                      {item.start_time.slice(0, 5)} - {item.end_time?.slice(0, 5) || '?'}
                                    </span>
                                  ) : (
                                    item.duration || '-'
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {item.inspection_items?.slice(0, 2).map((p: any, idx: number) => (
                                      <Badge
                                        key={idx}
                                        variant={p.status === 'positive' ? 'success' : 'destructive'}
                                        className="text-xs whitespace-nowrap"
                                        title={p.observation}
                                      >
                                        {p.criterion || p.category}
                                      </Badge>
                                    ))}
                                    {(item.inspection_items?.length || 0) > 2 && (
                                      <Badge variant="outline" className="text-xs whitespace-nowrap bg-muted/50">
                                        +{(item.inspection_items?.length || 0) - 2}
                                      </Badge>
                                    )}
                                    {(!item.inspection_items || item.inspection_items.length === 0) && '-'}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-xs text-muted-foreground hover:text-primary"
                                    onClick={() => {
                                      setSelectedInspection(item);
                                      setDetailsOpen(true);
                                    }}
                                  >
                                    <Eye className="w-3 h-3 mr-2" />
                                    Ver mais detalhes
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </TabsContent>
                  </Tabs>
                ) : selectedGestorHistory?.setores?.includes('telegram') ? (
                  <div className="space-y-4 pt-4">
                    <h3 className="font-medium text-lg mb-4">Histórico Telegram ({filteredTelegram.length})</h3>
                    {filteredTelegram.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">Nenhum registro encontrado.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead>Qtd</TableHead>
                            <TableHead>Observação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredTelegram.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{format(new Date(item.data_evento + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                              <TableCell>
                                <Badge variant={item.tipo === 'positivo' ? 'success' : 'destructive'} className="capitalize">
                                  {item.tipo}
                                </Badge>
                              </TableCell>
                              <TableCell>{item.categoria}</TableCell>
                              <TableCell>{item.quantidade}</TableCell>
                              <TableCell className="max-w-xs truncate" title={item.observacao}>
                                {item.observacao || '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4 pt-4">
                    <h3 className="font-medium text-lg mb-4">Histórico Calls ({filteredCalls.length})</h3>
                    {filteredCalls.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">Nenhuma call registrada.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Duração</TableHead>
                            <TableHead>Pontos (Pos/Neg)</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredCalls.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="whitespace-nowrap">
                                {format(new Date(item.date + 'T12:00:00'), 'dd/MM/yyyy')}
                              </TableCell>
                              <TableCell>
                                {item.is_cancelled ? (
                                  <Badge variant="destructive">Cancelada</Badge>
                                ) : (
                                  <Badge variant="success">Realizada</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {item.start_time ? (
                                  <span className="text-xs font-mono">
                                    {item.start_time.slice(0, 5)} - {item.end_time?.slice(0, 5) || '?'}
                                  </span>
                                ) : (
                                  item.duration || '-'
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {item.inspection_items?.slice(0, 2).map((p: any, idx: number) => (
                                    <Badge
                                      key={idx}
                                      variant={p.status === 'positive' ? 'success' : 'destructive'}
                                      className="text-xs whitespace-nowrap"
                                      title={p.observation}
                                    >
                                      {p.criterion || p.category}
                                    </Badge>
                                  ))}
                                  {(item.inspection_items?.length || 0) > 2 && (
                                    <Badge variant="outline" className="text-xs whitespace-nowrap bg-muted/50">
                                      +{(item.inspection_items?.length || 0) - 2}
                                    </Badge>
                                  )}
                                  {(!item.inspection_items || item.inspection_items.length === 0) && '-'}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-xs text-muted-foreground hover:text-primary"
                                  onClick={() => {
                                    setSelectedInspection(item);
                                    setDetailsOpen(true);
                                  }}
                                >
                                  <Eye className="w-3 h-3 mr-2" />
                                  Ver mais detalhes
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Tabs - Setores */}
        <div className="flex border-b w-full">
          <button
            className={`px-4 py-2 font-medium text-sm transition-colors relative ${activeTab === 'calls' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('calls')}
          >
            Gestores de Call
            {activeTab === 'calls' && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary" />
            )}
          </button>
          <button
            className={`px-4 py-2 font-medium text-sm transition-colors relative ${activeTab === 'telegram' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('telegram')}
          >
            Gestores do Telegram
            {activeTab === 'telegram' && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary" />
            )}
          </button>

        </div>

        {/* Search and View Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar gestor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg border">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setViewMode('grid')}
              title="Visualização em Grade"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setViewMode('list')}
              title="Visualização em Lista"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Gestores List/Grid */}
        {loadingData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : filteredGestores.length === 0 ? (
          <Card variant="glass" className="p-12 text-center">
            <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">
              {search ? 'Nenhum gestor encontrado' : `Nenhum gestor de ${activeTab === 'calls' ? 'Call' : 'Telegram'} cadastrado`}
            </h3>
            <p className="text-muted-foreground mb-4">
              {search ? 'Tente outra busca' : 'Comece cadastrando o primeiro gestor'}
            </p>
            {!search && (
              <Button variant="outline" onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4" />
                Cadastrar Gestor
              </Button>
            )}
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGestores.map((gestor) => (
              <Card
                key={gestor.id}
                variant="interactive"
                className="relative text-left cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fetchHistory(gestor)}
              >
                <CardHeader className="pb-3 text-left">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                        <span className="text-lg font-semibold">
                          {gestor.nome.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <CardTitle className="text-base text-left">{gestor.nome}</CardTitle>
                        {gestor.username_telegram && (
                          <p className="text-sm text-muted-foreground">@{gestor.username_telegram}</p>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditClick(gestor)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleStatus(gestor)}>
                          {gestor.status === 'ativo' ? (
                            <>
                              <Pause className="w-4 h-4 mr-2" />
                              Pausar
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 mr-2" />
                              Ativar
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDeleteClick(gestor)} className="text-destructive focus:text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="text-left">
                  <div className="flex items-center gap-2">
                    <Badge variant={gestor.status === 'ativo' ? 'active' : 'paused'}>
                      {gestor.status === 'ativo' ? 'Ativo' : 'Pausado'}
                    </Badge>
                  </div>
                  {gestor.observacoes && (
                    <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                      {gestor.observacoes}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGestores.map((gestor) => (
                  <TableRow key={gestor.id} className="cursor-pointer hover:bg-muted/50" onClick={() => fetchHistory(gestor)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                          <span className="text-xs font-semibold">{gestor.nome.charAt(0).toUpperCase()}</span>
                        </div>
                        <span className="font-medium">{gestor.nome}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {gestor.username_telegram ? (
                        <span className="text-muted-foreground">@{gestor.username_telegram}</span>
                      ) : (
                        <span className="text-muted-foreground/50">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={gestor.status === 'ativo' ? 'active' : 'paused'}>
                        {gestor.status === 'ativo' ? 'Ativo' : 'Pausado'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditClick(gestor)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleStatus(gestor)}>
                            {gestor.status === 'ativo' ? (
                              <>
                                <Pause className="w-4 h-4 mr-2" />
                                Pausar
                              </>
                            ) : (
                              <>
                                <Play className="w-4 h-4 mr-2" />
                                Ativar
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDeleteClick(gestor)} className="text-destructive focus:text-destructive">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Delete Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Gestor?</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir <strong>{gestorToDelete?.nome}</strong>?
                <br /><br />
                <span className="text-destructive font-medium">CUIDADO:</span> Esta ação apagará permanentemente <strong>todo o histórico</strong> de fiscalizações, calls e mensagens deste gestor. Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setGestorToDelete(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* DETAILS DIALOG */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Search className="w-5 h-5 text-primary" />
                Detalhes da Fiscalização
              </DialogTitle>
              <DialogDescription>
                Análise detalhada do registro de call.
              </DialogDescription>
            </DialogHeader>

            {selectedInspection && (
              <div className="space-y-6 pt-2">
                {/* Header Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="border rounded-lg p-3 bg-muted/20">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <Calendar className="w-3 h-3" /> Data
                    </div>
                    <div className="font-semibold">{format(new Date(selectedInspection.date + 'T12:00:00'), 'dd/MM/yyyy')}</div>
                  </div>
                  <div className="border rounded-lg p-3 bg-muted/20">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <Clock className="w-3 h-3" /> Duração
                    </div>
                    <div className="font-semibold">
                      {selectedInspection.start_time ? (
                        <span className="font-mono text-sm">
                          {selectedInspection.start_time.slice(0, 5)} - {selectedInspection.end_time?.slice(0, 5) || '?'}
                        </span>
                      ) : (
                        selectedInspection.duration || '-'
                      )}
                    </div>
                  </div>
                  <div className="border rounded-lg p-3 bg-muted/20">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <CheckCircle2 className="w-3 h-3" /> Status
                    </div>
                    <div>
                      {selectedInspection.is_cancelled ? (
                        <Badge variant="destructive" className="h-5 text-[10px]">Cancelada</Badge>
                      ) : (
                        <Badge variant="success" className="h-5 text-[10px]">Realizada</Badge>
                      )}
                    </div>
                  </div>
                  <div className="border rounded-lg p-3 bg-muted/20">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <Users className="w-3 h-3" /> Fiscal
                    </div>
                    <div className="font-semibold text-sm truncate" title={selectedInspection.profiles?.full_name}>
                      {selectedInspection.profiles?.full_name || 'Desconhecido'}
                    </div>
                  </div>
                </div>

                {/* Call Group Info */}
                {selectedInspection.call_group && selectedInspection.call_group.length > 0 && (
                  <div className="border rounded-lg p-3 bg-primary/5 border-primary/10">
                    <div className="flex items-center gap-2 text-primary/80 text-xs mb-1 font-medium">
                      <LayoutGrid className="w-3 h-3" /> Call Selecionada / Grupo
                    </div>
                    <div className="font-semibold text-primary">
                      {selectedInspection.call_group.join(', ')}
                    </div>
                  </div>
                )}

                {/* Cancellation Alert */}
                {selectedInspection.is_cancelled && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-destructive text-sm">Motivo do Cancelamento</h4>
                      <p className="text-sm text-destructive/80 mt-1">{selectedInspection.cancellation_reason}</p>
                    </div>
                  </div>
                )}

                {/* General Observation */}
                {selectedInspection.observation && (
                  <div className="bg-secondary/20 border border-border rounded-lg p-4">
                    <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary" /> Observações Gerais
                    </h4>
                    <p className="text-sm text-muted-foreground">{selectedInspection.observation}</p>
                  </div>
                )}

                {/* Points Analysis */}
                {!selectedInspection.is_cancelled && selectedInspection.inspection_items && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Negatives */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b border-destructive/20">
                        <ThumbsDown className="w-4 h-4 text-destructive" />
                        <h4 className="font-semibold text-sm text-destructive">Pontos Negativos</h4>
                      </div>
                      <div className="space-y-2">
                        {selectedInspection.inspection_items.filter((i: any) => i.status === 'negative').length === 0 ? (
                          <p className="text-sm text-muted-foreground italic">Nenhum ponto negativo registrado.</p>
                        ) : (
                          selectedInspection.inspection_items
                            .filter((i: any) => i.status === 'negative')
                            .map((item: any, idx: number) => (
                              <div key={idx} className="bg-destructive/5 border border-destructive/10 rounded p-2 text-sm">
                                <div className="flex justify-between font-medium text-destructive">
                                  <span>{item.criterion || item.category}</span>
                                </div>
                                {item.observation && (
                                  <p className="text-muted-foreground text-xs mt-1 border-t border-destructive/10 pt-1">
                                    {item.observation}
                                  </p>
                                )}
                              </div>
                            ))
                        )}
                      </div>
                    </div>

                    {/* Positives */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b border-success/20">
                        <ThumbsUp className="w-4 h-4 text-success" />
                        <h4 className="font-semibold text-sm text-success">Pontos Positivos</h4>
                      </div>
                      <div className="space-y-2">
                        {selectedInspection.inspection_items.filter((i: any) => i.status === 'positive').length === 0 ? (
                          <p className="text-sm text-muted-foreground italic">Nenhum ponto positivo registrado.</p>
                        ) : (
                          selectedInspection.inspection_items
                            .filter((i: any) => i.status === 'positive')
                            .map((item: any, idx: number) => (
                              <div key={idx} className="bg-success/5 border border-success/10 rounded p-2 text-sm">
                                <div className="flex justify-between font-medium text-success">
                                  <span>{item.criterion || item.category}</span>
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout >
  );
}
