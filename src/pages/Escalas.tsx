import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, CalendarClock, Trash2, Edit, Save, Loader2, Phone, MessageCircle, AlertCircle, Users, Copy, FilePlus2, SaveAll, CalendarDays } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { CronogramaCallsView } from '@/components/scales/CronogramaCalls';

// Types
interface Gestor {
    id: string;
    nome: string;
    setores: string[];
    ativo: boolean;
    grupos_calls: string[] | null;
}

interface Grupo {
    id: string;
    nome: string;
}

interface GestorTelegramEscala {
    id: string;
    gestor_id: string;
    grupo_id: string | null;
    dia_semana: string;
    entrada: string | null;
    saida: string | null;
    intervalo_inicio: string | null;
    intervalo_fim: string | null;
    status: 'trabalho' | 'folga';
    observacao: string | null;
}

interface GestorCallsEscala {
    id: string;
    gestor_id: string;
    grupo_id: string | null;
    dia_semana: string;
    horario: string;
    observacao: string | null;
    grupo_nome?: string;
}

// Fixed Data
const DIAS_SEMANA = [
    { value: 'seg', label: 'Segunda-feira' },
    { value: 'ter', label: 'Terça-feira' },
    { value: 'qua', label: 'Quarta-feira' },
    { value: 'qui', label: 'Quinta-feira' },
    { value: 'sex', label: 'Sexta-feira' },
    { value: 'sab', label: 'Sábado' },
    { value: 'dom', label: 'Domingo' },
];

export default function Escalas() {
    const { profile, user, loading, permissions } = useAuth();
    const navigate = useNavigate();
    const isAdmin = profile?.role === 'admin';
    const canEdit = isAdmin || permissions?.access_scales;
    const isFiscalizador = !canEdit;

    useEffect(() => {
        if (!loading && !user) {
            navigate('/auth');
        }
    }, [user, loading, navigate]);

    // Global State
    const [gestores, setGestores] = useState<Gestor[]>([]);
    const [grupos, setGrupos] = useState<Grupo[]>([]);
    const [activeTab, setActiveTab] = useState('calls');

    // Selection State
    const [selectedGestorId, setSelectedGestorId] = useState<string | null>(null);
    const [searchGestor, setSearchGestor] = useState('');

    // Data State
    const [shiftScales, setShiftScales] = useState<GestorTelegramEscala[]>([]);
    const [callScales, setCallScales] = useState<GestorCallsEscala[]>([]);
    const [loadingData, setLoadingData] = useState(false);
    const [loadingGestores, setLoadingGestores] = useState(true);
    const [savedStates, setSavedStates] = useState<Record<string, boolean>>({}); // Track save state per day

    // View Mode
    const [viewMode, setViewMode] = useState<'empty' | 'edit'>('empty');

    // Modals
    const [isCallModalOpen, setIsCallModalOpen] = useState(false);
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const [cronogramaOpen, setCronogramaOpen] = useState(false);

    // Forms
    const [callForm, setCallForm] = useState({
        dia_semana: 'seg',
        horario: '',
        grupo_id: '',
        observacao: ''
    });
    const [editingCallId, setEditingCallId] = useState<string | null>(null);

    const [batchForm, setBatchForm] = useState({
        days: [] as string[],
        grupo_id: '',
        entrada: '',
        saida: '',
        intervalo_inicio: '',
        intervalo_fim: '',
        status: 'trabalho',
        observacao: ''
    });

    // --- INITIAL FETCH ---
    useEffect(() => {
        const init = async () => {
            setLoadingGestores(true);
            const [gRes, grpRes] = await Promise.all([
                (supabase.from('gestores') as any).select('*').eq('ativo', true).order('nome'),
                (supabase.from('grupos') as any).select('id, nome').order('nome')
            ]);

            if (gRes.error) {
                console.error('Error fetching gestores:', gRes.error);
                toast.error(`Erro ao carregar gestores: ${gRes.error.message}`);
            }
            if (gRes.data) {
                setGestores(gRes.data.map((g: any) => {
                    const mappedSetores = Array.from(new Set([
                        ...(g.setores || []),
                        g.setor || 'calls',
                        ...(g.no_grupo_telegram ? ['telegram'] : [])
                    ]));

                    return {
                        ...g,
                        setores: mappedSetores
                    };
                }));
            }

            if (grpRes.error) {
                console.error('Error fetching grupos:', grpRes.error);
                toast.error(`Erro ao carregar grupos: ${grpRes.error.message}`);
            }
            if (grpRes.data) setGrupos(grpRes.data);

            setLoadingGestores(false);
        };
        init();
    }, []);

    // --- SELECTION LOGIC ---
    useEffect(() => {
        if (selectedGestorId) {
            setViewMode('empty');
            setSavedStates({});
            if (activeTab === 'calls') fetchCallScales(selectedGestorId);
            else fetchShiftScales(selectedGestorId);
        }
    }, [selectedGestorId, activeTab]);

    const fetchShiftScales = async (gestorId: string) => {
        setLoadingData(true);
        const tableName = 'gestor_telegram_escala';

        const { data } = await (supabase.from(tableName) as any).select('*').eq('gestor_id', gestorId);
        if (data && data.length > 0) {
            setShiftScales(data);
            setViewMode('edit');
        } else {
            setShiftScales([]);
            setViewMode('empty');
        }
        setLoadingData(false);
    };

    const fetchCallScales = async (gestorId: string) => {
        setLoadingData(true);
        const { data } = await (supabase.from('gestor_calls_escala') as any).select('*, grupos(nome)').eq('gestor_id', gestorId);
        if (data && data.length > 0) {
            setCallScales(data.map((c: any) => ({ ...c, grupo_nome: c.grupos?.nome })));
            setViewMode('edit');
        } else {
            setCallScales([]);
            setViewMode('empty');
        }
        setLoadingData(false);
    };

    // --- SHIFT ACTIONS (Telegram / Trafego) ---

    const handleCreateShiftScale = async () => {
        if (!selectedGestorId) return;
        setLoadingData(true);

        const tableName = 'gestor_telegram_escala';

        // Pre-fill 7 days
        const geralGroup = grupos.find(g => g.nome.toLowerCase().includes('geral'));
        const defaultGroupId = geralGroup?.id || grupos[0]?.id || null;

        const newScales = DIAS_SEMANA.map(d => ({
            gestor_id: selectedGestorId,
            dia_semana: d.value,
            grupo_id: defaultGroupId,
            status: 'trabalho',
            entrada: null,
            saida: null,
            intervalo_inicio: null,
            intervalo_fim: null,
            observacao: null
        }));

        const { data, error } = await (supabase.from(tableName) as any)
            .insert(newScales)
            .select();

        if (error) {
            toast.error('Erro ao criar escala.');
            console.error(error);
        } else {
            setShiftScales(data);
            setViewMode('edit');
            toast.success('Escala criada com sucesso!');
        }
        setLoadingData(false);
    };

    const handleUpdateShiftDay = (dia: string, field: string, value: any) => {
        if (!canEdit) return;

        setShiftScales(prev => prev.map(item => {
            if (item.dia_semana === dia) {
                // Logic: If status becomes 'folga', clear times
                const updates: any = { [field]: value };
                if (field === 'status' && value === 'folga') {
                    updates.entrada = null;
                    updates.saida = null;
                    updates.intervalo_inicio = null;
                    updates.intervalo_fim = null;
                }
                return { ...item, ...updates };
            }
            return item;
        }));

        // Mark as unsaved
        setSavedStates(prev => ({ ...prev, [dia]: false }));
    };

    const handleSaveShiftDay = async (dia: string, silent = false) => {
        if (!canEdit) return;
        const record = shiftScales.find(r => r.dia_semana === dia);
        if (!record) return;

        // Basic validation
        if (record.status === 'trabalho' && !record.grupo_id) {
            if (!silent) toast.error(`Selecione um grupo para ${DIAS_SEMANA.find(d => d.value === dia)?.label}`);
            return;
        }

        const tableName = 'gestor_telegram_escala';

        const { error } = await (supabase.from(tableName) as any)
            .update({
                grupo_id: record.grupo_id,
                status: record.status,
                entrada: record.entrada,
                saida: record.saida,
                intervalo_inicio: record.intervalo_inicio,
                intervalo_fim: record.intervalo_fim,
                observacao: record.observacao
            })
            .eq('id', record.id);

        if (error) {
            if (!silent) toast.error('Erro ao salvar alteração.');
            console.error(error);
        } else {
            if (!silent) toast.success('Salvo!');
            setSavedStates(prev => ({ ...prev, [dia]: true }));
        }
    };

    const handleBatchApply = async () => {
        if (!canEdit || !selectedGestorId) return;
        if (batchForm.days.length === 0) {
            toast.warning('Selecione pelo menos um dia.');
            return;
        }

        const tableName = 'gestor_telegram_escala';

        // We need to apply logic:
        // Update local state AND backend
        // Backend: batch upsert (based on gestor + day unique)
        const upserts = batchForm.days.map(day => ({
            gestor_id: selectedGestorId,
            dia_semana: day,
            grupo_id: batchForm.grupo_id || grupos[0]?.id,
            status: batchForm.status,
            entrada: batchForm.entrada || null,
            saida: batchForm.saida || null,
            intervalo_inicio: batchForm.intervalo_inicio || null,
            intervalo_fim: batchForm.intervalo_fim || null,
            observacao: batchForm.observacao || null
        }));

        const { error } = await (supabase.from(tableName) as any)
            .upsert(upserts, { onConflict: 'gestor_id, dia_semana' });

        if (error) {
            toast.error('Erro ao aplicar em lote.');
            console.error(error);
        } else {
            toast.success('Escala aplicada em lote!');
            setIsBatchModalOpen(false);
            fetchShiftScales(selectedGestorId); // Reload to ensure sync
        }
    };

    // --- CALLS ACTIONS (Existing Logic Preserved/Adapted) ---

    const handleCreateCallScale = () => {
        setViewMode('edit');
        openCallModal();
    };

    const handleSaveCall = async () => {
        if (!selectedGestorId || !callForm.horario || !callForm.grupo_id) return;

        const payload = {
            gestor_id: selectedGestorId,
            dia_semana: callForm.dia_semana,
            horario: callForm.horario,
            grupo_id: callForm.grupo_id,
            observacao: callForm.observacao
        };

        let error;
        if (editingCallId) {
            const res = await (supabase.from('gestor_calls_escala') as any).update(payload).eq('id', editingCallId);
            error = res.error;
        } else {
            const res = await (supabase.from('gestor_calls_escala') as any).insert(payload);
            error = res.error;
        }

        if (error) {
            if (error.code === '23505') toast.error('Conflito: Já existe call neste horário.');
            else toast.error('Erro ao salvar.');
        } else {
            toast.success('Call salva.');
            setIsCallModalOpen(false);
            setEditingCallId(null);
            fetchCallScales(selectedGestorId);
        }
    };

    const handleDeleteCall = async (id: string) => {
        if (!canEdit) return;
        if (!confirm('Deseja excluir?')) return;

        const { error } = await (supabase.from('gestor_calls_escala') as any).delete().eq('id', id);
        if (error) toast.error('Erro ao deletar.');
        else {
            toast.success('Deletado.');
            const left = callScales.filter(c => c.id !== id);
            setCallScales(left);
            if (left.length === 0) setViewMode('empty');
        }
    };

    const openCallModal = (item?: GestorCallsEscala) => {
        if (item) {
            setCallForm({
                dia_semana: item.dia_semana,
                horario: item.horario,
                grupo_id: item.grupo_id || '',
                observacao: item.observacao || ''
            });
            setEditingCallId(item.id);
        } else {
            setCallForm(prev => ({ ...prev, horario: '', observacao: '', grupo_id: '' }));
            setEditingCallId(null);
        }
        setIsCallModalOpen(true);
    };

    // --- UI HELPERS ---
    const filteredGestores = gestores.filter(g => {
        const matchesSearch = g.nome.toLowerCase().includes(searchGestor.toLowerCase());

        let matchesSetor = false;
        if (activeTab === 'calls') {
            matchesSetor = g.setores?.includes('calls');
        } else if (activeTab === 'telegram') {
            matchesSetor = g.setores?.includes('telegram');
        }

        return matchesSearch && matchesSetor;
    });

    const selectedGestor = gestores.find(g => g.id === selectedGestorId);

    return (
        <DashboardLayout>
            <div className="min-h-screen bg-background/50 flex flex-col">
                {/* Header */}
                <div className="h-16 border-b bg-background px-6 flex items-center justify-between sticky top-0 z-10 gap-4">
                    <div className="flex items-center gap-3">
                        <CalendarClock className="w-6 h-6 text-primary" />
                        <h1 className="text-2xl font-bold">Escalas por Gestor</h1>
                    </div>

                    <div className="flex items-center gap-4">


                        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedGestorId(null); }} className="w-[400px]">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="calls">Calls</TabsTrigger>
                                <TabsTrigger value="telegram">Telegram</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </div>



                <div className="flex flex-1 overflow-hidden">
                    {activeTab === 'calls' && <div className="flex-1 w-full overflow-hidden"><CronogramaCallsView readOnly={!canEdit} /></div>}

                    {activeTab !== 'calls' && (
                        <div className="w-80 border-r bg-card flex flex-col">
                            <div className="p-4 border-b">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input className="pl-9" placeholder="Buscar gestor..." value={searchGestor} onChange={(e) => setSearchGestor(e.target.value)} />
                                </div>

                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                {loadingGestores ? (
                                    <div className="flex justify-center p-4"><Loader2 className="animate-spin text-muted-foreground" /></div>
                                ) : filteredGestores.length > 0 ? (
                                    filteredGestores.map(g => (
                                        <button
                                            key={g.id}
                                            onClick={() => setSelectedGestorId(g.id)}
                                            className={`w-full text-left px-3 py-3 rounded-md text-sm font-medium transition-colors flex items-center justify-between 
                                            ${selectedGestorId === g.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'}`}
                                        >
                                            <div className="flex flex-col items-start gap-1">
                                                <span>{g.nome}</span>
                                                <div className="flex gap-1 flex-wrap">
                                                    {g.setores?.map(s => (
                                                        <Badge key={s} variant={s === 'calls' ? 'secondary' : 'default'} className="text-[10px] h-4 py-0 font-normal capitalize">
                                                            {s}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="p-6 text-center text-sm text-muted-foreground">Nenhum gestor encontrado.</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* RIGHT: Editor */}
                    {activeTab !== 'calls' && (
                        <div className="flex-1 overflow-y-auto p-8 bg-muted/5">
                            {!selectedGestor ? (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                                    <Users className="w-16 h-16 mb-4" />
                                    <p>Selecione um gestor ao lado</p>
                                </div>
                            ) : loadingData ? (
                                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                            ) : viewMode === 'empty' ? (
                                <div className="h-full flex flex-col items-center justify-center space-y-4 animate-fade-in">
                                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-2">
                                        <FilePlus2 className="w-8 h-8 text-muted-foreground" />
                                    </div>
                                    <div className="text-center space-y-1">
                                        <h2 className="text-xl font-semibold">Sem escala cadastrada</h2>
                                        <p className="text-muted-foreground max-w-sm">
                                            Nenhuma escala definida para <span className="font-medium text-foreground">{selectedGestor.nome}</span>.
                                        </p>
                                    </div>
                                    {canEdit && (
                                        <Button onClick={activeTab === 'calls' ? handleCreateCallScale : handleCreateShiftScale} size="lg" className="gap-2">
                                            <Plus className="w-5 h-5" /> Criar Escala Agora
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                // --- EDITOR MODE ---
                                <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
                                    <div className="flex items-center justify-between pb-4 border-b">
                                        <div>
                                            <h2 className="text-3xl font-bold tracking-tight">{selectedGestor.nome}</h2>
                                            <p className="text-muted-foreground uppercase">Escala de {activeTab}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            {activeTab !== 'calls' && canEdit && (
                                                <Button variant="outline" onClick={() => setIsBatchModalOpen(true)} className="gap-2">
                                                    <Copy className="w-4 h-4" /> Aplicar em Lote
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {activeTab !== 'calls' ? (
                                        // SHIFT EDITOR (Telegram & Trafego)
                                        <Card className="border-none shadow-none bg-transparent">
                                            <CardContent className="p-0 overflow-visible">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="hover:bg-transparent">
                                                            <TableHead className="w-[100px]">Dia</TableHead>
                                                            <TableHead className="w-[130px]">Status</TableHead>

                                                            <TableHead className="text-center w-[110px]">Entrada</TableHead>
                                                            <TableHead className="text-center w-[110px]">Saída</TableHead>
                                                            <TableHead className="text-center w-[220px]">Intervalo</TableHead>
                                                            <TableHead>Observação</TableHead>
                                                            <TableHead className="w-[50px]"></TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {DIAS_SEMANA.map((dia) => {
                                                            const record = shiftScales.find(r => r.dia_semana === dia.value);
                                                            if (!record) return null; // Should not happen after create

                                                            const isFolga = record.status === 'folga';
                                                            const hasChanges = savedStates[dia.value] === false; // If explicitly false, means edited

                                                            return (
                                                                <TableRow key={dia.value} className="bg-card hover:bg-card/80 border-b">
                                                                    <TableCell className="font-medium">{dia.label}</TableCell>
                                                                    <TableCell>
                                                                        <Select disabled={!canEdit} value={record.status} onValueChange={(v) => handleUpdateShiftDay(dia.value, 'status', v)}>
                                                                            <SelectTrigger className="h-8 w-full bg-background"><SelectValue /></SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="trabalho">Trabalha</SelectItem>
                                                                                <SelectItem value="folga">Folga</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </TableCell>

                                                                    <TableCell>
                                                                        <div className="flex justify-center">
                                                                            <Input
                                                                                type="time"
                                                                                disabled={!canEdit || isFolga}
                                                                                className="h-8 w-24 text-center bg-background font-medium"
                                                                                value={record.entrada || ''}
                                                                                onChange={e => handleUpdateShiftDay(dia.value, 'entrada', e.target.value)}
                                                                                onBlur={() => handleSaveShiftDay(dia.value, true)}
                                                                            />
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <div className="flex justify-center">
                                                                            <Input
                                                                                type="time"
                                                                                disabled={!canEdit || isFolga}
                                                                                className="h-8 w-24 text-center bg-background font-medium"
                                                                                value={record.saida || ''}
                                                                                onChange={e => handleUpdateShiftDay(dia.value, 'saida', e.target.value)}
                                                                                onBlur={() => handleSaveShiftDay(dia.value, true)}
                                                                            />
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <div className="flex items-center justify-center gap-2">
                                                                            <Input
                                                                                type="time"
                                                                                disabled={!canEdit || isFolga}
                                                                                className="h-8 w-24 text-center bg-background font-medium"
                                                                                value={record.intervalo_inicio || ''}
                                                                                onChange={e => handleUpdateShiftDay(dia.value, 'intervalo_inicio', e.target.value)}
                                                                                onBlur={() => handleSaveShiftDay(dia.value, true)}
                                                                            />
                                                                            <span className="text-muted-foreground text-xs font-medium">até</span>
                                                                            <Input
                                                                                type="time"
                                                                                disabled={!canEdit || isFolga}
                                                                                className="h-8 w-24 text-center bg-background font-medium"
                                                                                value={record.intervalo_fim || ''}
                                                                                onChange={e => handleUpdateShiftDay(dia.value, 'intervalo_fim', e.target.value)}
                                                                                onBlur={() => handleSaveShiftDay(dia.value, true)}
                                                                            />
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Input
                                                                            disabled={!canEdit}
                                                                            className="h-8 bg-background"
                                                                            placeholder="..."
                                                                            value={record.observacao || ''}
                                                                            onChange={e => handleUpdateShiftDay(dia.value, 'observacao', e.target.value)}
                                                                            onBlur={() => handleSaveShiftDay(dia.value, true)}
                                                                        />
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        {canEdit && hasChanges !== undefined && (
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                                                                                onClick={() => handleSaveShiftDay(dia.value)}
                                                                                title="Salvar alterações desta linha"
                                                                            >
                                                                                <Save className="w-4 h-4" />
                                                                            </Button>
                                                                        )}
                                                                    </TableCell>
                                                                </TableRow>
                                                            );
                                                        })}
                                                    </TableBody>
                                                </Table>
                                            </CardContent>
                                        </Card>
                                    ) : (
                                        // CALLS EDITOR (Existing)
                                        <div className="space-y-6">
                                            <div className="flex justify-end">
                                                {canEdit && (
                                                    <Button onClick={() => openCallModal()} size="sm" className="gap-2">
                                                        <Plus className="w-4 h-4" /> Adicionar Call
                                                    </Button>
                                                )}
                                            </div>
                                            <Card>
                                                <CardContent className="p-0">
                                                    <Tabs defaultValue="seg" className="w-full">
                                                        <TabsList className="grid w-full grid-cols-7 rounded-none border-b bg-muted/50 p-0 h-12">
                                                            {DIAS_SEMANA.map(d => (
                                                                <TabsTrigger
                                                                    key={d.value}
                                                                    value={d.value}
                                                                    className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-background"
                                                                    onClick={() => setCallForm(prev => ({ ...prev, dia_semana: d.value }))}
                                                                >
                                                                    <div className="flex flex-col items-center">
                                                                        <span className="text-xs font-semibold uppercase">{d.label.slice(0, 3)}</span>
                                                                    </div>
                                                                </TabsTrigger>
                                                            ))}
                                                        </TabsList>
                                                        {DIAS_SEMANA.map(day => {
                                                            const dayCalls = callScales
                                                                .filter(c => c.dia_semana === day.value)
                                                                .sort((a, b) => a.horario.localeCompare(b.horario));
                                                            return (
                                                                <TabsContent key={day.value} value={day.value} className="p-6 m-0 focus-visible:ring-0 focus-visible:outline-none">
                                                                    {dayCalls.length === 0 ? (
                                                                        <div className="text-center py-16 border-2 border-dashed rounded-xl bg-muted/10">
                                                                            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                                                                                <Phone className="w-6 h-6 text-muted-foreground opacity-50" />
                                                                            </div>
                                                                            <p className="text-muted-foreground font-medium">Nenhuma call agendada</p>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="grid gap-3">
                                                                            {dayCalls.map(call => (
                                                                                <div key={call.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:shadow-sm transition-all group">
                                                                                    <div className="flex items-center gap-4">
                                                                                        <div className="h-12 w-20 rounded-md bg-primary/10 flex flex-col items-center justify-center text-primary px-2 border border-primary/20">
                                                                                            <span className="text-lg font-bold leading-none">{call.horario}</span>
                                                                                        </div>
                                                                                        <div>
                                                                                            <h4 className="font-semibold text-lg">{call.grupo_nome}</h4>
                                                                                            {call.observacao && <p className="text-sm text-muted-foreground">{call.observacao}</p>}
                                                                                        </div>
                                                                                    </div>
                                                                                    {canEdit && (
                                                                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                            <Button variant="ghost" size="icon" onClick={() => openCallModal(call)}><Edit className="w-4 h-4" /></Button>
                                                                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteCall(call.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </TabsContent>
                                                            );
                                                        })}
                                                    </Tabs>
                                                </CardContent>
                                            </Card>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Modals for Call & Batch preserved as-is at bottom */}
                <Dialog open={isCallModalOpen} onOpenChange={setIsCallModalOpen}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>{editingCallId ? 'Editar Call' : 'Nova Call'}</DialogTitle></DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Dia da Semana</Label>
                                    <Select value={callForm.dia_semana} onValueChange={v => setCallForm({ ...callForm, dia_semana: v })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {DIAS_SEMANA.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Horário</Label>
                                    <Input placeholder="ex: 19:30" value={callForm.horario} onChange={e => setCallForm({ ...callForm, horario: e.target.value })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Grupo</Label>
                                <Select value={callForm.grupo_id} onValueChange={v => setCallForm({ ...callForm, grupo_id: v })}>
                                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                    <SelectContent>
                                        {grupos.map(g => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Observação (Opcional)</Label>
                                <Textarea value={callForm.observacao} onChange={e => setCallForm({ ...callForm, observacao: e.target.value })} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCallModalOpen(false)}>Cancelar</Button>
                            <Button onClick={handleSaveCall}>Salvar</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={isBatchModalOpen} onOpenChange={setIsBatchModalOpen}>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>Aplicar Escala em Lote</DialogTitle>
                            <DialogDescription>Selecione os dias para aplicar a mesma configuração.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-6 py-4">
                            <div className="space-y-2">
                                <Label>Dias da Semana</Label>
                                <div className="flex flex-wrap gap-2">
                                    {DIAS_SEMANA.map(d => (
                                        <div key={d.value} className="flex items-center gap-2 border px-3 py-2 rounded-md hover:bg-muted cursor-pointer" onClick={() => {
                                            const exists = batchForm.days.includes(d.value);
                                            setBatchForm(prev => ({
                                                ...prev,
                                                days: exists ? prev.days.filter(x => x !== d.value) : [...prev.days, d.value]
                                            }));
                                        }}>
                                            <Checkbox checked={batchForm.days.includes(d.value)} />
                                            <span className="text-sm">{d.label.slice(0, 3)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Status</Label>
                                    <Select value={batchForm.status} onValueChange={v => setBatchForm(prev => ({ ...prev, status: v }))}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="trabalho">Trabalha</SelectItem>
                                            <SelectItem value="folga">Folga</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Grupo</Label>
                                    <Select value={batchForm.grupo_id} onValueChange={v => setBatchForm(prev => ({ ...prev, grupo_id: v }))}>
                                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                        <SelectContent>
                                            {grupos
                                                .filter(g => activeTab === 'calls' ? true : g.nome.toLowerCase().includes('geral'))
                                                .map(g => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Entrada</Label>
                                    <Input type="time" value={batchForm.entrada} onChange={e => setBatchForm(prev => ({ ...prev, entrada: e.target.value }))} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Saída</Label>
                                    <Input type="time" value={batchForm.saida} onChange={e => setBatchForm(prev => ({ ...prev, saida: e.target.value }))} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Início Intervalo</Label>
                                    <Input type="time" value={batchForm.intervalo_inicio} onChange={e => setBatchForm(prev => ({ ...prev, intervalo_inicio: e.target.value }))} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Fim Intervalo</Label>
                                    <Input type="time" value={batchForm.intervalo_fim} onChange={e => setBatchForm(prev => ({ ...prev, intervalo_fim: e.target.value }))} />
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsBatchModalOpen(false)}>Cancelar</Button>
                            <Button onClick={handleBatchApply} disabled={batchForm.days.length === 0}>Aplicar</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    );
}
