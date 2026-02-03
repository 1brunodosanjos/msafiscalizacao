import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MONTHS } from '@/lib/constants';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Calendar,
  FileText,
  BarChart3
} from 'lucide-react';

interface GestorDetailsModalProps {
  gestorId: string | null;
  gestorNome: string;
  open: boolean;
  onClose: () => void;
  period: 'week' | 'month';
  selectedWeek: number;
  selectedMonth: number;
  selectedYear: number;
}

interface GestorStats {
  totalMensagens: number;
  totalPositivos: number;
  totalNegativos: number;
  pontuacaoFinal: number;
}

interface HistoricoSemanal {
  semana: number;
  mensagens: number;
  positivos: number;
  negativos: number;
  score: number;
}

interface Observacao {
  id: string;
  tipo: string;
  categoria: string;
  observacao: string | null;
  data_evento: string;
  quantidade: number;
}

export default function GestorDetailsModal({
  gestorId,
  gestorNome,
  open,
  onClose,
  period,
  selectedWeek,
  selectedMonth,
  selectedYear,
}: GestorDetailsModalProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<GestorStats | null>(null);
  const [historicoSemanal, setHistoricoSemanal] = useState<HistoricoSemanal[]>([]);
  const [observacoes, setObservacoes] = useState<Observacao[]>([]);

  useEffect(() => {
    if (gestorId && open) {
      fetchGestorDetails();
    }
  }, [gestorId, open, period, selectedWeek, selectedMonth, selectedYear]);

  const fetchGestorDetails = async () => {
    if (!gestorId) return;

    setLoading(true);

    try {
      // Fetch mensagens for the period
      // Fetch mensagens for the period
      let mensagensQuery: any = supabase
        .from('mensagens_semanais')
        .select('quantidade_mensagens, semana_referencia')
        .eq('gestor_id', gestorId)
        .eq('mes_referencia', selectedMonth)
        .eq('ano_referencia', selectedYear);

      if (period === 'week') {
        mensagensQuery = mensagensQuery.eq('semana_referencia', selectedWeek);
      }

      const { data: mensagensData } = await mensagensQuery;

      // Fetch registros for the period
      let registrosQuery: any = supabase
        .from('registros_fiscalizacao')
        .select('id, tipo, categoria, observacao, data_evento, semana_referencia, quantidade')
        .eq('gestor_id', gestorId)
        .eq('mes_referencia', selectedMonth)
        .eq('ano_referencia', selectedYear);

      if (period === 'week') {
        registrosQuery = registrosQuery.eq('semana_referencia', selectedWeek);
      }

      const { data: registrosData } = await registrosQuery;

      // Fetch Call Inspections (inspections table)
      let callInspectionsQuery: any = supabase
        .from('inspections')
        .select('id, date, semana_referencia, is_cancelled')
        .eq('gestor_id', gestorId)
        .eq('type', 'call')
        .eq('is_cancelled', false)
        .eq('mes_referencia', selectedMonth)
        .eq('ano_referencia', selectedYear);

      if (period === 'week') {
        callInspectionsQuery = callInspectionsQuery.eq('semana_referencia', selectedWeek);
      }

      const { data: callInspections } = await callInspectionsQuery;

      // Fetch items for these calls
      let callItems: any[] = [];
      if (callInspections && callInspections.length > 0) {
        const callIds = callInspections.map(c => c.id);
        const itemsQuery: any = supabase
          .from('inspection_items')
          .select('id, status, criterion, observation, inspection_id, quantidade')
          .in('inspection_id', callIds);

        const { data: items } = await itemsQuery;
        if (items) {
          // Add date and week context from parent call
          callItems = items.map(item => {
            const parentCall = callInspections.find(c => c.id === item.inspection_id);
            return {
              ...item,
              date: parentCall?.date,
              semana_referencia: parentCall?.semana_referencia
            };
          });
        }
      }

      // Calculate stats
      const totalMensagens = mensagensData?.reduce((sum, m) => sum + m.quantidade_mensagens, 0) || 0;

      const telegramPositivos = registrosData?.filter(r => r.tipo === 'positivo').reduce((acc, curr) => acc + (curr.quantidade || 1), 0) || 0;
      const callPositivos = callItems.filter(i => i.status === 'positive').reduce((acc, curr) => acc + (curr.quantidade || 1), 0) || 0;

      const telegramNegativos = registrosData?.filter(r => r.tipo === 'negativo').reduce((acc, curr) => acc + (curr.quantidade || 1), 0) || 0;
      const callNegativos = callItems.filter(i => i.status === 'negative').reduce((acc, curr) => acc + (curr.quantidade || 1), 0) || 0;

      const totalPositivos = telegramPositivos + callPositivos;
      const totalNegativos = telegramNegativos + callNegativos;

      setStats({
        totalMensagens,
        totalPositivos,
        totalNegativos,
        pontuacaoFinal: totalMensagens - totalNegativos,
      });

      // Calculate weekly history for the month
      const weeklyData: HistoricoSemanal[] = [];
      for (let week = 1; week <= 5; week++) {
        const weekMensagens = mensagensData?.filter(m => m.semana_referencia === week)
          .reduce((sum, m) => sum + m.quantidade_mensagens, 0) || 0;

        const weekTelegramPos = registrosData?.filter(r => r.semana_referencia === week && r.tipo === 'positivo').reduce((acc, curr) => acc + (curr.quantidade || 1), 0) || 0;
        const weekCallPos = callItems.filter(i => i.semana_referencia === week && i.status === 'positive').reduce((acc, curr) => acc + (curr.quantidade || 1), 0) || 0;

        const weekTelegramNeg = registrosData?.filter(r => r.semana_referencia === week && r.tipo === 'negativo').reduce((acc, curr) => acc + (curr.quantidade || 1), 0) || 0;
        const weekCallNeg = callItems.filter(i => i.semana_referencia === week && i.status === 'negative').reduce((acc, curr) => acc + (curr.quantidade || 1), 0) || 0;

        const weekPositivos = weekTelegramPos + weekCallPos;
        const weekNegativos = weekTelegramNeg + weekCallNeg;

        if (weekMensagens > 0 || weekPositivos > 0 || weekNegativos > 0) {
          weeklyData.push({
            semana: week,
            mensagens: weekMensagens,
            positivos: weekPositivos,
            negativos: weekNegativos,
            score: weekMensagens - weekNegativos,
          });
        }
      }
      setHistoricoSemanal(weeklyData);

      // Set observações
      const telegramObs = registrosData?.filter(r => r.observacao).map(r => ({
        id: r.id,
        tipo: r.tipo,
        categoria: r.categoria,
        observacao: r.observacao,
        data_evento: r.data_evento,
        quantidade: r.quantidade || 1,
      })) || [];

      const callObs = callItems.filter(i => i.observation).map(i => ({
        id: i.id,
        tipo: i.status === 'positive' ? 'positivo' : 'negativo',
        categoria: i.criterion,
        observacao: i.observation,
        data_evento: i.date,
        quantidade: i.quantidade || 1,
      }));

      setObservacoes([...telegramObs, ...callObs].sort((a, b) =>
        new Date(b.data_evento).getTime() - new Date(a.data_evento).getTime()
      ));

    } catch (error) {
      console.error('Error fetching gestor details:', error);
    } finally {
      setLoading(false);
    }
  };

  // MONTHS moved to src/lib/constants.ts


  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl">{gestorNome}</DialogTitle>
          <DialogDescription>
            Análise detalhada - {period === 'week' ? `Semana ${selectedWeek}` : MONTHS[selectedMonth - 1]} {selectedYear}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
            <Skeleton className="h-48" />
          </div>
        ) : (
          <Tabs defaultValue="resumo" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="resumo">Resumo</TabsTrigger>
              <TabsTrigger value="historico">Histórico Semanal</TabsTrigger>
              <TabsTrigger value="observacoes">Observações</TabsTrigger>
            </TabsList>

            <TabsContent value="resumo" className="space-y-4">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <MessageSquare className="w-6 h-6 mx-auto mb-2 text-primary" />
                    <p className="text-2xl font-bold">{stats?.totalMensagens}</p>
                    <p className="text-xs text-muted-foreground">Mensagens</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <TrendingUp className="w-6 h-6 mx-auto mb-2 text-success" />
                    <p className="text-2xl font-bold text-success">{stats?.totalPositivos}</p>
                    <p className="text-xs text-muted-foreground">Positivos</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <TrendingDown className="w-6 h-6 mx-auto mb-2 text-destructive" />
                    <p className="text-2xl font-bold text-destructive">{stats?.totalNegativos}</p>
                    <p className="text-xs text-muted-foreground">Negativos</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
                  <CardContent className="p-4 text-center">
                    <BarChart3 className="w-6 h-6 mx-auto mb-2 text-primary" />
                    <p className={`text-2xl font-bold ${(stats?.pontuacaoFinal || 0) > 0 ? 'text-success' :
                      (stats?.pontuacaoFinal || 0) < 0 ? 'text-destructive' : ''
                      }`}>
                      {(stats?.pontuacaoFinal || 0) > 0 ? '+' : ''}{stats?.pontuacaoFinal}
                    </p>
                    <p className="text-xs text-muted-foreground">Pontuação Final</p>
                  </CardContent>
                </Card>
              </div>

              {/* Fórmula */}
              <Card variant="glass">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground mb-2">Cálculo da pontuação:</p>
                  <div className="flex items-center gap-2 text-sm font-mono">
                    <span className="text-primary">{stats?.totalMensagens} mensagens</span>
                    <span>-</span>
                    <span className="text-destructive">{stats?.totalNegativos} negativos</span>
                    <span>=</span>
                    <span className={`font-bold ${(stats?.pontuacaoFinal || 0) > 0 ? 'text-success' :
                      (stats?.pontuacaoFinal || 0) < 0 ? 'text-destructive' : ''
                      }`}>
                      {stats?.pontuacaoFinal}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="historico">
              <ScrollArea className="h-[300px]">
                {historicoSemanal.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhum histórico disponível</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {historicoSemanal.map((week) => (
                      <Card key={week.semana}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                                <Calendar className="w-5 h-5 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="font-medium">Semana {week.semana}</p>
                                <p className="text-xs text-muted-foreground">
                                  {week.mensagens} msgs, {week.positivos} pos, {week.negativos} neg
                                </p>
                              </div>
                            </div>
                            <div className={`text-xl font-bold ${week.score > 0 ? 'text-success' :
                              week.score < 0 ? 'text-destructive' : 'text-muted-foreground'
                              }`}>
                              {week.score > 0 ? '+' : ''}{week.score}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="observacoes">
              <ScrollArea className="h-[300px]">
                {observacoes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhuma observação registrada</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {observacoes.map((obs) => (
                      <Card key={obs.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <Badge variant={obs.tipo === 'positivo' ? 'positive' : 'negative'}>
                              {obs.tipo}
                            </Badge>
                            <div className="flex-1">
                              <div className="flex justify-between items-start">
                                <p className="font-medium text-sm">{obs.categoria}</p>
                                {obs.quantidade > 1 && <Badge variant="outline">{obs.quantidade}x</Badge>}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{obs.observacao}</p>
                              <p className="text-xs text-muted-foreground mt-2">
                                {new Date(obs.data_evento + 'T12:00:00').toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
