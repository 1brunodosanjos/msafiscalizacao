import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import { MONTHS } from '@/lib/constants';

import RankingFilters from '@/components/rankings/RankingFilters';
import RankingCard from '@/components/rankings/RankingCard';
import GestorDetailsModal from '@/components/rankings/GestorDetailsModal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, MessageSquare, TrendingDown, Award, Download, FileText, FileImage } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Gestor {
  id: string;
  nome: string;
  username_telegram: string | null;
}

interface RankingItem extends Gestor {
  mensagens: number;
  positivos: number;
  negativos: number;
  scoreFinal: number;
}

export default function Rankings() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [gestores, setGestores] = useState<Gestor[]>([]);
  const [rankingData, setRankingData] = useState<RankingItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Filters
  const now = new Date();
  const [period, setPeriod] = useState<'week' | 'month'>('month');
  const [selectedWeek, setSelectedWeek] = useState(Math.ceil(now.getDate() / 7));
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedGestor, setSelectedGestor] = useState('all');

  // Modal
  const [selectedGestorDetails, setSelectedGestorDetails] = useState<{ id: string; nome: string } | null>(null);

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
    if (user && gestores.length > 0) {
      fetchRankingData();
    }
  }, [user, gestores, period, selectedWeek, selectedMonth, selectedYear, selectedGestor]);

  const fetchGestores = async () => {
    // Busca todos os campos para evitar erro se 'setores' não existir
    const { data } = await supabase
      .from('gestores')
      .select('*')
      .order('nome');

    if (data) {
      // Filtra apenas gestores do Telegram (usando lógica robusta)
      const gestoresTelegram = data.filter((g: any) => {
        const setores = g.setores || [];
        const setor = g.setor;
        const noGrupo = g.no_grupo_telegram;

        return setores.includes('telegram') || setor === 'telegram' || noGrupo === true;
      });

      setGestores(gestoresTelegram.map((p: any) => ({
        id: p.id,
        nome: p.nome,
        username_telegram: p.username_telegram
      })));
    }
  };

  const fetchRankingData = async () => {
    setLoadingData(true);

    try {
      // Get gestores to include (filter if specific gestor selected)
      const gestoresToFetch = selectedGestor === 'all'
        ? gestores
        : gestores.filter(g => g.id === selectedGestor);

      // Fetch mensagens
      let mensagensQuery = supabase
        .from('mensagens_semanais')
        .select('gestor_id, quantidade_mensagens')
        .eq('mes_referencia', selectedMonth)
        .eq('ano_referencia', selectedYear);

      if (period === 'week') {
        mensagensQuery = mensagensQuery.eq('semana_referencia', selectedWeek);
      }

      const { data: mensagensData } = await mensagensQuery;

      // Fetch registros
      const currentYear = selectedYear; // USE SELECTED YEAR
      const startDate = new Date(currentYear, selectedMonth - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(currentYear, selectedMonth, 0).toISOString().split('T')[0];

      let registrosQuery = supabase
        .from('registros_fiscalizacao')
        .select('gestor_id, tipo, quantidade')
        .eq('mes_referencia', selectedMonth)
        .eq('ano_referencia', selectedYear);

      if (period === 'week') {
        registrosQuery = registrosQuery.eq('semana_referencia', selectedWeek);
      }

      const { data: registrosData } = await registrosQuery;

      // Fetch Call Inspections (inspections table)
      let callInspectionsQuery = supabase
        .from('inspections')
        .select('id, manager_id, date')
        .eq('type', 'call')
        .eq('is_cancelled', false)
        .eq('mes_referencia', selectedMonth)
        .eq('ano_referencia', selectedYear);

      if (period === 'week') {
        callInspectionsQuery = callInspectionsQuery.eq('semana_referencia', selectedWeek);
      }

      const { data: callInspections } = await callInspectionsQuery;

      // Filter calls by week if needed
      let filteredCalls: any[] = callInspections || [];
      if (period === 'week' && callInspections) {
        filteredCalls = callInspections.filter((call: any) => {
          const dayNum = parseInt(call.date.split('-')[2]);
          const callWeek = Math.ceil(dayNum / 7);
          return callWeek === selectedWeek;
        });
      }

      // Fetch items for these calls
      let callItems: any[] = [];
      if (filteredCalls.length > 0) {
        const callIds = filteredCalls.map(c => c.id);
        const { data: items } = await supabase
          .from('inspection_items')
          .select('status, inspection_id, quantidade')
          .in('inspection_id', callIds);
        if (items) callItems = items;
      }

      // Calculate ranking data
      const ranking: RankingItem[] = gestoresToFetch.map((gestor) => {
        const gestorMensagens = (mensagensData as any[])?.filter(m => m.gestor_id === gestor.id) || [];
        const totalMensagens = gestorMensagens.reduce((sum: number, m: any) => sum + (m.quantidade_mensagens || 0), 0);

        const gestorRegistros = (registrosData as any[])?.filter(r => r.gestor_id === gestor.id) || [];
        const positivosTelegram = gestorRegistros.filter(r => r.tipo === 'positivo').reduce((acc, curr) => acc + (curr.quantidade || 0), 0);
        const negativosTelegram = gestorRegistros.filter(r => r.tipo === 'negativo').reduce((acc, curr) => acc + (curr.quantidade || 0), 0);

        // Call stats
        const gestorCalls = filteredCalls.filter(c => c.manager_id === gestor.id);
        const gestorCallIds = gestorCalls.map(c => c.id);
        const gestorCallItems = callItems.filter(i => gestorCallIds.includes(i.inspection_id));

        const positivosCalls = gestorCallItems.filter(i => i.status === 'positive').reduce((acc, curr) => acc + (curr.quantidade || 1), 0);
        const negativosCalls = gestorCallItems.filter(i => i.status === 'negative').reduce((acc, curr) => acc + (curr.quantidade || 1), 0);

        const positivos = positivosTelegram + positivosCalls;
        const negativos = negativosTelegram + negativosCalls;

        return {
          ...gestor,
          mensagens: totalMensagens,
          positivos,
          negativos,
          scoreFinal: totalMensagens - negativos,
        };
      });

      setRankingData(ranking);
    } catch (error) {
      console.error('Error fetching ranking data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleViewDetails = (gestor: Gestor) => {
    setSelectedGestorDetails({ id: gestor.id, nome: gestor.nome });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const exportToPDF = async () => {
    const element = document.getElementById('ranking-export-content');
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#000000', // Ensure dark background for dark mode theme
        useCORS: true,
        logging: false
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`ranking-suporte-show-${selectedMonth}-${selectedYear}.pdf`);
    } catch (error) {
      console.error('Error exporting PDF:', error);
    }
  };

  const exportToImage = async () => {
    const element = document.getElementById('ranking-export-content');
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#000000', // Ensure dark background
        useCORS: true
      });
      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image;
      link.download = `ranking-suporte-show-${selectedMonth}-${selectedYear}.png`;
      link.click();
    } catch (error) {
      console.error('Error exporting image:', error);
    }
  };

  // Sort rankings by different criteria
  const rankingBruto = [...rankingData].sort((a, b) => b.mensagens - a.mensagens);
  const rankingNegativos = [...rankingData].sort((a, b) => b.negativos - a.negativos);
  const rankingFinal = [...rankingData].sort((a, b) => b.scoreFinal - a.scoreFinal);

  // MONTHS moved to src/lib/constants.ts


  const periodLabel = period === 'week'
    ? `Semana ${selectedWeek} - ${MONTHS[selectedMonth - 1]}`
    : MONTHS[selectedMonth - 1];

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-8 pt-20 lg:pt-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Rankings de Performance</h1>
            <p className="text-muted-foreground">Acompanhe o desempenho dos gestores.</p>
          </div>
        </div>

        <RankingFilters
          period={period}
          setPeriod={setPeriod}
          selectedWeek={selectedWeek}
          setSelectedWeek={setSelectedWeek}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          selectedGestor={selectedGestor}
          setSelectedGestor={setSelectedGestor}
          gestores={gestores}
        />

        {/* Rankings Tabs */}
        <Tabs defaultValue="final" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="final" className="gap-2">
              <Award className="w-4 h-4" />
              Ranking Final
            </TabsTrigger>
            <TabsTrigger value="bruto" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              Ranking Bruto
            </TabsTrigger>
            <TabsTrigger value="negativos" className="gap-2">
              <TrendingDown className="w-4 h-4" />
              Pontos Negativos
            </TabsTrigger>
          </TabsList>

          {/* Ranking Final */}
          <TabsContent value="final">
            <Card variant="elevated" className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-warning" />
                  Ranking Final Suporte Show
                </CardTitle>
                <CardDescription>
                  Mensagens - Pontos Negativos = Pontuação Final
                </CardDescription>
              </CardHeader>
              <div className="absolute top-4 right-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Download className="w-4 h-4" />
                      Exportar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={exportToPDF} className="gap-2 cursor-pointer">
                      <FileText className="w-4 h-4" />
                      Exportar PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportToImage} className="gap-2 cursor-pointer">
                      <FileImage className="w-4 h-4" />
                      Exportar Imagem
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>

            <div id="ranking-export-content" className="space-y-6 p-4 rounded-lg bg-background/50">
              {loadingData ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              ) : rankingFinal.length === 0 ? (
                <Card variant="glass" className="p-12 text-center">
                  <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-medium mb-2">Nenhum dado disponível</h3>
                  <p className="text-muted-foreground">
                    Não há registros para este período.
                  </p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {rankingFinal.map((item, index) => (
                    <RankingCard
                      key={item.id}
                      position={index}
                      nome={item.nome}
                      username_telegram={item.username_telegram}
                      value={item.scoreFinal}
                      type="score"
                      mensagens={item.mensagens}
                      positivos={item.positivos}
                      negativos={item.negativos}
                      onViewDetails={() => handleViewDetails(item)}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Ranking Bruto */}
          <TabsContent value="bruto">
            <Card variant="elevated" className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  Ranking Bruto
                </CardTitle>
                <CardDescription>
                  Baseado na soma total de mensagens enviadas no período
                </CardDescription>
              </CardHeader>
            </Card>

            {loadingData ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : rankingBruto.length === 0 ? (
              <Card variant="glass" className="p-12 text-center">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-medium mb-2">Nenhum dado disponível</h3>
                <p className="text-muted-foreground">
                  Não há registros de mensagens para este período.
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {rankingBruto.map((item, index) => (
                  <RankingCard
                    key={item.id}
                    position={index}
                    nome={item.nome}
                    username_telegram={item.username_telegram}
                    value={item.mensagens}
                    type="messages"
                    onViewDetails={() => handleViewDetails(item)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Ranking Negativos */}
          <TabsContent value="negativos">
            <Card variant="elevated" className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-destructive" />
                  Ranking de Pontos Negativos
                </CardTitle>
                <CardDescription>
                  Gestores com mais pontos negativos no período (atenção requerida)
                </CardDescription>
              </CardHeader>
            </Card>

            {loadingData ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : rankingNegativos.filter(r => r.negativos > 0).length === 0 ? (
              <Card variant="glass" className="p-12 text-center">
                <TrendingDown className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-medium mb-2">Nenhum ponto negativo</h3>
                <p className="text-muted-foreground">
                  Não há registros negativos para este período.
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {rankingNegativos.filter(r => r.negativos > 0).map((item, index) => (
                  <RankingCard
                    key={item.id}
                    position={index}
                    nome={item.nome}
                    username_telegram={item.username_telegram}
                    value={item.negativos}
                    type="negatives"
                    onViewDetails={() => handleViewDetails(item)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Gestor Details Modal */}
      <GestorDetailsModal
        gestorId={selectedGestorDetails?.id || null}
        gestorNome={selectedGestorDetails?.nome || ''}
        open={!!selectedGestorDetails}
        onClose={() => setSelectedGestorDetails(null)}
        period={period}
        selectedWeek={selectedWeek}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
      />
    </DashboardLayout>
  );
}
