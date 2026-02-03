import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Eye,
  Loader2,
  Trash2,
  ThumbsUp,
  ThumbsDown,
  Download,
  RefreshCw,
  Plus,
  User,
  ListFilter,
  Pencil,
  ArrowLeft,
  CalendarOff
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { ExportDataDialog } from '@/components/fiscalizacao/ExportDataDialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MONTHS } from '@/lib/constants';
import { logActivity } from '@/lib/activityLogger';


interface Gestor {
  id: string;
  nome: string;
  username_telegram: string | null;
  status: string;
  no_grupo_telegram: boolean | null;
}
interface PontoSelecionado {
  tipo: 'positivo' | 'negativo';
  categoria: string;
  observacao: string;
  quantidade: number;
}

interface InspectionGroup {
  id: string; // Composite key: gestorId-date-inspectorId
  gestor_id: string;
  gestor_nome: string;
  data_evento: string;
  criado_por: string;
  inspector_name: string;
  pontos_positivos: number;
  pontos_negativos: number;
  score: number;
  raw_items: any[];
}

const CATEGORIAS_POSITIVAS = [
  'Continuação de atendimento',
  'Elogios',
  'Sem ausências durante o dia',
];

const CATEGORIAS_NEGATIVAS = [
  'Atrasos',
  'Saiu sem avisar 10 min',
  'Pulo de mensagem',
  'Resposta sem nexo',
  'Curtiu mensagem e não respondeu',
  'Não pesquisou e respondeu atendimento de outro',
  'Pulou @ de gestor em pausa',
  'Marcar gestor em pausa',
  'Resposta duplicada',
  'Mensagens avulsas ou apagadas',
];

// MONTHS moved to src/lib/constants.ts


export default function Fiscalizacao() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [gestores, setGestores] = useState<Gestor[]>([]);
  const [inspections, setInspections] = useState<InspectionGroup[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [open, setOpen] = useState(false);

  // Filters
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  // const [filterGestorId, setFilterGestorId] = useState<string>('all'); // Removed duplicate
  const [filterGestorId, setFilterGestorId] = useState<string>('all');
  const [filterInspectorId, setFilterInspectorId] = useState<string>('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState<Date | undefined>(undefined);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null); // Composite Key
  const [gestorId, setGestorId] = useState('');
  const [dataEvento, setDataEvento] = useState(new Date().toISOString().split('T')[0]);
  const [pontosSelecionados, setPontosSelecionados] = useState<PontoSelecionado[]>([]);

  const [observacoes, setObservacoes] = useState<Record<string, string>>({});

  // Absence State
  const [naoTrabalhou, setNaoTrabalhou] = useState(false);
  const [motivoAusencia, setMotivoAusencia] = useState('');

  // Delete State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [inspectionToDelete, setInspectionToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchGestores();
      fetchInspections();
    }
  }, [user, selectedMonth, selectedYear, selectedDateFilter]);

  const fetchGestores = async () => {
    setLoadingData(true);
    const { data, error } = await supabase
      .from('gestores')
      .select('id, nome, ativo, username_telegram, no_grupo_telegram')
      .order('nome');

    if (!error && data) {
      setGestores((data as any[]).map(p => ({
        id: p.id,
        nome: p.nome,
        username_telegram: p.username_telegram,
        status: p.ativo ? 'ativo' : 'pausado',
        no_grupo_telegram: p.no_grupo_telegram
      })));
    }
    setLoadingData(false);
  };

  const fetchInspections = async () => {
    setLoadingList(true);
    // Date range logic
    let startDateStr, endDateStr;

    if (selectedDateFilter) {
      // Use YYYY-MM-DD format for specific date query
      const year = selectedDateFilter.getFullYear();
      const month = String(selectedDateFilter.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDateFilter.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;

      startDateStr = formattedDate;
      endDateStr = formattedDate;
    } else {
      const startDate = new Date(selectedYear, selectedMonth - 1, 1);
      const endDate = new Date(selectedYear, selectedMonth, 0);
      startDateStr = startDate.toISOString().split('T')[0];
      endDateStr = endDate.toISOString().split('T')[0];
    }

    // Fetch raw records
    const { data, error } = await supabase
      .from('registros_fiscalizacao')
      .select(`
        *,
        gestores (id, nome),
        profiles:criado_por (id, full_name)
      `)
      .gte('data_evento', startDateStr)
      .lte('data_evento', endDateStr)
      .order('data_evento', { ascending: false });

    if (error) {
      console.error('Error fetching inspections:', error);
      toast({
        title: 'Erro ao carregar histórico',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      // Group records by (gestor_id + data_evento + criado_por)
      const grouped = groupInspections(data || []);
      setInspections(grouped);
    }
    setLoadingList(false);
  };

  const groupInspections = (data: any[]): InspectionGroup[] => {
    const groups: Record<string, InspectionGroup> = {};

    data.forEach(item => {
      // Create a unique key for the "Fiscalization Event"
      const key = `${item.gestor_id}-${item.data_evento}-${item.criado_por}`;

      if (!groups[key]) {
        groups[key] = {
          id: key,
          gestor_id: item.gestor_id,
          gestor_nome: item.gestores?.nome || 'Desconhecido',
          data_evento: item.data_evento,
          criado_por: item.criado_por,
          inspector_name: item.profiles?.full_name || 'Sistema',
          pontos_positivos: 0,
          pontos_negativos: 0,
          score: 0,
          raw_items: []
        };
      }

      groups[key].raw_items.push(item);
      if (item.tipo === 'positivo') {
        groups[key].pontos_positivos += (item.quantidade || 0);
        groups[key].score += (item.quantidade || 0);
      } else {
        groups[key].pontos_negativos += (item.quantidade || 0);
        groups[key].score -= (item.quantidade || 0);
      }
    });

    return Object.values(groups).sort((a, b) =>
      new Date(b.data_evento).getTime() - new Date(a.data_evento).getTime()
    );
  };

  const uniqueInspectors = Array.from(new Set(inspections.map(i => JSON.stringify({ id: i.criado_por, nome: i.inspector_name }))))
    .map(s => JSON.parse(s));

  const filteredInspections = inspections.filter(group => {
    if (filterGestorId !== 'all' && group.gestor_id !== filterGestorId) return false;
    if (filterInspectorId !== 'all' && group.criado_por !== filterInspectorId) return false;
    return true;
  });

  const togglePonto = (tipo: 'positivo' | 'negativo', categoria: string) => {
    const exists = pontosSelecionados.find(p => p.tipo === tipo && p.categoria === categoria);

    if (exists) {
      setPontosSelecionados(pontosSelecionados.filter(p => !(p.tipo === tipo && p.categoria === categoria)));
      const newObs = { ...observacoes };
      delete newObs[`${tipo}-${categoria}`];
      setObservacoes(newObs);
    } else {
      setPontosSelecionados([...pontosSelecionados, { tipo, categoria, observacao: '', quantidade: 1 }]);
    }
  };

  const isPontoSelecionado = (tipo: 'positivo' | 'negativo', categoria: string) => {
    return pontosSelecionados.some(p => p.tipo === tipo && p.categoria === categoria);
  };

  const updateObservacao = (tipo: 'positivo' | 'negativo', categoria: string, obs: string) => {
    setObservacoes({ ...observacoes, [`${tipo}-${categoria}`]: obs });
  };

  const updateQuantidade = (tipo: 'positivo' | 'negativo', categoria: string, qtd: number) => {
    setPontosSelecionados(prev => prev.map(p =>
      (p.tipo === tipo && p.categoria === categoria) ? { ...p, quantidade: Math.max(1, qtd) } : p
    ));
  };

  const getObservacao = (tipo: 'positivo' | 'negativo', categoria: string) => {
    return observacoes[`${tipo}-${categoria}`] || '';
  };

  const resetForm = () => {
    setEditingId(null);
    setGestorId('');
    // Keep date or reset to today? keeping current selection seems friendlier
    // setDataEvento(new Date().toISOString().split('T')[0]); 
    setPontosSelecionados([]);
    setObservacoes({});
    setNaoTrabalhou(false);
    setMotivoAusencia('');
    setShowPreview(false);
  };

  const handleEdit = (group: InspectionGroup) => {
    setEditingId(group.id);
    setGestorId(group.gestor_id);
    setDataEvento(group.data_evento);

    // Reconstruct selection state from raw items
    const newPontos: PontoSelecionado[] = [];
    const newObs: Record<string, string> = {};

    group.raw_items.forEach(item => {
      newPontos.push({
        tipo: item.tipo,
        categoria: item.categoria,
        observacao: item.observacao || '',
        quantidade: item.quantidade || 1
      });
      if (item.observacao) {
        newObs[`${item.tipo}-${item.categoria}`] = item.observacao;
      }

      // Check for Absence
      if (item.categoria === 'Não Trabalhou') {
        setNaoTrabalhou(true);
        setMotivoAusencia(item.observacao || '');
      }
    });

    setPontosSelecionados(newPontos);
    setObservacoes(newObs);

    // Scroll to top to see form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Toggle Absence Mode
  const handleNaoTrabalhouChange = (checked: boolean) => {
    setNaoTrabalhou(checked);
    if (checked) {
      setPontosSelecionados([]);
      setObservacoes({});
    }
  };

  const handleDelete = (id: string) => {
    setInspectionToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!inspectionToDelete) return;

    // Find the group to get query parameters
    const group = inspections.find(i => i.id === inspectionToDelete);
    if (!group) return;

    // Optimistic UI update
    setInspections(current => current.filter(i => i.id !== inspectionToDelete));
    setDeleteDialogOpen(false);

    setLoadingList(true);
    // Delete all records matching these IDs explicitly (safer and more precise)
    const idsToDelete = group.raw_items.map(item => item.id);

    const { error } = await supabase
      .from('registros_fiscalizacao')
      .delete()
      .in('id', idsToDelete);

    if (error) {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
      // Revert if error
      fetchInspections();
    } else {
      toast({
        title: 'Fiscalização excluída',
        description: 'Registros removidos com sucesso.',
      });

      await logActivity({
        userId: user?.id || '',
        actionType: 'DELETE',
        entityType: 'fiscalizacao',
        entityId: inspectionToDelete,
        details: {
          gestor_id: group.gestor_id,
          data_evento: group.data_evento,
          deleted_at: new Date().toISOString()
        }
      });
      // fetchInspections(); // Not needed if success
    }

    setInspectionToDelete(null);
    setLoadingList(false);
  };

  const handlePreview = () => {
    if (!gestorId) {
      toast({
        title: 'Selecione um gestor',
        description: 'É necessário selecionar o gestor fiscalizado.',
        variant: 'destructive',
      });
      return;
    }

    if (!naoTrabalhou && pontosSelecionados.length === 0) {
      toast({
        title: 'Selecione ao menos um ponto',
        description: 'Marque pelo menos um ponto positivo ou negativo, ou indique que não trabalhou.',
        variant: 'destructive',
      });
      return;
    }

    if (naoTrabalhou && !motivoAusencia.trim()) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Por favor, informe o motivo do colaborador não ter trabalhado.',
        variant: 'destructive',
      });
      return;
    }

    setShowPreview(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);

    const eventDate = new Date(dataEvento);
    const weekNumber = Math.ceil(eventDate.getDate() / 7);
    const monthNumber = eventDate.getMonth() + 1;

    try {
      let inspectionId = editingId;

      // If editing, delete previous records first (to handle removed points cleanly)
      if (editingId) {
        const group = inspections.find(i => i.id === editingId);
        if (group) {
          const { error: deleteError } = await supabase
            .from('registros_fiscalizacao')
            .delete()
            .eq('gestor_id', group.gestor_id)
            .eq('data_evento', group.data_evento)
            .eq('criado_por', group.criado_por);

          if (deleteError) throw deleteError;
        }
      }

      // Insert new records
      const registros = pontosSelecionados.map(ponto => ({
        gestor_id: gestorId,
        tipo: ponto.tipo,
        categoria: ponto.categoria,
        observacao: getObservacao(ponto.tipo, ponto.categoria) || null,
        quantidade: ponto.quantidade || 1,
        data_evento: dataEvento,
        semana_referencia: weekNumber,
        mes_referencia: monthNumber,
        ano_referencia: eventDate.getFullYear(),
        criado_por: user?.id,
      }));

      // Override if "Não Trabalhou"
      let registrosFinal = registros;
      if (naoTrabalhou) {
        registrosFinal = [{
          gestor_id: gestorId,
          tipo: 'negativo',
          categoria: 'Não Trabalhou',
          observacao: motivoAusencia,
          quantidade: 1,
          data_evento: dataEvento,
          semana_referencia: weekNumber,
          mes_referencia: monthNumber,
          ano_referencia: eventDate.getFullYear(),
          criado_por: user?.id,
        }];
      }

      const { error } = await supabase.from('registros_fiscalizacao').insert(registrosFinal as any);

      if (error) throw error;

      toast({
        title: editingId ? 'Fiscalização atualizada!' : 'Fiscalização registrada!',
        description: naoTrabalhou
          ? `Ausência registrada para ${gestorSelecionado?.nome}.`
          : `${pontosSelecionados.length} ponto(s) salvos para ${gestorSelecionado?.nome}.`,
      });

      await logActivity({
        userId: user?.id || '',
        actionType: editingId ? 'UPDATE' : 'CREATE',
        entityType: 'fiscalizacao',
        entityId: editingId || undefined,
        details: {
          gestor_id: gestorId,
          data_evento: dataEvento,
          pontos_positivos: naoTrabalhou ? 0 : pontosPositivos.length,
          pontos_negativos: naoTrabalhou ? 1 : pontosNegativos.length,
          nao_trabalhou: naoTrabalhou
        }
      });

      resetForm();
      fetchInspections(); // Refresh list

    } catch (error: any) {
      console.error('Error saving:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const pontosNegativos = pontosSelecionados.filter(p => p.tipo === 'negativo');
  const pontosPositivos = pontosSelecionados.filter(p => p.tipo === 'positivo');

  const eventDate = new Date(dataEvento);
  const weekNumber = Math.ceil(eventDate.getDate() / 7);
  const monthNumber = eventDate.getMonth() + 1;

  const gestorSelecionado = gestores.find(g => g.id === gestorId);

  const isAdmin = profile?.role === 'admin';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // ... (existing code) ...

  const handleExport = async (startDate: string, endDate: string, formatType: 'pdf' | 'csv') => {
    try {
      // 1. Fetch data for the range
      const { data: exportData, error } = await supabase
        .from('registros_fiscalizacao')
        .select(`
          *,
          gestores (id, nome),
          profiles:criado_por (id, full_name)
        `)
        .gte('data_evento', startDate)
        .lte('data_evento', endDate)
        .order('data_evento', { ascending: false });

      if (error) throw error;
      if (!exportData || exportData.length === 0) {
        toast({
          title: 'Sem dados',
          description: 'Nenhum registro encontrado para o período selecionado.',
          variant: 'destructive',
        });
        return;
      }

      // 2. Aggregate data by Gestor
      const gestorStats: Record<string, any> = {};

      (exportData as any[] || []).forEach((item: any) => {
        const gestorId = item.gestor_id;
        const gestorName = item.gestores?.nome || 'Desconhecido';

        if (!gestorStats[gestorId]) {
          gestorStats[gestorId] = {
            name: gestorName,
            totalScore: 0,
            positives: 0,
            negatives: 0,
            items: [],
          };
        }

        const stats = gestorStats[gestorId];

        // Basic stats
        // Recalculate score from items if needed, or use stored heuristic if reliable. 
        // For 'registros_fiscalizacao', we derived score from type.
        // Assuming 'tipo' is 'positivo' or 'negativo'
        if ((item as any).tipo === 'positivo') {
          stats.positives++;
          stats.totalScore++;
        } else {
          stats.negatives++;
          stats.totalScore--;
        }

        // Collect details for deeper analysis if we want top points
        stats.items.push(item);
      });

      const reportTitle = `Relatório de Fiscalização - ${format(new Date(startDate), 'dd/MM/yyyy')} a ${format(new Date(endDate), 'dd/MM/yyyy')}`;

      if (formatType === 'csv') {
        const csvRows = [
          ['Gestor', 'Pontuação Total', 'Qtd. Positivos', 'Qtd. Negativos', 'Categorias Principais (Neg)', 'Categorias Principais (Pos)']
        ];

        Object.values(gestorStats).forEach((stat: any) => {
          // Analyze categories
          const catCounts: Record<string, number> = {};
          stat.items.forEach((i: any) => {
            const key = `${i.tipo === 'positivo' ? '+' : '-'}${i.categoria}`;
            catCounts[key] = (catCounts[key] || 0) + 1;
          });

          const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
          const topNeg = sortedCats.filter(c => c[0].startsWith('-')).slice(0, 3).map(c => `${c[0].substring(1)} (${c[1]})`).join('; ');
          const topPos = sortedCats.filter(c => c[0].startsWith('+')).slice(0, 3).map(c => `${c[0].substring(1)} (${c[1]})`).join('; ');

          csvRows.push([
            `"${stat.name}"`,
            stat.totalScore.toString(),
            stat.positives.toString(),
            stat.negatives.toString(),
            `"${topNeg}"`,
            `"${topPos}"`
          ]);
        });

        const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `fiscalizacao_${startDate}_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

      } else {
        // PDF Generation
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text(reportTitle, 14, 22);

        doc.setFontSize(11);
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 30);

        const tableBody = Object.values(gestorStats).map((stat: any) => {
          // Analyze categories
          const catCounts: Record<string, number> = {};
          stat.items.forEach((i: any) => {
            const key = `${i.tipo === 'positivo' ? '+' : '-'}${i.categoria}`;
            catCounts[key] = (catCounts[key] || 0) + 1;
          });

          const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
          const topNeg = sortedCats.filter(c => c[0].startsWith('-')).slice(0, 3).map(c => `${c[0].substring(1)} (${c[1]})`).join('\n');
          const topPos = sortedCats.filter(c => c[0].startsWith('+')).slice(0, 3).map(c => `${c[0].substring(1)} (${c[1]})`).join('\n');

          return [
            stat.name,
            stat.totalScore,
            stat.positives,
            stat.negatives,
            topNeg || '-',
            topPos || '-'
          ];
        });

        autoTable(doc, {
          startY: 40,
          head: [['Gestor', 'Score', 'Pos.', 'Neg.', 'Top Negativos', 'Top Positivos']],
          body: tableBody,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [41, 128, 185] }, // Blue header
          columnStyles: {
            0: { cellWidth: 30 }, // Gestor
            1: { cellWidth: 15, halign: 'center' }, // Score
            2: { cellWidth: 15, halign: 'center' }, // Pos
            3: { cellWidth: 15, halign: 'center' }, // Neg
            4: { cellWidth: 'auto' }, // Detailed
            5: { cellWidth: 'auto' }
          }
        });

        doc.save(`fiscalizacao_${startDate}_${endDate}.pdf`);
      }

      toast({
        title: 'Sucesso',
        description: 'Relatório exportado com sucesso.',
      });

    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: 'Erro na exportação',
        description: error.message || 'Erro ao gerar o relatório.',
        variant: 'destructive',
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-8 pt-20 lg:pt-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6 border-sidebar-border">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Fiscalização Telegram</h1>
            <p className="text-muted-foreground">Monitore a qualidade do atendimento no Telegram.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setExportDialogOpen(true)}
              className="flex-1 md:flex-none"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar Dados
            </Button>
            <Button
              variant="outline"
              onClick={fetchInspections}
              className="flex-1 md:flex-none"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loadingList ? 'animate-spin' : ''}`} />
              Atualizar Lista
            </Button>
            {/* ... other code ... */}

            <Button
              variant="hero"
              onClick={() => setShowPreview(true)}
              className="flex-[2] md:flex-none"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova Fiscalização
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Gestor e Data */}
            <Card variant="elevated">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Dados da Fiscalização
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Gestor Fiscalizado *</Label>
                    <Select value={gestorId} onValueChange={setGestorId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o gestor" />
                      </SelectTrigger>
                      <SelectContent>
                        {gestores.filter(g => g.no_grupo_telegram).map((gestor) => (
                          <SelectItem key={gestor.id} value={gestor.id}>
                            {gestor.nome}
                            {gestor.username_telegram && ` (@${gestor.username_telegram})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Data do Evento *</Label>
                    <div className="relative">
                      <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="date"
                        value={dataEvento}
                        onChange={(e) => setDataEvento(e.target.value)}
                        className="pl-10"
                        max={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Semana {weekNumber} • Mês {monthNumber}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Toggle Absence */}
            <div className="flex items-center space-x-2 py-2 px-1">
              <Switch
                id="nao-trabalhou"
                checked={naoTrabalhou}
                onCheckedChange={handleNaoTrabalhouChange}
                className="data-[state=checked]:bg-destructive"
              />
              <Label htmlFor="nao-trabalhou" className={`cursor-pointer font-medium ${naoTrabalhou ? 'text-destructive' : ''}`}>
                Colaborador não trabalhou
              </Label>
            </div>

            {naoTrabalhou ? (
              <Card variant="elevated" className="border-destructive/20 animate-fade-in">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <CalendarOff className="w-5 h-5" />
                    Motivo da Ausência
                  </CardTitle>
                  <CardDescription>
                    Justifique o motivo pelo qual o gestor não trabalhou nesta data.
                    Isso será contabilizado como um ponto negativo.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Digite o motivo da ausência..."
                    value={motivoAusencia}
                    onChange={(e) => setMotivoAusencia(e.target.value)}
                    className="min-h-[100px]"
                  />
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Pontos Negativos */}
                <Card variant="elevated" className="border-destructive/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                      <ThumbsDown className="w-5 h-5" />
                      Pontos Negativos
                      {pontosNegativos.length > 0 && (
                        <Badge variant="destructive" className="ml-2">
                          {pontosNegativos.length} selecionado(s) = -{pontosNegativos.length} pts
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Cada ponto negativo equivale a -1 no ranking final
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {CATEGORIAS_NEGATIVAS.map((categoria) => {
                        const selecionado = isPontoSelecionado('negativo', categoria);
                        return (
                          <div key={categoria} className="space-y-2">
                            <div
                              className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${selecionado
                                ? 'border-destructive bg-destructive/10'
                                : 'border-border hover:border-destructive/50'
                                }`}
                              onClick={() => togglePonto('negativo', categoria)}
                            >
                              <Checkbox
                                checked={selecionado}
                                onCheckedChange={() => togglePonto('negativo', categoria)}
                                className="data-[state=checked]:bg-destructive data-[state=checked]:border-destructive"
                              />
                              <span className={`flex-1 ${selecionado ? 'font-medium text-destructive' : ''}`}>
                                {categoria}
                              </span>
                            </div>
                            {selecionado && (
                              <div className="ml-8 animate-fade-in space-y-2">
                                <div className="flex gap-4 items-center">
                                  <div className="w-24">
                                    <Label className="text-xs mb-1 block">Quantidade</Label>
                                    <Input
                                      type="number"
                                      min="1"
                                      value={pontosSelecionados.find(p => p.tipo === 'negativo' && p.categoria === categoria)?.quantidade || 1}
                                      onChange={(e) => updateQuantidade('negativo', categoria, parseInt(e.target.value) || 1)}
                                      className="h-8"
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <Label className="text-xs mb-1 block">
                                      {categoria === 'Não Trabalhou' ? 'Motivo' : 'Observação (opcional)'}
                                    </Label>
                                    <Input
                                      placeholder={categoria === 'Não Trabalhou' ? 'Digite o motivo' : 'Observação para este ponto'}
                                      value={getObservacao('negativo', categoria)}
                                      onChange={(e) => updateObservacao('negativo', categoria, e.target.value)}
                                      className="h-8"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Pontos Positivos */}
                <Card variant="elevated" className="border-success/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-success">
                      <ThumbsUp className="w-5 h-5" />
                      Pontos Positivos
                      {pontosPositivos.length > 0 && (
                        <Badge className="ml-2 bg-success hover:bg-success/90">
                          {pontosPositivos.length} selecionado(s)
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Pontos positivos não afetam a pontuação, servem para análise qualitativa
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {CATEGORIAS_POSITIVAS.map((categoria) => {
                        const selecionado = isPontoSelecionado('positivo', categoria);
                        return (
                          <div key={categoria} className="space-y-2">
                            <div
                              className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${selecionado
                                ? 'border-success bg-success/10'
                                : 'border-border hover:border-success/50'
                                }`}
                              onClick={() => togglePonto('positivo', categoria)}
                            >
                              <Checkbox
                                checked={selecionado}
                                onCheckedChange={() => togglePonto('positivo', categoria)}
                                className="data-[state=checked]:bg-success data-[state=checked]:border-success"
                              />
                              <span className={`flex-1 ${selecionado ? 'font-medium text-success' : ''}`}>
                                {categoria}
                              </span>
                            </div>
                            {selecionado && (
                              <div className="ml-8 animate-fade-in space-y-2">
                                <div className="flex gap-4 items-center">
                                  <div className="w-24">
                                    <Label className="text-xs mb-1 block">Quantidade</Label>
                                    <Input
                                      type="number"
                                      min="1"
                                      value={pontosSelecionados.find(p => p.tipo === 'positivo' && p.categoria === categoria)?.quantidade || 1}
                                      onChange={(e) => updateQuantidade('positivo', categoria, parseInt(e.target.value) || 1)}
                                      className="h-8"
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <Label className="text-xs mb-1 block">Observação (opcional)</Label>
                                    <Input
                                      placeholder="Observação para este ponto"
                                      value={getObservacao('positivo', categoria)}
                                      onChange={(e) => updateObservacao('positivo', categoria, e.target.value)}
                                      className="h-8"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Submit Button */}
            <Button
              onClick={handlePreview}
              variant="hero"
              size="lg"
              className="w-full"
              disabled={!gestorId || (!naoTrabalhou && pontosSelecionados.length === 0) || (naoTrabalhou && !motivoAusencia.trim())}
            >
              <Eye className="w-4 h-4 mr-2" />
              {editingId ? 'Visualizar e Atualizar' : 'Visualizar e Salvar'}
            </Button>
          </div>

          {/* Resumo Lateral */}
          <div className="space-y-4">
            <Card variant="elevated" className="sticky top-8">
              <CardHeader>
                <CardTitle className="text-lg">Resumo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {gestorSelecionado ? (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Gestor</p>
                    <p className="font-medium">{gestorSelecionado.nome}</p>
                  </div>
                ) : (
                  <div className="p-3 bg-muted/30 rounded-lg text-muted-foreground text-sm">
                    Nenhum gestor selecionado
                  </div>
                )}

                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Período</p>
                  <p className="font-medium">
                    {new Date(dataEvento + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Semana {weekNumber} • Mês {monthNumber}
                  </p>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg">
                    <div className="flex items-center gap-2">
                      <ThumbsDown className="w-4 h-4 text-destructive" />
                      <span className="text-sm">Negativos</span>
                    </div>
                    <Badge variant="destructive">{naoTrabalhou ? 1 : pontosNegativos.reduce((acc, curr) => acc + curr.quantidade, 0)}</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-success/10 rounded-lg">
                    <div className="flex items-center gap-2">
                      <ThumbsUp className="w-4 h-4 text-success" />
                      <span className="text-sm">Positivos</span>
                    </div>
                    <Badge className="bg-success hover:bg-success/90">{naoTrabalhou ? 0 : pontosPositivos.reduce((acc, curr) => acc + curr.quantidade, 0)}</Badge>
                  </div>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">Fiscalizador</p>
                  <p className="font-medium">{profile?.nome || 'N/A'}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* History List */}
      <div className="space-y-6 pt-8 pl-4 pb-12">
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between mb-6 gap-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ListFilter className="w-6 h-6" />
            Histórico de Fiscalizações
          </h2>
          <div className="flex flex-wrap gap-4">
            <Select value={filterGestorId} onValueChange={setFilterGestorId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Gestor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Gestores</SelectItem>
                {gestores.map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterInspectorId} onValueChange={setFilterInspectorId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Fiscalizador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Fiscalizadores</SelectItem>
                {uniqueInspectors.map((i: any) => (
                  <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !selectedDateFilter && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDateFilter ? format(selectedDateFilter, "PPP", { locale: ptBR }) : <span>Filtrar por data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDateFilter}
                  onSelect={setSelectedDateFilter}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {!selectedDateFilter && (
              <>
                <Select
                  value={selectedYear.toString()}
                  onValueChange={(v) => setSelectedYear(parseInt(v))}
                >
                  <SelectTrigger className="w-24">
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
                <Select
                  value={selectedMonth.toString()}
                  onValueChange={(v) => setSelectedMonth(parseInt(v))}
                >
                  <SelectTrigger className="w-32">
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
              </>
            )}
          </div>
        </div>

        {loadingList ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : filteredInspections.length === 0 ? (
          <Card variant="glass" className="p-12 text-center">
            <CalendarIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">Nenhuma fiscalização encontrada</h3>
            <p className="text-muted-foreground">
              {selectedDateFilter
                ? `Não há registros para o dia ${selectedDateFilter.toLocaleDateString('pt-BR')} com os filtros selecionados.`
                : `Não há registros para ${MONTHS[selectedMonth - 1]} de ${selectedYear} com os filtros selecionados.`
              }
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredInspections.map((group) => {
              const canEdit = isAdmin || group.criado_por === user?.id;

              return (
                <Card key={group.id} className="relative group hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-lg font-bold text-primary">
                          {group.gestor_nome.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <CardTitle className="text-base">{group.gestor_nome}</CardTitle>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <CalendarIcon className="w-3 h-3" />
                              {new Date(group.data_evento + 'T12:00:00').toLocaleDateString('pt-BR')}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Por: {group.inspector_name}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <Badge
                          className={`text-sm px-2 py-1 ${group.score >= 0
                            ? 'bg-success/15 text-success hover:bg-success/25'
                            : 'bg-destructive/15 text-destructive hover:bg-destructive/25'
                            }`}
                        >
                          {group.score > 0 ? `+${group.score}` : group.score}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {/* Inspection Items */}
                    {group.raw_items && group.raw_items.length > 0 && (
                      <div className="space-y-3 mb-4">
                        {/* Negativos */}
                        {group.raw_items.filter((item: any) => item.tipo === 'negativo').length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-destructive flex items-center gap-1">
                              <ThumbsDown className="w-3 h-3" />
                              Pontos Negativos
                            </p>
                            <div className="grid gap-1">
                              {group.raw_items
                                .filter((item: any) => item.tipo === 'negativo')
                                .map((item: any, idx: number) => (
                                  <div key={idx} className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded flex items-start gap-2">
                                    <span className="font-medium">• {item.categoria}</span>
                                    {item.observacao && <span className="text-muted-foreground text-destructive/80">- {item.observacao}</span>}
                                    {(item.quantidade || 1) > 1 && <span className="ml-auto font-bold">x{item.quantidade}</span>}
                                  </div>
                                ))
                              }
                            </div>
                          </div>
                        )}

                        {/* Positivos */}
                        {group.raw_items.filter((item: any) => item.tipo === 'positivo').length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-success flex items-center gap-1">
                              <ThumbsUp className="w-3 h-3" />
                              Pontos Positivos
                            </p>
                            <div className="grid gap-1">
                              {group.raw_items
                                .filter((item: any) => item.tipo === 'positivo')
                                .map((item: any, idx: number) => (
                                  <div key={idx} className="text-xs bg-success/10 text-success px-2 py-1 rounded flex items-start gap-2">
                                    <span className="font-medium">• {item.categoria}</span>
                                    {(item.quantidade || 1) > 1 && <span className="ml-auto font-bold">x{item.quantidade}</span>}
                                  </div>
                                ))
                              }
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className={`flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity`}>
                      {canEdit && (
                        <Button size="sm" variant="outline" onClick={() => handleEdit(group)}>
                          <Pencil className="w-3 h-3 mr-2" />
                          Editar
                        </Button>
                      )}
                      {(isAdmin || canEdit) && (
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(group.id)}>
                          <Trash2 className="w-3 h-3 mr-2" />
                          Excluir
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              {editingId ? 'Confirmar Edição' : 'Pré-visualização da Fiscalização'}
            </DialogTitle>
            <DialogDescription>
              Revise os dados antes de confirmar o registro
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Dados Gerais */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Gestor Fiscalizado</p>
                <p className="font-semibold text-lg">{gestorSelecionado?.nome}</p>
                {gestorSelecionado?.username_telegram && (
                  <p className="text-sm text-muted-foreground">@{gestorSelecionado.username_telegram}</p>
                )}
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Fiscalizador</p>
                <p className="font-semibold text-lg">{profile?.nome}</p>
                <p className="text-sm text-muted-foreground">{profile?.email}</p>
              </div>
            </div>

            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Data do Evento</p>
              <p className="font-semibold">
                {new Date(dataEvento + 'T12:00:00').toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
              <p className="text-sm text-muted-foreground">
                Semana {weekNumber} • Mês {monthNumber}
              </p>
            </div>

            {/* Pontos Negativos */}
            {pontosNegativos.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2 text-destructive">
                  <ThumbsDown className="w-4 h-4" />
                  Pontos Negativos ({naoTrabalhou ? 1 : pontosNegativos.length})
                </h3>
                {naoTrabalhou ? (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Não Trabalhou</span>
                      <Badge variant="destructive">-1 pt</Badge>
                    </div>
                    {motivoAusencia && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Motivo: {motivoAusencia}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pontosNegativos.map((ponto, idx) => (
                      <div key={idx} className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{ponto.categoria}</span>
                          <Badge variant="destructive">{ponto.quantidade > 1 ? `${ponto.quantidade} ocorrências (-${ponto.quantidade} pts)` : '-1 pt'}</Badge>
                        </div>
                        {getObservacao('negativo', ponto.categoria) && (
                          <p className="text-sm text-muted-foreground mt-2">
                            Obs: {getObservacao('negativo', ponto.categoria)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Pontos Positivos */}
            {(!naoTrabalhou && pontosPositivos.length > 0) && (
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2 text-success">
                  <ThumbsUp className="w-4 h-4" />
                  Pontos Positivos ({pontosPositivos.length})
                </h3>
                <div className="space-y-2">
                  {pontosPositivos.map((ponto, idx) => (
                    <div key={idx} className="p-3 bg-success/10 border border-success/20 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{ponto.categoria}</span>
                        {ponto.quantidade > 1 && <Badge variant="outline">{ponto.quantidade} ocorrências</Badge>}
                      </div>
                      {getObservacao('positivo', ponto.categoria) && (
                        <p className="text-sm text-muted-foreground mt-2">
                          Obs: {getObservacao('positivo', ponto.categoria)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resumo Final */}
            <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
              <h3 className="font-semibold mb-2">Resumo do Impacto</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-destructive">-{naoTrabalhou ? 1 : pontosNegativos.reduce((acc, curr) => acc + curr.quantidade, 0)}</p>
                  <p className="text-sm text-muted-foreground">Pts Negativos</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-success">+{naoTrabalhou ? 0 : pontosPositivos.reduce((acc, curr) => acc + curr.quantidade, 0)}</p>
                  <p className="text-sm text-muted-foreground">Pts Positivos</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{naoTrabalhou ? 1 : pontosSelecionados.length}</p>
                  <p className="text-sm text-muted-foreground">Total Registros</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              <ArrowLeft className="w-4 h-4" />
              Voltar e Editar
            </Button>
            <Button
              variant="hero"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {editingId ? 'Atualizar Dados' : 'Confirmar e Salvar'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Fiscalização?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta fiscalização? Todos os pontos (positivos e negativos) lançados para este gestor nesta data serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setInspectionToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ExportDataDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        onExport={handleExport}
      />

    </DashboardLayout >
  );
}