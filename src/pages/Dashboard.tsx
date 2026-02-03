import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Calendar,
  MessageSquare,
  Activity,
  Users,
  Trophy,
  Filter,
  ClipboardCheck,
  BarChart3,
  Video
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import { MONTHS } from '@/lib/constants';
import {
  ChartRegistrosPorPeriodo,
  ChartProblemasTelegram,
  ChartProblemasCalls,
  ChartComparativoGestores,
  ChartPerformanceTelegram,
  TrendData,
  ChartDataPoints,
  ManagerData,
  ManagerTelegramData,
  CallHoursData
} from '@/components/dashboard/DashboardCharts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  setDate,
  lastDayOfMonth
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Clock, X } from 'lucide-react';



interface Stats {
  totalGestores: number;
  fiscalizacoesPeriodo: number;
  positivosPeriodo: number;
  negativosPeriodo: number;
  mensagensPeriodo: number;
}

interface Gestor {
  id: string;
  nome: string;
  username_telegram: string | null;
  status: string;
  mensagens: number;
  positivos: number;
  negativos: number;
  scoreFinal: number;
}


// MONTHS moved to src/lib/constants.ts


export default function Dashboard() {
  const { user, loading, permissions, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [showAllManagers, setShowAllManagers] = useState(false);


  // Charts Data
  const [trendsData, setTrendsData] = useState<TrendData[]>([]);
  const [negativesDataTelegram, setNegativesDataTelegram] = useState<ChartDataPoints[]>([]);
  const [negativesDataCalls, setNegativesDataCalls] = useState<ChartDataPoints[]>([]);
  const [positivesData, setPositivesData] = useState<ChartDataPoints[]>([]);
  const [managersChartData, setManagersChartData] = useState<ManagerData[]>([]);
  const [managersTelegramChartData, setManagersTelegramChartData] = useState<ManagerTelegramData[]>([]);
  const [inspectorsData, setInspectorsData] = useState<ChartDataPoints[]>([]);
  const [callHoursData, setCallHoursData] = useState<CallHoursData[]>([]);

  const [loadingData, setLoadingData] = useState(true);

  // Filters
  const now = new Date();
  const [period, setPeriod] = useState<'week' | 'month' | 'custom'>('month');
  const [selectedWeek, setSelectedWeek] = useState(Math.ceil(now.getDate() / 7));
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  // New Filters
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedManager, setSelectedManager] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');

  // Managers List for Filter
  const [managersList, setManagersList] = useState<{ id: string, nome: string, grupos_calls: string[] | null }[]>([]);

  // Helper to get date range from global filters
  const getGlobalDateRange = () => {
    // 1. Custom Date Range
    if (dateRange?.from) {
      return {
        start: dateRange.from,
        end: dateRange.to || dateRange.from
      };
    }

    // 2. Month
    if (period === 'month') {
      const date = new Date(selectedYear, selectedMonth - 1, 1);
      return {
        start: startOfMonth(date),
        end: endOfMonth(date)
      };
    }

    // 3. Week
    if (period === 'week') {
      // Calculate week start day
      const startDay = 1 + (selectedWeek - 1) * 7;
      let endDay = startDay + 6;

      const lastDay = lastDayOfMonth(new Date(selectedYear, selectedMonth - 1, 1)).getDate();
      if (endDay > lastDay) endDay = lastDay;

      const start = new Date(selectedYear, selectedMonth - 1, startDay);
      const end = new Date(selectedYear, selectedMonth - 1, endDay, 23, 59, 59);

      return { start, end };
    }

    return null;
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user, period, selectedWeek, selectedMonth, selectedYear, dateRange, selectedManager, selectedGroup]);

  // Fetch Telegram Data based on global filters
  useEffect(() => {
    if (user) {
      fetchTelegramStats();
    }
  }, [user, period, selectedWeek, selectedMonth, selectedYear, dateRange, selectedManager]);

  // Fetch Calls Data based on global filters
  useEffect(() => {
    if (user) {
      fetchCallsStats();
    }
  }, [user, period, selectedWeek, selectedMonth, selectedYear, dateRange, selectedManager]);

  const fetchCallsStats = async () => {
    try {
      const range = getGlobalDateRange();
      if (!range) return;

      const startDate = format(range.start, 'yyyy-MM-dd');
      const endDate = format(range.end, 'yyyy-MM-dd');

      let query = supabase
        .from('inspections')
        .select(`
          manager_id,
          inspection_items!inner (
            criterion,
            status,
            quantity
          )
        `)
        .eq('type', 'call')
        .eq('inspection_items.status', 'negative')
        .gte('date', startDate)
        .lte('date', endDate);

      if (selectedManager !== 'all') {
        query = query.eq('manager_id', selectedManager);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        const issuesMap = new Map<string, number>();

        data.forEach((inspection: any) => {
          if (inspection.inspection_items && Array.isArray(inspection.inspection_items)) {
            inspection.inspection_items.forEach((item: any) => {
              if (item.status === 'negative') {
                const issueName = item.criterion;
                const qty = item.quantity || 1;
                issuesMap.set(issueName, (issuesMap.get(issueName) || 0) + qty);
              }
            });
          }
        });

        const negativesData = Array.from(issuesMap.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value);

        setNegativesDataCalls(negativesData);
      }
    } catch (error) {
      console.error('Error fetching calls stats:', error);
    }
  };

  const fetchTelegramStats = async () => {
    try {
      const range = getGlobalDateRange();
      if (!range) return;

      const startDate = format(range.start, 'yyyy-MM-dd');
      const endDate = format(range.end, 'yyyy-MM-dd');

      let query = supabase
        .from('fiscalizacao_telegram')
        .select(`
          id_gestor,
          pontos_negativos,
          data_fiscalizacao,
          gestores (nome)
        `)
        .gte('data_fiscalizacao', startDate)
        .lte('data_fiscalizacao', endDate);

      if (selectedManager !== 'all') {
        query = query.eq('id_gestor', selectedManager);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        const issuesMap = new Map<string, number>();

        // Explicitly cast data to avoiding 'never' type or type checking issues on specific fields
        const telegramData = data as any[];

        telegramData.forEach((item) => {
          if (item.pontos_negativos && Array.isArray(item.pontos_negativos)) {
            item.pontos_negativos.forEach((issue: string) => {
              issuesMap.set(issue, (issuesMap.get(issue) || 0) + 1);
            });
          }
        });

        const negativesData = Array.from(issuesMap.entries())
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value);

        setNegativesDataTelegram(negativesData);
      }
    } catch (error) {
      console.error('Error fetching telegram stats:', error);
    }
  };

  const fetchDashboardData = async () => {
    setLoadingData(true);

    try {
      // Fetch gestores count
      const { count: gestoresCount } = await (supabase
        .from('gestores') as any)
        .select('*', { count: 'exact', head: true })
        .eq('ativo', true);


      // Calculate date range for the selected month/year
      let startDate: string;
      let endDate: string;

      if (period === 'custom' && dateRange?.from) {
        startDate = format(dateRange.from, 'yyyy-MM-dd');
        endDate = dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : format(dateRange.from, 'yyyy-MM-dd');
      } else {
        const currentYear = selectedYear;
        startDate = new Date(currentYear, selectedMonth - 1, 1).toISOString().split('T')[0];
        endDate = new Date(currentYear, selectedMonth, 0).toISOString().split('T')[0];
      }



      let registrosData: any[] = [];
      const canViewTelegram = isAdmin || permissions?.access_telegram;

      if (canViewTelegram) {
        // Fetch registros for the period (using date range for safety across years)
        let registrosQuery = supabase
          .from('registros_fiscalizacao')
          .select('*, profiles:criado_por(full_name)')
          .gte('data_evento', startDate)
          .lte('data_evento', endDate);

        if (period === 'week') {
          registrosQuery = registrosQuery.eq('semana_referencia', selectedWeek);
        }

        if (selectedManager && selectedManager !== 'all') {
          registrosQuery = registrosQuery.eq('gestor_id', selectedManager);
        }

        const { data } = await registrosQuery;
        registrosData = data || [];
      }

      let mensagensData: any[] = [];
      if (canViewTelegram) {
        // Fetch mensagens for the period
        let mensagensQuery = supabase
          .from('mensagens_semanais')
          .select('quantidade_audios, quantidade_textos, quantidade_videos, gestor_id')
          .eq('mes_referencia', selectedMonth)
          .eq('ano_referencia', selectedYear);

        if (period === 'week') {
          mensagensQuery = mensagensQuery.eq('semana_referencia', selectedWeek);
        }

        if (selectedManager && selectedManager !== 'all') {
          mensagensQuery = mensagensQuery.eq('gestor_id', selectedManager);
        }

        const { data } = await mensagensQuery;
        mensagensData = data || [];
      }

      let callInspections: any[] = [];
      const canViewCalls = isAdmin || permissions?.access_calls;

      if (canViewCalls) {
        // Fetch Call Inspections (inspections table)
        let callInspectionsQuery = supabase
          .from('inspections')
          .select('id, manager_id, date, start_time, end_time, inspector_id, profiles:inspector_id(full_name)')
          .eq('type', 'call')
          .eq('is_cancelled', false)
          .gte('date', startDate)
          .lte('date', endDate);

        if (selectedManager && selectedManager !== 'all') {
          callInspectionsQuery = callInspectionsQuery.eq('manager_id', selectedManager);
        }

        const { data } = await callInspectionsQuery;
        callInspections = data || [];
      }

      // Filter calls by week if needed (naive day/7 check matching other logic)
      let filteredCalls = callInspections || [];
      if (period === 'week' && callInspections) {
        filteredCalls = callInspections.filter(call => {
          const day = new Date(call.date).getDate() + 1; // +1 to handle potential timezone offset or match strict day
          // Actually, simpler: just get the day part from YYYY-MM-DD
          const dayNum = parseInt(call.date.split('-')[2]);
          const callWeek = Math.ceil(dayNum / 7);
          return callWeek === selectedWeek;
        });
      }

      // Fetch items for these calls to get positives/negatives count
      let callItems: any[] = [];
      if (filteredCalls.length > 0) {
        const callIds = filteredCalls.map(c => c.id);
        const { data: items } = await supabase
          .from('inspection_items')
          .select('status, inspection_id, criterion, category')
          .in('inspection_id', callIds);
        if (items) callItems = items;
      }

      // Merge stats
      const positivosTelegram = registrosData?.filter(r => r.tipo === 'positivo').length || 0;
      const negativosTelegram = registrosData?.filter(r => r.tipo === 'negativo').length || 0;

      const positivosCalls = callItems.filter(i => i.status === 'positive').length;
      const negativosCalls = callItems.filter(i => i.status === 'negative').length;

      const positivos = positivosTelegram + positivosCalls;
      const negativos = negativosTelegram + negativosCalls;

      const totalMensagens = mensagensData?.reduce((sum, m) => sum + (m.quantidade_audios || 0) + (m.quantidade_textos || 0) + (m.quantidade_videos || 0), 0) || 0;

      setStats({
        totalGestores: gestoresCount || 0,
        fiscalizacoesPeriodo: (registrosData?.length || 0) + filteredCalls.length,
        positivosPeriodo: positivos,
        negativosPeriodo: negativos,
        mensagensPeriodo: totalMensagens,
      });

      const safeRegistros = registrosData || [];

      // --- Process Data for Charts ---

      // 1. Trends Data (Daily Count)
      const dailyCounts: Record<string, number> = {};

      // Init days map
      safeRegistros.forEach(r => {
        const date = r.data_evento;
        dailyCounts[date] = (dailyCounts[date] || 0) + 1;
      });
      filteredCalls.forEach(c => {
        const date = c.date;
        dailyCounts[date] = (dailyCounts[date] || 0) + 1;
      });

      const trends: TrendData[] = Object.keys(dailyCounts)
        .sort()
        .map(date => {
          const [y, m, d] = date.split('-');
          return {
            date: `${d}/${m}`,
            count: dailyCounts[date]
          };
        });

      // If empty for month, maybe fill a few dummy days or leave empty?
      // Better: ensure we have data or at least empty if nothing.
      setTrendsData(trends);

      // 2. Negatives Data - TELEGRAM (Top issues)
      const negativesMapTelegram: Record<string, number> = {};

      // Telegram negatives only
      safeRegistros
        .filter(r => r.tipo === 'negativo')
        .forEach(r => {
          // Prefer observation or category
          const reason = r.observacao || r.categoria || 'Outros';
          // Try to clean up short text if it's too long or use category
          const key = reason.length > 30 ? r.categoria || 'Observação longa' : reason;
          negativesMapTelegram[key] = (negativesMapTelegram[key] || 0) + 1;
        });

      const negativesChartTelegram: ChartDataPoints[] = Object.entries(negativesMapTelegram)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10); // Top 10

      setNegativesDataTelegram(negativesChartTelegram);
      console.log('📊 Dados Telegram:', negativesChartTelegram);

      // 2B. Negatives Data - CALLS (Top issues)
      const negativesMapCalls: Record<string, number> = {};

      // Call negatives only
      callItems
        .filter(i => i.status === 'negative')
        .forEach(i => {
          const key = i.criterion || i.category || 'Outros';
          negativesMapCalls[key] = (negativesMapCalls[key] || 0) + 1;
        });

      const negativesChartCalls: ChartDataPoints[] = Object.entries(negativesMapCalls)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10); // Top 10

      setNegativesDataCalls(negativesChartCalls);
      console.log('📊 Dados Calls:', negativesChartCalls);

      // 3. Positives Data (By category)
      const positivesMap: Record<string, number> = {};

      // Telegram positives
      safeRegistros
        .filter(r => r.tipo === 'positivo')
        .forEach(r => {
          const key = r.categoria || 'Geral';
          positivesMap[key] = (positivesMap[key] || 0) + 1;
        });

      // Call positives
      callItems
        .filter(i => i.status === 'positive')
        .forEach(i => {
          const key = i.category || 'Geral';
          positivesMap[key] = (positivesMap[key] || 0) + 1;
        });

      const positivesChart: ChartDataPoints[] = Object.entries(positivesMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      setPositivesData(positivesChart);

      // 4. Inspectors Activity
      const inspectorsMap: Record<string, number> = {};

      // Telegram inspectors
      safeRegistros.forEach((r: any) => {
        const name = r.profiles?.full_name || 'Desconhecido';
        inspectorsMap[name] = (inspectorsMap[name] || 0) + 1;
      });

      // Call inspectors
      filteredCalls.forEach((c: any) => {
        const name = c.profiles?.full_name || 'Desconhecido';
        inspectorsMap[name] = (inspectorsMap[name] || 0) + 1;
      });

      const inspectorsChart: ChartDataPoints[] = Object.entries(inspectorsMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      setInspectorsData(inspectorsChart);


      // Fetch gestores with their stats for ranking preview AND chart
      const { data: gestoresData } = await (supabase
        .from('gestores') as any)
        .select('id, nome, ativo, grupos_calls')
        .eq('ativo', true);

      if (managersList.length === 0 && gestoresData) {
        setManagersList(gestoresData.map(g => ({
          id: g.id,
          nome: g.nome,
          grupos_calls: g.grupos_calls
        })));
      }

      // Filter gestores by selected Manager if active
      let filteredGestoresData = gestoresData || [];
      if (selectedManager && selectedManager !== 'all') {
        filteredGestoresData = filteredGestoresData.filter(g => g.id === selectedManager);
      }

      // Filter gestores by Group if active
      if (selectedGroup && selectedGroup !== 'all') {
        filteredGestoresData = filteredGestoresData.filter(g => {
          const grupos = g.grupos_calls || [];
          return grupos.includes(selectedGroup);
        });
      }

      let gestoresChartForState: ManagerData[] = [];


      if (gestoresData) {
        // Use filteredGestoresData for charts and calculations to reflect filters
        // Filter only managers with Call Groups
        const gestoresWithStats = filteredGestoresData
          .filter(g => g.grupos_calls && Array.isArray(g.grupos_calls) && g.grupos_calls.length > 0)
          .map((gestor) => {
            const gestorMensagens = mensagensData?.filter(m => m.gestor_id === gestor.id) || [];
            const totalGestorMensagens = gestorMensagens.reduce((sum, m) => sum + (m.quantidade_audios || 0) + (m.quantidade_textos || 0) + (m.quantidade_videos || 0), 0);

            // Telegram stats
            const gestorRegistros = safeRegistros.filter(r => r.gestor_id === gestor.id);
            const gestorPositivosTelegram = gestorRegistros.filter(r => r.tipo === 'positivo').length;
            const gestorNegativosTelegram = gestorRegistros.filter(r => r.tipo === 'negativo').length;

            // Call stats
            const gestorCalls = filteredCalls.filter(c => c.manager_id === gestor.id);
            const gestorCallIds = gestorCalls.map(c => c.id);
            const gestorCallItems = callItems.filter(i => gestorCallIds.includes(i.inspection_id));

            const gestorPositivosCalls = gestorCallItems.filter(i => i.status === 'positive').length;
            const gestorNegativosCalls = gestorCallItems.filter(i => i.status === 'negative').length;

            // Totals
            const gestorPositivos = gestorPositivosTelegram + gestorPositivosCalls;
            const gestorNegativos = gestorNegativosTelegram + gestorNegativosCalls;
            const totalFiscalizacoes = gestorRegistros.length + gestorCalls.length;

            return {
              id: gestor.id,
              nome: gestor.nome,
              username_telegram: null,
              status: 'ativo',
              mensagens: totalGestorMensagens,
              positivos: gestorPositivos,
              negativos: gestorNegativos,
              scoreFinal: totalGestorMensagens - gestorNegativos,
              totalFiscalizacoes
            };
          });

        gestoresChartForState = gestoresWithStats.map(g => ({
          name: g.nome,
          total: g.totalFiscalizacoes,
          positivos: g.positivos,
          negativos: g.negativos
        })).sort((a, b) => b.total - a.total); // Sort by total activity




        setManagersChartData(gestoresChartForState);
        setManagersChartData(gestoresChartForState);


        // Calculate Telegram Performance Data
        // Filter managers for Telegram (maybe all active managers or those without Call Groups? User said "Gestores do Telegram")
        // I'll include all managers who have Telegram activity or just all managers to correspond to "Performance por Gestor do Telegram"
        const gestoresTelegramChart: ManagerTelegramData[] = filteredGestoresData.map(gestor => {
          const gestorRegistros = safeRegistros.filter(r => r.gestor_id === gestor.id);
          const gestorPositivos = gestorRegistros.filter(r => r.tipo === 'positivo').length;
          const gestorNegativos = gestorRegistros.filter(r => r.tipo === 'negativo').length;
          const total = gestorPositivos + gestorNegativos;

          // Find Top Issue (Negative)
          const issuesMap: Record<string, number> = {};
          gestorRegistros
            .filter(r => r.tipo === 'negativo')
            .forEach(r => {
              const key = r.categoria || r.observacao || 'Outros';
              // Shorten if too long?
              const cleanKey = key.length > 30 ? r.categoria || 'Observação' : key;
              issuesMap[cleanKey] = (issuesMap[cleanKey] || 0) + 1;
            });

          let topIssueName = '';
          let topIssueCount = 0;
          Object.entries(issuesMap).forEach(([name, count]) => {
            if (count > topIssueCount) {
              topIssueCount = count;
              topIssueName = name;
            }
          });

          const otherNegativesCount = gestorNegativos - topIssueCount;

          return {
            name: gestor.nome,
            total,
            positivos: gestorPositivos,
            negativos: gestorNegativos,
            topIssueName,
            topIssueCount,
            otherNegativesCount
          };
        }).filter(g => g.total > 0).sort((a, b) => b.negativos - a.negativos); // Sort by Negatives Descending

        setManagersTelegramChartData(gestoresTelegramChart);


        // Calculate Call Hours Data
        const callHoursMap = new Map<string, CallHoursData>();

        // Init map with managers who have call groups AND match the filters
        filteredGestoresData.forEach(g => {
          // Type assertion for legacy support if grupos_calls is unknown
          const grupos = g.grupos_calls;
          if (grupos && Array.isArray(grupos) && grupos.length > 0) {
            callHoursMap.set(g.id, {
              gestorId: g.id,
              gestorName: g.nome,
              grupos: grupos,
              totalCalls: 0,
              totalHours: 0
            });
          }
        });

        // Use filteredCalls (matches selected period) or fetch specific period logic if needed.
        // The user request says "sum of hours of calls registered". Assuming for the SELECTED PERIOD.
        filteredCalls.forEach(call => {
          if (callHoursMap.has(call.manager_id)) {
            const stats = callHoursMap.get(call.manager_id)!;
            stats.totalCalls += 1;

            if (call.start_time && call.end_time) {
              // Calculate duration in hours
              // Need to handle potential full datetime vs simple time strings if they exist
              // Assuming start_time/end_time are HH:MM:SS or ISO strings.
              // Based on FiscalizacaoCalls, they seem to be HH:MM time inputs.
              // We need date context to calc difference, but assuming same day.

              const start = new Date(`1970-01-01T${call.start_time}`);
              const end = new Date(`1970-01-01T${call.end_time}`);

              if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                let diffMs = end.getTime() - start.getTime();
                if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000; // Handle overnight if needed (rare for this use case likely)
                const hours = diffMs / (1000 * 60 * 60);
                stats.totalHours += hours;
              }
            }
          }
        });

        const sortedCallHours = Array.from(callHoursMap.values())
          .sort((a, b) => b.totalHours - a.totalHours);

        setCallHoursData(sortedCallHours);

      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }


  const periodLabel = period === 'week'
    ? `Semana ${selectedWeek} - ${MONTHS[selectedMonth - 1]}`
    : MONTHS[selectedMonth - 1];

  return (
    <DashboardLayout>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none -z-10" />
      <div className="p-4 lg:p-8 pt-20 lg:pt-8 space-y-8 relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
              Dashboard Geral
            </h1>
            <p className="text-muted-foreground">
              Visão geral da performance dos gestores e estatísticas do sistema.
            </p>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card variant="glass" className="animate-fade-in">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Gestores Ativos</p>
                  {loadingData ? (
                    <Skeleton className="h-7 w-12 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold mt-1">{stats?.totalGestores}</p>
                  )}
                </div>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="glass" className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Fiscalizações</p>
                  {loadingData ? (
                    <Skeleton className="h-7 w-12 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold mt-1">{stats?.fiscalizacoesPeriodo}</p>
                  )}
                </div>
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <ClipboardCheck className="w-5 h-5 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>



          <Card variant="glass" className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Positivos</p>
                  {loadingData ? (
                    <Skeleton className="h-7 w-12 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold mt-1 text-success">{stats?.positivosPeriodo}</p>
                  )}
                </div>
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="glass" className="animate-fade-in" style={{ animationDelay: '0.25s' }}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Negativos</p>
                  {loadingData ? (
                    <Skeleton className="h-7 w-12 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold mt-1 text-destructive">{stats?.negativosPeriodo}</p>
                  )}
                </div>
                <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Call Hours Table (Moved) */}
        {!loadingData && (
          <Card className="mb-8 backdrop-blur-md bg-card/40 border-white/10 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Resumo de Horas em Calls
              </CardTitle>
              <CardDescription>
                Somatório de horas de calls registradas para gestores em grupos de call
              </CardDescription>
            </CardHeader>
            <CardHeader>
              <div className="mt-4 flex flex-wrap gap-4 p-4 rounded-xl bg-secondary/10 border border-border">
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">Período:</Label>
                  <Select value={period} onValueChange={(v) => setPeriod(v as 'week' | 'month')}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="week">Semanal</SelectItem>
                      <SelectItem value="month">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {!dateRange && (
                  <MonthYearPicker
                    selectedMonth={selectedMonth}
                    selectedYear={selectedYear}
                    onMonthChange={(v) => setSelectedMonth(parseInt(v))}
                    onYearChange={(v) => setSelectedYear(parseInt(v))}
                  />
                )}

                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                          "w-[260px] justify-start text-left font-normal",
                          !dateRange && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} -{" "}
                              {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
                            </>
                          ) : (
                            format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
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
                        onSelect={(range) => {
                          setDateRange(range);
                          if (range) setPeriod('custom');
                          else setPeriod('month');
                        }}
                        numberOfMonths={2}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                  {dateRange && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setDateRange(undefined);
                        setPeriod('month');
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">Gestor:</Label>
                  <Select value={selectedManager} onValueChange={setSelectedManager}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {managersList
                        .filter(g => g.grupos_calls && g.grupos_calls.length > 0)
                        .map((g) => (
                          <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">Grupo:</Label>
                  <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="Geral">Geral</SelectItem>
                      <SelectItem value="Grupo Start">Grupo Start</SelectItem>
                      <SelectItem value="Grupo Vip">Grupo Vip</SelectItem>
                      <SelectItem value="Grupo Premium">Grupo Premium</SelectItem>
                      <SelectItem value="Grupo Elite">Grupo Elite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {period === 'week' && (
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
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Gestor</TableHead>
                      <TableHead>Grupos</TableHead>
                      <TableHead className="text-right">Total de Calls</TableHead>
                      <TableHead className="text-right">Horas Totais</TableHead>
                      <TableHead className="text-right">Média Horas/ por dia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {callHoursData
                      .slice(0, showAllManagers ? undefined : 3)
                      .map((row) => (
                        <TableRow key={row.gestorId}>
                          <TableCell className="font-medium">{row.gestorName}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {row.grupos.map((g, i) => (
                                <Badge key={i} variant="outline" className="text-xs bg-secondary/50 border-secondary">
                                  {g}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{row.totalCalls}</TableCell>
                          <TableCell className="text-right font-bold text-primary">
                            {row.totalHours.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}h
                          </TableCell>
                          <TableCell className="text-right">
                            {row.totalCalls > 0
                              ? (row.totalHours / row.totalCalls).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'h'
                              : '0,00h'}
                          </TableCell>
                        </TableRow>
                      ))}
                    {callHoursData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                          Nenhum registro encontrado para os filtros selecionados.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {callHoursData.length > 3 && (
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={() => setShowAllManagers(!showAllManagers)}
                    className="text-sm font-medium text-emerald-500 hover:text-emerald-400 transition-colors"
                  >
                    {showAllManagers ? 'Ver menos' : 'Ver lista completa de gestores'}
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Gráficos de Problemas Identificados - Separados por Fonte */}
        {!loadingData && (
          <div className="space-y-8">
            <ChartProblemasTelegram
              data={negativesDataTelegram}
            />
            <ChartProblemasCalls
              data={negativesDataCalls}
            />
          </div>
        )}

        {/* Outros Charts */}
        {!loadingData && (
          <div className="mb-8 animate-fade-in">
            {/* Performance Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <ChartComparativoGestores data={managersChartData} />
              <ChartPerformanceTelegram data={managersTelegramChartData} />
            </div>

            {/* Evolução Chart Re-positioned */}
            <div className="mb-8 animate-fade-in">
              <ChartRegistrosPorPeriodo data={trendsData} />
            </div>
          </div>
        )}


        {/* Content grid */}
        <div className="grid grid-cols-1 gap-6">
          {/* Quick actions */}
          <Card variant="elevated" className="backdrop-blur-md bg-card/40 border border-white/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Ações Rápidas
              </CardTitle>
              <CardDescription>Acesse as principais funcionalidades</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card variant="interactive" className="p-4" onClick={() => navigate('/fiscalizacao')}>
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <ClipboardCheck className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Telegram</p>
                    <p className="text-xs text-muted-foreground">Registrar ponto</p>
                  </div>
                </div>
              </Card>

              <Card variant="interactive" className="p-4" onClick={() => navigate('/fiscalizacao-calls')}>
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <div className="w-6 h-6 text-purple-500">
                      <Video className="w-6 h-6" />
                    </div>
                  </div>
                  <div>
                    <p className="font-medium">Calls</p>
                    <p className="text-xs text-muted-foreground">Fiscalizar chamada</p>
                  </div>
                </div>
              </Card>

              <Card variant="interactive" className="p-4" onClick={() => navigate('/gestores')}>
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                    <Users className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium">Gestores</p>
                    <p className="text-xs text-muted-foreground">Ver lista</p>
                  </div>
                </div>
              </Card>

              <Card variant="interactive" className="p-4" onClick={() => navigate('/rankings')}>
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                    <Trophy className="w-6 h-6 text-warning" />
                  </div>
                  <div>
                    <p className="font-medium">Rankings</p>
                    <p className="text-xs text-muted-foreground">Ver classificação</p>
                  </div>
                </div>
              </Card>

              <Card variant="interactive" className="p-4" onClick={() => navigate('/mensagens')}>
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Mensagens</p>
                    <p className="text-xs text-muted-foreground">Semanais</p>
                  </div>
                </div>
              </Card>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout >
  );
}
