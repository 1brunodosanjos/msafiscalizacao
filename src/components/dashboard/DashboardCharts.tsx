import React from 'react';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    Cell,
    PieChart,
    Pie,
    AreaChart,
    Area
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { getWeeksInMonth } from "date-fns";

// --- Types ---
export interface ChartDataPoints {
    name: string;
    value: number;
    [key: string]: any;
}

export interface TrendData {
    date: string;
    count: number;
}

export interface ManagerData {
    name: string;
    total: number;
    positivos: number;
    negativos: number;
}

export interface ManagerTelegramData extends ManagerData {
    topIssueName: string;
    topIssueCount: number;
    otherNegativesCount: number;
}

export interface CallHoursData {
    gestorId: string;
    gestorName: string;
    grupos: string[];
    totalCalls: number;
    totalHours: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

// --- Components ---

// 1. Gráfico de registros por período
export function ChartRegistrosPorPeriodo({ data }: { data: TrendData[] }) {
    const [viewType, setViewType] = React.useState<'mensal' | 'semanal'>('mensal');

    const chartData = React.useMemo(() => {
        if (viewType === 'mensal') return data;

        // Aggregate by week for 'semanal' view
        const weeklyMap = new Map<string, number>();

        data.forEach(item => {
            const [day, month] = item.date.split('/').map(Number);
            // Simple week calculation: Week 1 (1-7), Week 2 (8-14), etc.
            const weekNum = Math.ceil(day / 7);
            const key = `Semana ${weekNum}`;

            weeklyMap.set(key, (weeklyMap.get(key) || 0) + item.count);
        });

        return Array.from(weeklyMap.entries()).map(([date, count]) => ({
            date,
            count
        }));
    }, [data, viewType]);

    return (
        <Card className="col-span-full lg:col-span-2 backdrop-blur-md bg-card/40 border-white/10 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-1">
                    <CardTitle>Atividade de Fiscalização</CardTitle>
                    <CardDescription>Volume de inspeções {viewType === 'mensal' ? 'diárias' : 'semanais'}</CardDescription>
                </div>
                {/* Toggle Button */}
                <div className="flex bg-secondary/30 rounded-lg p-1">
                    <button
                        onClick={() => setViewType('mensal')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 ${viewType === 'mensal' ? 'bg-secondary text-white shadow-sm' : 'text-muted-foreground hover:text-white'
                            }`}
                    >
                        Mensal
                    </button>
                    <button
                        onClick={() => setViewType('semanal')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 ${viewType === 'semanal' ? 'bg-secondary text-white shadow-sm' : 'text-muted-foreground hover:text-white'
                            }`}
                    >
                        Semanal
                    </button>
                </div>
            </CardHeader>
            <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="5%" stopColor="#34d399" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10, fill: '#9ca3af' }}
                            axisLine={false}
                            tickLine={false}
                            tickMargin={10}
                        />
                        <YAxis
                            hide={true}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '0.5rem', color: '#fff' }}
                            itemStyle={{ color: '#34d399' }}
                            cursor={{ stroke: '#34d399', strokeWidth: 1, strokeDasharray: '4 4' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="count"
                            stroke="#34d399"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorFill)"
                            animationDuration={2000}
                            animationEasing="ease-in-out"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}

// 2. Gráfico de pontos negativos - TELEGRAM
// 2. Gráfico de pontos negativos - TELEGRAM
export function ChartProblemasTelegram({ data }: { data: ChartDataPoints[] }) {
    const total = data.reduce((acc, curr) => acc + curr.value, 0);

    return (
        <Card className="col-span-full backdrop-blur-md bg-card/40 border-white/10 shadow-lg">
            <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <CardTitle>Problemas Identificados - Fiscalização Telegram</CardTitle>
                        <CardDescription>Análise de recorrências no Telegram</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="h-[400px]">
                {!data || data.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center">
                            <p className="text-muted-foreground text-lg">Nenhum problema identificado</p>
                            <p className="text-muted-foreground text-sm mt-2">Não há dados de fiscalização do Telegram para o período selecionado.</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col md:flex-row items-center h-full w-full">
                        {/* Gráfico Donut */}
                        <div className="w-full md:w-1/2 h-[300px] md:h-full relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={data}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={80}
                                        outerRadius={110}
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {data.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'hsl(var(--popover))',
                                            borderColor: 'hsl(var(--border))',
                                            borderRadius: 'var(--radius)',
                                            padding: '8px 12px'
                                        }}
                                        itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                                        formatter={(value: number, name: string) => [`${value} ocorrências`, name]}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            {/* Texto Central */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-4xl font-bold tracking-tighter text-foreground">{total}</span>
                                <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest mt-1">Registros</span>
                            </div>
                        </div>

                        {/* Legenda Customizada */}
                        <div className="w-full md:w-1/2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 pl-4 md:pl-8 py-4 content-center">
                            {data.map((entry, index) => {
                                const percent = ((entry.value / total) * 100).toFixed(0);
                                return (
                                    <div key={`legend-${index}`} className="flex items-start gap-3">
                                        <div
                                            className="w-3 h-3 rounded-full mt-1.5 shrink-0"
                                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                        />
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-semibold text-foreground text-sm truncate" title={entry.name}>{entry.name}</span>
                                            <span className="text-muted-foreground text-sm">
                                                {percent}% • {entry.value} ocorrências
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// 2B. Gráfico de pontos negativos - CALLS
// 2B. Gráfico de pontos negativos - CALLS
export function ChartProblemasCalls({ data }: { data: ChartDataPoints[] }) {
    const total = data.reduce((acc, curr) => acc + curr.value, 0);

    return (
        <Card className="col-span-full backdrop-blur-md bg-card/40 border-white/10 shadow-lg">
            <CardHeader>
                <CardTitle>Problemas Identificados - Fiscalização de Calls</CardTitle>
                <CardDescription>Análise de recorrências em chamadas/vídeos</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
                {!data || data.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center">
                            <p className="text-muted-foreground text-lg">Nenhum problema identificado</p>
                            <p className="text-muted-foreground text-sm mt-2">Não há dados de fiscalização de Calls para o período selecionado.</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col md:flex-row items-center h-full w-full">
                        {/* Gráfico Donut */}
                        <div className="w-full md:w-1/2 h-[300px] md:h-full relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={data}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={80}
                                        outerRadius={110}
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {data.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'hsl(var(--popover))',
                                            borderColor: 'hsl(var(--border))',
                                            borderRadius: 'var(--radius)',
                                            padding: '8px 12px'
                                        }}
                                        itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                                        formatter={(value: number, name: string) => [`${value} ocorrências`, name]}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            {/* Texto Central */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-4xl font-bold tracking-tighter text-foreground">{total}</span>
                                <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest mt-1">Registros</span>
                            </div>
                        </div>

                        {/* Legenda Customizada */}
                        <div className="w-full md:w-1/2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 pl-4 md:pl-8 py-4 content-center">
                            {data.map((entry, index) => {
                                const percent = ((entry.value / total) * 100).toFixed(0);
                                return (
                                    <div key={`legend-${index}`} className="flex items-start gap-3">
                                        <div
                                            className="w-3 h-3 rounded-full mt-1.5 shrink-0"
                                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                        />
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-semibold text-foreground text-sm truncate" title={entry.name}>{entry.name}</span>
                                            <span className="text-muted-foreground text-sm">
                                                {percent}% • {entry.value} ocorrências
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// 3. Gráfico de pontos positivos
export function ChartPontosPositivos({ data }: { data: ChartDataPoints[] }) {
    return (
        <Card className="col-span-full md:col-span-1 backdrop-blur-md bg-card/40 border-white/10 shadow-lg">
            <CardHeader>
                <CardTitle>Destaques Positivos</CardTitle>
                <CardDescription>Categorias mais elogiadas</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] flex justify-center">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)' }}
                            itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                        />
                        <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ paddingTop: '20px' }} />
                    </PieChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}

// 4. Gráfico por gestor
// 4. Gráfico por gestor
export function ChartComparativoGestores({ data }: { data: ManagerData[] }) {
    const [showAll, setShowAll] = React.useState(false);

    // Sort by Total Fiscalizations/Calls (Descending)
    const sortedData = [...data].sort((a, b) => b.total - a.total);

    const displayedData = showAll ? sortedData : sortedData.slice(0, 4);

    return (
        <Card className="col-span-full backdrop-blur-md bg-card/40 border-white/10 shadow-lg">
            <CardHeader>
                <CardTitle>Performance por Gestor de Call</CardTitle>
                <CardDescription>Comparativo de pontos qualitativos</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    {displayedData.map((manager, index) => {
                        const totalAssessedPoints = manager.positivos + manager.negativos; // total assessed points (positive + negative occurrences)
                        const positiveRate = totalAssessedPoints > 0 ? (manager.positivos / totalAssessedPoints) * 100 : 0;

                        return (
                            <div key={manager.name} className="space-y-2">
                                <div className="flex items-center justify-between text-sm font-bold tracking-wider">
                                    <span className="uppercase text-white">{manager.name}</span>
                                    <span className="text-emerald-400">
                                        {manager.total} CALLS - {positiveRate.toFixed(0)}% POSITIVO
                                    </span>
                                </div>
                                <div className="h-3 w-full rounded-full bg-rose-900/50 overflow-hidden relative">
                                    {/* Background is the 'Negative' part effectively if we consider the bar as total. 
                                        Actually image shows Green bar on left, Wine/Red bar on right (remainder).
                                        So bg-rose-900/50 is good for 'remainder', and we overlay green. 
                                    */}
                                    <div
                                        className="h-full bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                                        style={{ width: `${positiveRate}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Legenda */}
                <div className="mt-8 flex items-center justify-center gap-8 text-xs font-bold tracking-wider uppercase">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="text-emerald-500">Satisfatório</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-rose-900/80" />
                        <span className="text-rose-400">Ajuste Necessário</span>
                    </div>
                </div>

                {/* Botão Ver Mais */}
                {data.length > 4 && (
                    <div className="mt-6 flex justify-center">
                        <button
                            onClick={() => setShowAll(!showAll)}
                            className="text-sm font-medium text-muted-foreground hover:text-white transition-colors"
                        >
                            {showAll ? 'Ver menos' : 'Ver lista completa de gestores'}
                        </button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// 5. Gráfico por fiscalizador
export function ChartFiscalizadores({ data }: { data: ChartDataPoints[] }) {
    return (
        <Card className="col-span-full md:col-span-1 backdrop-blur-md bg-card/40 border-white/10 shadow-lg">
            <CardHeader>
                <CardTitle>Atividade de Fiscalização</CardTitle>
                <CardDescription>Registros por fiscalizador</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.3} />
                        <XAxis type="number" allowDecimals={false} hide />
                        <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius)' }}
                            itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.1 }}
                        />
                        <Bar dataKey="value" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} name="Fiscalizações" barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}

// 6. Gráfico Performance Telegram
export function ChartPerformanceTelegram({ data }: { data: ManagerTelegramData[] }) {
    const [showAll, setShowAll] = React.useState(false);

    // Sort by Total Negatives (descending)
    const sortedData = [...data].sort((a, b) => b.negativos - a.negativos);

    const displayedData = showAll ? sortedData : sortedData.slice(0, 4);

    return (
        <Card className="col-span-full backdrop-blur-md bg-card/40 border-white/10 shadow-lg">
            <CardHeader>
                <CardTitle>Performance por Gestor do Telegram</CardTitle>
                <CardDescription>Destaque para maior quantidade de registros negativos</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    {displayedData.map((manager, index) => {
                        const totalAssessedPoints = manager.positivos + manager.negativos;
                        const positiveRate = totalAssessedPoints > 0 ? (manager.positivos / totalAssessedPoints) * 100 : 0;

                        return (
                            <div key={manager.name} className="space-y-2">
                                <div className="flex items-center justify-between text-sm font-bold tracking-wider">
                                    <span className="uppercase text-white">{manager.name}</span>
                                    <span className="text-emerald-400 truncate max-w-[200px] md:max-w-md text-right">
                                        {manager.topIssueCount > 0 ? (
                                            <>
                                                <span className="text-rose-400">
                                                    {manager.topIssueCount} {manager.topIssueName}
                                                </span>
                                                {manager.otherNegativesCount > 0 && (
                                                    <span className="text-muted-foreground ml-1">
                                                        e {manager.otherNegativesCount} outros
                                                    </span>
                                                )}
                                                <span className="text-emerald-400 ml-2">
                                                    - {positiveRate.toFixed(0)}% POSITIVO
                                                </span>
                                            </>
                                        ) : (
                                            <>SEM PROBLEMAS - {positiveRate.toFixed(0)}% POSITIVO</>
                                        )}
                                    </span>
                                </div>
                                <div className="h-3 w-full rounded-full bg-rose-900/50 overflow-hidden relative">
                                    <div
                                        className="h-full bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                                        style={{ width: `${positiveRate}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Legenda */}
                <div className="mt-8 flex items-center justify-center gap-8 text-xs font-bold tracking-wider uppercase">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="text-emerald-500">Satisfatório</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-rose-900/80" />
                        <span className="text-rose-400">Ajuste Necessário</span>
                    </div>
                </div>

                {/* Botão Ver Mais */}
                {data.length > 4 && (
                    <div className="mt-6 flex justify-center">
                        <button
                            onClick={() => setShowAll(!showAll)}
                            className="text-sm font-medium text-muted-foreground hover:text-white transition-colors"
                        >
                            {showAll ? 'Ver menos' : 'Ver lista completa de gestores'}
                        </button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
