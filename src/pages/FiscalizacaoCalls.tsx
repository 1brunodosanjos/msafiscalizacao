import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
    ClipboardCheck,
    ThumbsUp,
    ThumbsDown,
    Download,
    ArrowLeft,
    User,
    AlertTriangle,
    Clock,
    Users,
    Pencil,
    Plus,
    RefreshCw,
    Calendar as CalendarIcon,
    Check,
    Loader2,
    Eye,
    Trash2,
    CalendarOff
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { MONTHS } from '@/lib/constants';
import { logActivity } from '@/lib/activityLogger';
import { ExportDataDialog } from '@/components/fiscalizacao/ExportDataDialog';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MultiSelect } from '@/components/ui/multi-select-custom';


interface Gestor {
    id: string;
    nome: string;
    username_telegram: string | null;
    status: string;
    grupos_calls: string[] | null;
}

interface InspectionItem {
    category: string;
    status: 'positive' | 'negative' | null;
    observation: string;
    quantity: number;
}

const INSPECTION_POINTS = [
    'Música',
    'Apresentação',
    'Avisos',
    'Vídeo explicando sobre o Zoom',
    'Câmera ligada',
    'Primeiro atendimento',
    'Link disponível por 2 horas',
    'Respostas compatíveis',
    'Qualidade no atendimento',
    'Pontualidade',
    'Elogios no chat',
    'Energia',
];

// MONTHS moved to src/lib/constants.ts


export default function FiscalizacaoCalls() {
    const { user, profile, loading } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [gestores, setGestores] = useState<Gestor[]>([]);
    const [inspections, setInspections] = useState<any[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    // Filters
    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [filterGestorId, setFilterGestorId] = useState<string>('all');
    const [filterInspectorId, setFilterInspectorId] = useState<string>('all');
    const [filterCallGroup, setFilterCallGroup] = useState<string>('all');
    const [selectedDateFilter, setSelectedDateFilter] = useState<Date | undefined>(undefined);


    // Form State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [gestorId, setGestorId] = useState('');
    const [dataEvento, setDataEvento] = useState(new Date().toISOString().split('T')[0]);
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');

    // New Fields State
    const [participantsCount, setParticipantsCount] = useState('');
    const [raisedHandsCount, setRaisedHandsCount] = useState('');
    const [solvedProblemsCount, setSolvedProblemsCount] = useState('');
    const [avgDuration, setAvgDuration] = useState('');
    const [callGroup, setCallGroup] = useState<string[]>([]);

    // New: Schedule Integration
    const [availableCalls, setAvailableCalls] = useState<any[]>([]);
    const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');


    // Cancellation State
    const [isCancelled, setIsCancelled] = useState(false);
    const [cancellationReason, setCancellationReason] = useState('');
    const [generalObservation, setGeneralObservation] = useState('');

    const [open, setOpen] = useState(false);

    // Delete State
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [inspectionToDelete, setInspectionToDelete] = useState<string | null>(null);

    const [items, setItems] = useState<InspectionItem[]>(
        INSPECTION_POINTS.map(point => ({ category: point, status: null, observation: '', quantity: 1 }))
    );

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
            fetchInspections();
        }
    }, [user, selectedMonth, selectedYear, selectedDateFilter]); // Added selectedDateFilter to dependencies

    const fetchGestores = async () => {
        const { data, error } = await (supabase
            .from('gestores') as any)
            .select('id, nome, ativo, username_telegram, grupos_calls')
            .order('nome');

        if (!error && data) {
            setGestores(data.map(p => ({
                id: p.id,
                nome: p.nome,
                username_telegram: p.username_telegram,
                status: p.ativo ? 'ativo' : 'pausado', // Keep original status logic
                grupos_calls: p.grupos_calls || []
            })));
        }
    };

    // New: Fetch Calls Schedule when Gestor changes
    useEffect(() => {
        const fetchGestorCalls = async () => {
            if (!gestorId) {
                setAvailableCalls([]);
                return;
            }

            const { data, error } = await (supabase
                .from('gestor_calls_escala') as any)
                .select(`
                    id,
                    dia_semana,
                    horario,
                    grupo_id,
                    grupos (id, nome)
                `)
                .eq('gestor_id', gestorId);

            if (error) {
                console.error("Error fetching calls:", error);
            } else {
                setAvailableCalls(data || []);
            }
        };

        fetchGestorCalls();
    }, [gestorId]);

    const DIAS_MAP: Record<string, string> = {
        'seg': 'Segunda', 'ter': 'Terça', 'qua': 'Quarta',
        'qui': 'Quinta', 'sex': 'Sexta', 'sab': 'Sábado', 'dom': 'Domingo'
    };

    const fetchInspections = async () => {
        setLoadingData(true);

        let query = (supabase
            .from('inspections') as any)
            .select(`
                id,
                manager_id,
                date,
                duration,
                score,
                type,
                inspector_id,
                call_group,
                is_cancelled,
                cancellation_reason,
                observation,
                semana_referencia,
                mes_referencia,
                ano_referencia,
                start_time,
                end_time,
                participants_count,
                raised_hands_count,
                solved_problems_count,
                average_attendance_time,
                gestores:manager_id (id, nome),
                profiles:inspector_id (id, full_name),
                inspection_items:inspection_items (
                    id,
                    category,
                    criterion,
                    status,
                    observation,
                    quantidade
                )
            `)
            .eq('type', 'call');

        if (selectedDateFilter) {
            // Format date as YYYY-MM-DD using local time components to match the date string stored in DB
            const year = selectedDateFilter.getFullYear();
            const month = String(selectedDateFilter.getMonth() + 1).padStart(2, '0');
            const day = String(selectedDateFilter.getDate()).padStart(2, '0');
            const formattedDate = `${year}-${month}-${day}`;

            query = query.eq('date', formattedDate);
        } else {
            // Date range for the entire selected month
            const startDate = new Date(selectedYear, selectedMonth - 1, 1);
            const endDate = new Date(selectedYear, selectedMonth, 0);
            const startDateStr = format(startDate, 'yyyy-MM-dd');
            const endDateStr = format(endDate, 'yyyy-MM-dd');

            query = query.gte('date', startDateStr).lte('date', endDateStr);
        }

        query = query.order('date', { ascending: false });

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching inspections:', error);
        } else {
            setInspections(data || []);
        }
        setLoadingData(false);
    };

    const uniqueInspectors = Array.from(new Set(inspections.map(i =>
        i.profiles ? JSON.stringify({ id: i.profiles.id, nome: i.profiles.full_name }) : null
    ).filter(Boolean))).map((s: any) => JSON.parse(s));

    const filteredInspections = inspections.filter(inspection => {
        const gestorMatch = filterGestorId === 'all' || inspection.manager_id === filterGestorId;
        const matchesGroup = filterCallGroup === 'all' || (inspection.call_group && inspection.call_group.includes(filterCallGroup));
        const inspectorMatch = filterInspectorId === 'all' || (inspection.inspector_id === filterInspectorId);

        // Fix timezone issue for filtering
        const inspectionDate = new Date(inspection.date + 'T12:00:00');

        if (selectedDateFilter) {
            const year = selectedDateFilter.getFullYear();
            const month = String(selectedDateFilter.getMonth() + 1).padStart(2, '0');
            const day = String(selectedDateFilter.getDate()).padStart(2, '0');
            const formattedFilterDate = `${year}-${month}-${day}`;

            // inspection.date is string "YYYY-MM-DD"
            return gestorMatch && inspectorMatch && inspection.date === formattedFilterDate;
        }

        const dateMatch = inspection.mes_referencia === selectedMonth &&
            inspection.ano_referencia === selectedYear;

        return gestorMatch && inspectorMatch && dateMatch;
    });

    const handleStatusChange = (category: string, status: 'positive' | 'negative') => {
        setItems(items.map(item =>
            item.category === category
                ? { ...item, status: item.status === status ? null : status, observation: item.status === status ? '' : item.observation }
                : item
        ));
    };

    const handleObservationChange = (category: string, observation: string) => {
        setItems(items.map(item =>
            item.category === category ? { ...item, observation } : item
        ));
    };

    const handleQuantityChange = (category: string, quantity: number) => {
        setItems(items.map(item =>
            item.category === category ? { ...item, quantity: Math.max(1, quantity) } : item
        ));
    };

    const validateForm = () => {
        if (!gestorId) return 'Selecione um gestor.';
        if (!dataEvento) return 'Selecione a data.';

        // Simplified validation if cancelled
        if (isCancelled) {
            if (!callGroup || callGroup.length === 0) return 'Selecione o grupo da call (obrigatório mesmo cancelada).';
            if (!cancellationReason.trim()) return 'Informe o motivo do cancelamento.';
            return null;
        }

        // Check if any negative item is missing observation
        const missingObs = items.find(item => item.status === 'negative' && !item.observation.trim());
        if (missingObs) return `A observação é obrigatória para o ponto negativo: ${missingObs.category}`;

        return null;
    };

    const handlePreview = () => {
        const error = validateForm();
        if (error) {
            toast({
                title: 'Preencha os campos obrigatórios',
                description: error,
                variant: 'destructive',
            });
            return;
        }

        // Check if at least one item is evaluated (optional, but good practice)
        if (!isCancelled && !items.some(i => i.status !== null)) {
            toast({
                title: 'Nenhum ponto avaliado',
                description: 'Avalie ao menos um ponto antes de salvar.',
                variant: 'destructive',
            });
            return;
        }

        setShowPreview(true);
    };

    const resetForm = () => {
        setEditingId(null);
        setGestorId('');
        setStartTime('');
        setEndTime('');
        setParticipantsCount('');
        setRaisedHandsCount('');
        setSolvedProblemsCount('');
        setAvgDuration('');
        setCallGroup([]);
        setIsCancelled(false);
        setCancellationReason('');
        setGeneralObservation('');
        setItems(INSPECTION_POINTS.map(point => ({ category: point, status: null, observation: '', quantity: 1 })));
        setItems(INSPECTION_POINTS.map(point => ({ category: point, status: null, observation: '', quantity: 1 })));
        setSelectedScheduleId(''); // Reset selection
        setAvailableCalls([]);
        setShowPreview(false);
    };

    const handleEdit = async (inspection: any) => {
        setEditingId(inspection.id);
        setGestorId(inspection.gestor_id);
        // setInspectorId(inspection.evaluator_id); // This state variable is not defined in the original code.
        setDataEvento(inspection.date);
        setStartTime(inspection.start_time || '');
        setEndTime(inspection.end_time || '');
        setParticipantsCount(inspection.participants_count?.toString() || '');
        setRaisedHandsCount(inspection.raised_hands_count?.toString() || '');
        setSolvedProblemsCount(inspection.solved_problems_count?.toString() || '');
        setAvgDuration(inspection.average_attendance_time || '');
        setCallGroup(Array.isArray(inspection.call_group) ? inspection.call_group : (inspection.call_group ? [inspection.call_group] : []));

        setIsCancelled(inspection.is_cancelled || false);
        setCancellationReason(inspection.cancellation_reason || '');
        setGeneralObservation(inspection.observation || '');

        // Fetch items for this inspection
        const { data: inspectionItems } = await (supabase
            .from('inspection_items') as any)
            .select('*')
            .eq('inspection_id', inspection.id);

        if (inspectionItems) {
            const newItems = INSPECTION_POINTS.map(point => {
                const found = inspectionItems.find((i: any) => i.criterion === point);
                return {
                    category: point,
                    status: found ? (found.status as InspectionItem['status']) : null,
                    observation: found ? (found.observation || '') : '',
                    quantity: found ? (found.quantidade || 1) : 1
                };
            });
            setItems(newItems);
        }

        // Scroll to top to see form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = (id: string) => {
        setInspectionToDelete(id);
        setDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!inspectionToDelete) return;

        // Optimistically remove from UI
        setInspections(current => current.filter(i => i.id !== inspectionToDelete));
        setDeleteDialogOpen(false);

        // Delete items first (to be safe against missing CASCADE)
        const { error: itemsError } = await (supabase
            .from('inspection_items') as any)
            .delete()
            .eq('inspection_id', inspectionToDelete);

        if (itemsError) {
            console.error('Error deleting items:', itemsError);

            toast({
                title: 'Erro ao excluir itens relacionados',
                description: `Não foi possível excluir os detalhes da fiscalização: ${itemsError.message}`,
                variant: 'destructive',
            });

            // Revert state because we couldn't proceed
            fetchInspections();
            return;
        }

        const { error } = await (supabase
            .from('inspections') as any)
            .delete()
            .eq('id', inspectionToDelete);

        if (error) {
            toast({
                title: 'Erro ao excluir fiscalização',
                description: error.message,
                variant: 'destructive',
            });
            // Revert optimistic update on failure
            fetchInspections();
        } else {
            toast({
                title: 'Fiscalização excluída',
                description: 'Registro removido com sucesso.',
            });

            await logActivity({
                userId: user?.id || '',
                actionType: 'DELETE',
                entityType: 'fiscalizacao',
                entityId: inspectionToDelete,
                details: { deleted_at: new Date().toISOString() }
            });
        }
        setInspectionToDelete(null);
    };

    const handleSubmit = async () => {
        setSubmitting(true);

        try {
            let inspectionId = editingId;

            const eventDate = new Date(dataEvento);
            const weekNumber = Math.ceil(eventDate.getDate() / 7);
            const monthNumber = eventDate.getMonth() + 1;
            const yearNumber = eventDate.getFullYear();

            const inspectionPayload = {
                manager_id: gestorId,
                inspector_id: user?.id,
                date: dataEvento,
                start_time: startTime || null,
                end_time: endTime || null,
                participants_count: participantsCount ? parseInt(participantsCount) : 0,
                raised_hands_count: raisedHandsCount ? parseInt(raisedHandsCount) : 0,
                solved_problems_count: solvedProblemsCount ? parseInt(solvedProblemsCount) : 0,
                average_attendance_time: avgDuration || null,
                call_group: callGroup && callGroup.length > 0 ? callGroup : null,
                is_cancelled: isCancelled,
                cancellation_reason: isCancelled ? cancellationReason : null,
                observation: generalObservation || null,
                type: 'call',
                score: isCancelled ? 0 : calculateScore(),
                semana_referencia: weekNumber,
                mes_referencia: monthNumber,
                ano_referencia: yearNumber
            };

            if (editingId) {
                // UPDATE
                const { error: updateError } = await (supabase
                    .from('inspections') as any)
                    .update(inspectionPayload)
                    .eq('id', editingId);

                if (updateError) throw updateError;

                // Delete all existing items to replace them
                const { error: deleteItemsError } = await (supabase
                    .from('inspection_items') as any)
                    .delete()
                    .eq('inspection_id', editingId);

                if (deleteItemsError) throw deleteItemsError;

            } else {
                // INSERT
                const { data: newInspection, error: insertError } = await (supabase
                    .from('inspections') as any)
                    .insert(inspectionPayload)
                    .select()
                    .single();

                if (insertError) throw insertError;
                if (!newInspection) throw new Error("Falha ao criar fiscalização: retorno vazio do banco.");
                inspectionId = newInspection.id;
            }

            // 2. Create Inspection Items (for both Insert and Update)
            const itemsToSave = items
                .filter(item => item.status !== null)
                .map(item => ({
                    inspection_id: inspectionId,
                    category: 'call_point',
                    criterion: item.category,
                    status: item.status,
                    observation: item.observation || null,
                    quantidade: item.quantity || 1
                }));

            if (itemsToSave.length > 0) {
                const { error: itemsError } = await (supabase
                    .from('inspection_items') as any)
                    .insert(itemsToSave);

                if (itemsError) throw itemsError;
            }

            toast({
                title: editingId ? 'Fiscalização atualizada!' : 'Fiscalização registrada!',
                description: editingId ? 'Dados atualizados com sucesso.' : 'Avaliação salva com sucesso.',
            });

            await logActivity({
                userId: user?.id || '',
                actionType: editingId ? 'UPDATE' : 'CREATE',
                entityType: 'fiscalizacao',
                entityId: inspectionId,
                details: {
                    gestor_id: inspectionPayload.manager_id,
                    data_evento: inspectionPayload.date,
                    score: inspectionPayload.score
                }
            });

            resetForm();
            fetchInspections();

        } catch (error: any) {
            console.error('Error saving inspection:', error);
            toast({
                title: 'Erro ao salvar',
                description: error.message || 'Ocorreu um erro ao salvar a fiscalização.',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    };

    const calculateScore = () => {
        // Simple score: Positives - Negatives, accounting for weight/quantity
        let total = 0;
        items.forEach(item => {
            if (item.status === 'positive') total += item.quantity;
            if (item.status === 'negative') total -= item.quantity;
        });
        return total;
    };

    const gestorSelecionado = gestores.find(g => g.id === gestorId);
    const totalPositives = items.filter(i => i.status === 'positive').reduce((acc, curr) => acc + curr.quantity, 0);
    const totalNegatives = items.filter(i => i.status === 'negative').reduce((acc, curr) => acc + curr.quantity, 0);

    if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;

    const [exportDialogOpen, setExportDialogOpen] = useState(false);

    // ... (existing code, ensure to place this inside component body)

    const handleExport = async (startDate: string, endDate: string, formatType: 'pdf' | 'csv') => {
        try {
            // 1. Fetch data
            // Fetching inspections with a more explicit select to avoid type complexity
            const startDateStr = format(new Date(startDate), 'yyyy-MM-dd');
            const endDateStr = format(new Date(endDate), 'yyyy-MM-dd');

            const { data, error } = await (supabase
                .from('inspections') as any)
                .select(`
                    id,
                    gestor_id,
                    date,
                    duration,
                    score,
                    status,
                    type,
                    evaluator_id,
                    call_group,
                    is_cancelled,
                    cancellation_reason,
                    observation,
                    gestores:gestor_id (id, nome),
                    profiles:evaluator_id (id, full_name),
                    inspection_items (id, category, criterion, status, observation, quantidade)
                `)
                .eq('type', 'call')
                .gte('date', startDateStr)
                .lte('date', endDateStr)
                .order('date', { ascending: false });

            if (error) throw error;

            if (!data || data.length === 0) {
                toast({
                    title: 'Sem dados',
                    description: 'Nenhum registro encontrado para o período selecionado.',
                    variant: 'destructive',
                });
                return;
            }

            // 2. Aggregate
            const gestorStats: Record<string, any> = {};

            data.forEach(inspection => {
                const gestorId = inspection.gestor_id;
                const gestorName = inspection.gestores?.nome || 'Desconhecido';

                if (!gestorStats[gestorId]) {
                    gestorStats[gestorId] = {
                        name: gestorName,
                        totalScore: 0,
                        totalPositives: 0,
                        totalNegatives: 0,
                        items: []
                    };
                }

                const stats = gestorStats[gestorId];
                stats.totalScore += (inspection.score || 0);

                // Count items
                if (inspection.inspection_items) {
                    inspection.inspection_items.forEach((item: any) => {
                        if (item.status === 'positive') {
                            stats.totalPositives += (item.quantidade || 1);
                        } else if (item.status === 'negative') {
                            stats.totalNegatives += (item.quantidade || 1);
                        }
                        stats.items.push(item);
                    });
                }
            });

            const reportTitle = `Relatório de Fiscalização de Calls - ${format(new Date(startDate), 'dd/MM/yyyy')} a ${format(new Date(endDate), 'dd/MM/yyyy')}`;

            if (formatType === 'csv') {
                const csvRows = [
                    ['Gestor', 'Pontuação Total', 'Total Positivos', 'Total Negativos', 'Principais Negativos', 'Principais Positivos']
                ];

                Object.values(gestorStats).forEach((stat: any) => {
                    // Analyze categories
                    const catCounts: Record<string, number> = {};
                    stat.items.forEach((i: any) => {
                        if (!i.status) return;
                        const key = `${i.status === 'positive' ? '+' : '-'}${i.criterion}`;
                        catCounts[key] = (catCounts[key] || 0) + (i.quantidade || 1);
                    });

                    const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
                    const topNeg = sortedCats.filter(c => c[0].startsWith('-')).slice(0, 3).map(c => `${c[0].substring(1)} (${c[1]})`).join('; ');
                    const topPos = sortedCats.filter(c => c[0].startsWith('+')).slice(0, 3).map(c => `${c[0].substring(1)} (${c[1]})`).join('; ');

                    csvRows.push([
                        `"${stat.name}"`,
                        stat.totalScore.toString(),
                        stat.totalPositives.toString(),
                        stat.totalNegatives.toString(),
                        `"${topNeg}"`,
                        `"${topPos}"`
                    ]);
                });

                const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", `fiscalizacao_calls_${startDate}_${endDate}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                // PDF
                const doc = new jsPDF();

                doc.setFontSize(18);
                doc.text(reportTitle, 14, 22);

                doc.setFontSize(11);
                doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 30);

                const tableBody = Object.values(gestorStats).map((stat: any) => {
                    // Analyze categories
                    const catCounts: Record<string, number> = {};
                    stat.items.forEach((i: any) => {
                        if (!i.status) return;
                        const key = `${i.status === 'positive' ? '+' : '-'}${i.criterion}`;
                        catCounts[key] = (catCounts[key] || 0) + (i.quantidade || 1);
                    });

                    const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
                    const topNeg = sortedCats.filter(c => c[0].startsWith('-')).slice(0, 3).map(c => `${c[0].substring(1)} (${c[1]})`).join('\n');
                    const topPos = sortedCats.filter(c => c[0].startsWith('+')).slice(0, 3).map(c => `${c[0].substring(1)} (${c[1]})`).join('\n');

                    return [
                        stat.name,
                        stat.totalScore,
                        stat.totalPositives,
                        stat.totalNegatives,
                        topNeg || '-',
                        topPos || '-'
                    ];
                });

                autoTable(doc, {
                    startY: 40,
                    head: [['Gestor', 'Score', 'Pos.', 'Neg.', 'Top Negativos', 'Top Positivos']],
                    body: tableBody,
                    styles: { fontSize: 8, cellPadding: 2 },
                    headStyles: { fillColor: [41, 128, 185] },
                    columnStyles: {
                        0: { cellWidth: 30 }, // Gestor
                        1: { cellWidth: 15, halign: 'center' }, // Score
                        2: { cellWidth: 15, halign: 'center' }, // Pos
                        3: { cellWidth: 15, halign: 'center' }, // Neg
                        4: { cellWidth: 'auto' }, // Detailed
                        5: { cellWidth: 'auto' }
                    }
                });

                doc.save(`fiscalizacao_calls_${startDate}_${endDate}.pdf`);
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
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Fiscalização de Calls</h1>
                        <p className="text-muted-foreground">Avaliação detalhada de atendimento em calls.</p>
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
                            <RefreshCw className={`w-4 h-4 mr-2 ${loadingData ? 'animate-spin' : ''}`} />
                            Atualizar
                        </Button>
                        {/* ... */}

                        <Button
                            variant="hero"
                            onClick={() => {
                                setEditingId(null);
                                resetForm();
                            }}
                            className="flex-[2] md:flex-none"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Nova Avaliação
                        </Button>
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">

                        {/* Main Info Card */}
                        <Card variant="elevated">
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <User className="w-5 h-5" />
                                        Dados da Call
                                    </div>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Gestor *</Label>
                                        <Select value={gestorId} onValueChange={setGestorId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione o gestor" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {gestores.filter(g => g.grupos_calls && g.grupos_calls.length > 0).map(g => (
                                                    <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>


                                    <div className="space-y-2">
                                        <Label>Selecionar Call</Label>
                                        <Select
                                            value={selectedScheduleId}
                                            onValueChange={(val) => {
                                                setSelectedScheduleId(val);
                                                const selectedCall = availableCalls.find(c => c.id === val);
                                                if (selectedCall && selectedCall.grupos?.nome) {
                                                    setCallGroup([selectedCall.grupos.nome]);
                                                    // Optional: Auto-fill time if empty?
                                                    // setStartTime(selectedCall.horario);
                                                }
                                            }}
                                            disabled={!gestorId}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={!gestorId ? "Selecione o gestor primeiro" : "Selecione a call do cronograma"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableCalls.length === 0 ? (
                                                    <SelectItem value="none" disabled>Nenhuma call agendada</SelectItem>
                                                ) : (
                                                    availableCalls.map(call => (
                                                        <SelectItem key={call.id} value={call.id}>
                                                            {DIAS_MAP[call.dia_semana] || call.dia_semana} - {call.horario} - {call.grupos?.nome || 'Grupo sem nome'}
                                                        </SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                        {/* Hidden/Read-only display of the actual group being saved, for verify */}
                                        {callGroup.length > 0 && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Grupo identificado: <span className="font-medium text-primary">{callGroup[0]}</span>
                                            </p>
                                        )}
                                    </div>

                                </div>

                                <div className="flex items-center space-x-2 py-2">
                                    <Switch
                                        id="call-cancelada"
                                        checked={isCancelled}
                                        onCheckedChange={setIsCancelled}
                                        className="data-[state=checked]:bg-destructive"
                                    />
                                    <Label htmlFor="call-cancelada" className={`cursor-pointer font-medium ${isCancelled ? 'text-destructive' : ''}`}>
                                        Call Cancelada
                                    </Label>
                                </div>

                                {isCancelled && (
                                    <div className="col-span-1 md:col-span-2 space-y-2 animate-fade-in bg-destructive/10 p-4 rounded-lg border border-destructive/20">
                                        <Label className="text-destructive font-medium flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4" />
                                            Motivo do Cancelamento *
                                        </Label>
                                        <Textarea
                                            value={cancellationReason}
                                            onChange={(e) => setCancellationReason(e.target.value)}
                                            placeholder="Descreva o motivo do cancelamento da call..."
                                            className="border-destructive/30 focus-visible:ring-destructive"
                                        />
                                    </div>
                                )}

                                {!isCancelled && (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Data *</Label>
                                                <div className="relative">
                                                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                    <Input type="date" value={dataEvento} onChange={e => setDataEvento(e.target.value)} className="pl-10" />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label>Início da Call</Label>
                                                <div className="relative">
                                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                    <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="pl-10" />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Término da Call</Label>
                                                <div className="relative">
                                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                    <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="pl-10" />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border pt-4 mt-4">
                                            <div className="space-y-2">
                                                <Label>Pessoas no início</Label>
                                                <div className="relative">
                                                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                    <Input type="number" value={participantsCount} onChange={e => setParticipantsCount(e.target.value)} className="pl-10" placeholder="0" />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Mãos levantadas</Label>
                                                <div className="relative">
                                                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                    <Input type="number" value={raisedHandsCount} onChange={e => setRaisedHandsCount(e.target.value)} className="pl-10" placeholder="0" />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Problemas solucionados</Label>
                                                <div className="relative">
                                                    <Check className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                    <Input type="number" value={solvedProblemsCount} onChange={e => setSolvedProblemsCount(e.target.value)} className="pl-10" placeholder="0" />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Duração média atendimento</Label>
                                                <div className="relative">
                                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                    <Input type="text" value={avgDuration} onChange={e => setAvgDuration(e.target.value)} className="pl-10" placeholder="Ex: 5 min" />
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                        {/* Evaluation Points */}
                        {!isCancelled && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {items.map((item, index) => (
                                        <Card key={index} className={`border transition-all ${item.status === 'negative' ? 'border-destructive/50 bg-destructive/5' :
                                            item.status === 'positive' ? 'border-success/50 bg-success/5' :
                                                'border-border'
                                            }`}>
                                            <CardContent className="p-4 pt-4">
                                                <div className="flex justify-between items-start gap-4">
                                                    <span className="font-medium text-sm flex-1">{item.category}</span>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant={item.status === 'positive' ? 'default' : 'outline'}
                                                            className={`h-8 w-8 p-0 rounded-full ${item.status === 'positive' ? 'bg-success hover:bg-success/90 text-white border-transparent' : ''}`}
                                                            onClick={() => handleStatusChange(item.category, 'positive')}
                                                        >
                                                            <ThumbsUp className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant={item.status === 'negative' ? 'destructive' : 'outline'}
                                                            className={`h-8 w-8 p-0 rounded-full ${item.status === 'negative' ? '' : 'hover:text-destructive hover:border-destructive'}`}
                                                            onClick={() => handleStatusChange(item.category, 'negative')}
                                                        >
                                                            <ThumbsDown className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>

                                                {item.status !== null && (
                                                    <div className="mt-3 grid grid-cols-1 gap-3 animate-fade-in border-t border-border/50 pt-3">
                                                        <div className="flex gap-4 items-end">
                                                            <div className="w-24">
                                                                <Label className="text-xs mb-1 block">Qtde</Label>
                                                                <Input
                                                                    type="number"
                                                                    min="1"
                                                                    value={item.quantity}
                                                                    onChange={(e) => handleQuantityChange(item.category, parseInt(e.target.value) || 1)}
                                                                    className="h-8"
                                                                />
                                                            </div>
                                                            <div className="flex-1">
                                                                <Label className="text-xs mb-1 block">Observação {item.status === 'negative' ? '*' : '(opcional)'}</Label>
                                                                <Input
                                                                    placeholder={item.status === 'negative' ? "Obrigatório para ponto negativo" : "Opcional"}
                                                                    className="h-8 text-sm"
                                                                    value={item.observation}
                                                                    onChange={(e) => handleObservationChange(item.category, e.target.value)}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>

                                <Card className="border-border">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm font-medium">Observações Gerais</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Textarea
                                            placeholder="Adicione observações gerais sobre esta call..."
                                            value={generalObservation}
                                            onChange={(e) => setGeneralObservation(e.target.value)}
                                            className="min-h-[100px] resize-none focus-visible:ring-primary"
                                        />
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        <Button
                            onClick={handlePreview}
                            variant="hero"
                            size="lg"
                            className="w-full"
                        >
                            <Eye className="w-4 h-4 mr-2" />
                            {editingId ? 'Visualizar e Atualizar' : 'Visualizar e Salvar'}
                        </Button>

                    </div>

                    {/* Sidebar Summary */}
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
                                        Selecione um gestor
                                    </div>
                                )}

                                <Separator />

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between p-3 bg-success/10 rounded-lg text-success">
                                        <span className="flex items-center gap-2 text-sm font-medium">
                                            <ThumbsUp className="w-4 h-4" /> Positivos
                                        </span>
                                        <span className="font-bold">{totalPositives}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg text-destructive">
                                        <span className="flex items-center gap-2 text-sm font-medium">
                                            <ThumbsDown className="w-4 h-4" /> Negativos
                                        </span>
                                        <span className="font-bold">{totalNegatives}</span>
                                    </div>
                                </div>
                                <div className="p-3 bg-primary/5 rounded-lg border border-primary/10 text-center">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Pontuação da Call</p>
                                    <p className={`text-2xl font-bold ${calculateScore() >= 0 ? 'text-primary' : 'text-destructive'}`}>
                                        {calculateScore() > 0 ? '+' : ''}{calculateScore()}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>


            {/* History List */}
            <div className="space-y-6 pt-8 pl-4">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold">Histórico de Fiscalizações</h2>
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
                        <Select value={filterCallGroup} onValueChange={setFilterCallGroup}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Grupo Call" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os Grupos</SelectItem>
                                <SelectItem value="Grupo Geral">Grupo Geral</SelectItem>
                                <SelectItem value="Grupo Start">Grupo Start</SelectItem>
                                <SelectItem value="Grupo Vip">Grupo Vip</SelectItem>
                                <SelectItem value="Grupo Premium">Grupo Premium</SelectItem>
                                <SelectItem value="Grupo Elite">Grupo Elite</SelectItem>
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
                                    <SelectTrigger className="w-32">
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
                                    <SelectTrigger className="w-40">
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

                {
                    loadingData ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[...Array(3)].map((_, i) => (
                                <Skeleton key={i} className="h-40" />
                            ))}
                        </div>
                    ) : filteredInspections.length === 0 ? (
                        <Card variant="glass" className="p-12 text-center">
                            <ClipboardCheck className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
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
                            {filteredInspections.map((inspection) => (

                                <Card key={inspection.id} className="relative group hover:border-primary/50 transition-colors">
                                    <CardHeader className="pb-3">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                                                    <User className="w-5 h-5 text-primary" />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-base">{inspection.gestores?.nome || 'Gestor Removido'}</CardTitle>
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                        <CalendarIcon className="w-3 h-3" />
                                                        {new Date(inspection.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                    </div>
                                                </div>
                                            </div>
                                            {inspection.is_cancelled ? (
                                                <Badge variant="destructive" className="bg-destructive hover:bg-destructive/90 text-white font-bold px-3 py-1 uppercase tracking-wider">
                                                    Cancelada
                                                </Badge>
                                            ) : (
                                                <Badge variant={inspection.score >= 0 ? "success" : "destructive"} className="text-lg font-bold">
                                                    {inspection.score > 0 ? '+' : ''}{inspection.score}
                                                </Badge>
                                            )}
                                        </div>
                                        {inspection.is_cancelled && (
                                            <div className="mt-2 bg-destructive/5 border border-destructive/10 rounded p-2">
                                                <p className="text-[10px] uppercase font-bold text-destructive mb-1 flex items-center gap-1">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    Motivo do Cancelamento
                                                </p>
                                                <p className="text-xs text-muted-foreground italic line-clamp-2">
                                                    "{inspection.cancellation_reason || 'Não informado'}"
                                                </p>
                                            </div>
                                        )}
                                        {inspection.profiles && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Por: {inspection.profiles.full_name}
                                            </p>
                                        )}
                                        {!inspection.is_cancelled && inspection.observation && (
                                            <div className="mt-2 bg-primary/5 border border-primary/10 rounded p-2">
                                                <p className="text-[10px] uppercase font-bold text-primary mb-1 flex items-center gap-1">
                                                    <ClipboardCheck className="w-3 h-3" />
                                                    Observações Gerais
                                                </p>
                                                <p className="text-xs text-muted-foreground italic line-clamp-3">
                                                    "{inspection.observation}"
                                                </p>
                                            </div>
                                        )}
                                    </CardHeader>

                                    <CardContent>
                                        {inspection.start_time && (
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                                                <Clock className="w-3 h-3" />
                                                {inspection.start_time.slice(0, 5)} - {inspection.end_time?.slice(0, 5) || '?'}
                                            </div>
                                        )}

                                        {/* Inspection Items */}
                                        {inspection.inspection_items && inspection.inspection_items.length > 0 && (
                                            <div className="space-y-3 mb-4">
                                                {/* Negativos */}
                                                {inspection.inspection_items.filter((item: any) => item.status === 'negative').length > 0 && (
                                                    <div className="space-y-1">
                                                        <p className="text-xs font-semibold text-destructive flex items-center gap-1">
                                                            <ThumbsDown className="w-3 h-3" />
                                                            Pontos Negativos
                                                        </p>
                                                        <div className="grid gap-1">
                                                            {inspection.inspection_items
                                                                .filter((item: any) => item.status === 'negative')
                                                                .map((item: any, idx: number) => (
                                                                    <div key={idx} className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded flex items-start gap-2">
                                                                        <span className="font-medium">• {item.criterion || item.category}</span>
                                                                        {item.observation && <span className="text-muted-foreground">- {item.observation}</span>}
                                                                        {item.quantidade > 1 && <span className="ml-auto font-bold">x{item.quantidade}</span>}
                                                                    </div>
                                                                ))
                                                            }
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Positivos */}
                                                {inspection.inspection_items.filter((item: any) => item.status === 'positive').length > 0 && (
                                                    <div className="space-y-1">
                                                        <p className="text-xs font-semibold text-success flex items-center gap-1">
                                                            <ThumbsUp className="w-3 h-3" />
                                                            Pontos Positivos
                                                        </p>
                                                        <div className="grid gap-1">
                                                            {inspection.inspection_items
                                                                .filter((item: any) => item.status === 'positive')
                                                                .map((item: any, idx: number) => (
                                                                    <div key={idx} className="text-xs bg-success/10 text-success px-2 py-1 rounded flex items-start gap-2">
                                                                        <span className="font-medium">• {item.criterion || item.category}</span>
                                                                        {item.quantidade > 1 && <span className="ml-auto font-bold">x{item.quantidade}</span>}
                                                                    </div>
                                                                ))
                                                            }
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button size="sm" variant="outline" onClick={() => handleEdit(inspection)}>
                                                <Pencil className="w-3 h-3 mr-2" />
                                                Editar
                                            </Button>
                                            <Button size="sm" variant="destructive" onClick={() => handleDelete(inspection.id)}>
                                                <Trash2 className="w-3 h-3 mr-2" />
                                                Excluir
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )
                }
            </div>

            {/* Preview Dialog */}
            <Dialog open={showPreview} onOpenChange={setShowPreview}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Atualizar Fiscalização' : 'Confirmar Fiscalização'}</DialogTitle>
                        <DialogDescription>Revise os dados antes de salvar.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-muted/50 p-3 rounded">
                                <Label className="text-xs text-muted-foreground">Gestor</Label>
                                <p className="font-medium">{gestorSelecionado?.nome}</p>
                            </div>
                            <div className="bg-muted/50 p-3 rounded">
                                <Label className="text-xs text-muted-foreground">Data</Label>
                                <p className="font-medium">{new Date(dataEvento + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                            </div>
                        </div>

                        {generalObservation && (
                            <div className="bg-muted/30 p-3 rounded-lg border border-border">
                                <Label className="text-xs text-muted-foreground">Observações Gerais</Label>
                                <p className="text-sm mt-1 whitespace-pre-wrap">{generalObservation}</p>
                            </div>
                        )}

                        {items.filter(i => i.status === 'negative').length > 0 && (
                            <div className="space-y-2">
                                <Label className="text-destructive font-medium flex items-center gap-2">
                                    <ThumbsDown className="w-4 h-4" /> Pontos Negativos
                                </Label>
                                <div className="border border-destructive/20 rounded-lg divide-y divide-destructive/10">
                                    {items.filter(i => i.status === 'negative').map((item, idx) => (
                                        <div key={idx} className="p-3 bg-destructive/5 text-sm flex justify-between items-start">
                                            <div className="flex-1">
                                                <p className="font-medium text-destructive">{item.category}</p>
                                                <p className="text-muted-foreground mt-1 text-xs">{item.observation}</p>
                                            </div>
                                            <Badge variant="destructive">
                                                {item.quantity} {item.quantity > 1 ? 'ocorrências' : 'ocorrência'}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {items.filter(i => i.status === 'positive').length > 0 && (
                            <div className="space-y-2">
                                <Label className="text-success font-medium flex items-center gap-2">
                                    <ThumbsUp className="w-4 h-4" /> Pontos Positivos ({items.filter(i => i.status === 'positive').reduce((acc, curr) => acc + curr.quantity, 0)})
                                </Label>
                                <div className="border border-success/20 rounded-lg divide-y divide-success/10">
                                    {items.filter(i => i.status === 'positive').map((item, idx) => (
                                        <div key={idx} className="p-3 bg-success/5 text-sm flex justify-between items-start">
                                            <p className="font-medium text-success">{item.category}</p>
                                            <Badge variant="default" className="bg-success">
                                                {item.quantity} {item.quantity > 1 ? 'ocorrências' : 'ocorrência'}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowPreview(false)}>Voltar</Button>
                        <Button onClick={handleSubmit} disabled={submitting} variant="hero">
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                            {editingId ? 'Salvar Alterações' : 'Confirmar Registro'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Fiscalização?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir este registro? Essa ação não pode ser desfeita e afetará o ranking.
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
                title="Exportar Dados de Calls"
                description="Selecione o período para exportar o relatório de fiscalização de calls."
            />
        </DashboardLayout >
    );
}
