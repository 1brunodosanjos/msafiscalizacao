
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, X, Plus, Trash2, Save, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import html2canvas from "html2canvas";

interface CronogramaItem {
    id: string; // can be temporary for new items
    dia_semana: string;
    horario: string;
    observacao: string;
    gestor_id: string;
    grupo_id: string | null; // Optional if DB allows, but usually we link to a group
    isNew?: boolean;
}

interface Gestor {
    id: string;
    nome: string;
    setor?: string; // Legacy column
    setores?: string[]; // New array column
}

interface Grupo {
    id: string;
    nome: string;
}

const DIAS_ORDEM = ['seg', 'ter', 'qua', 'qui', 'sex'];
const DIAS_LABEL: Record<string, string> = {
    seg: 'SEGUNDA-FEIRA',
    ter: 'TERÇA-FEIRA',
    qua: 'QUARTA-FEIRA',
    qui: 'QUINTA-FEIRA',
    sex: 'SEXTA-FEIRA',
    sab: 'SÁBADO',
    dom: 'DOMINGO'
};

export function CronogramaCallsView({ readOnly }: { readOnly?: boolean }) {
    const [items, setItems] = useState<CronogramaItem[]>([]);
    const [gestores, setGestores] = useState<Gestor[]>([]);
    const [grupos, setGrupos] = useState<Grupo[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'geral' | 'start' | 'vip' | 'premium'>('geral');

    // Load data on mount
    // Load data on mount
    useEffect(() => {
        const loadData = async () => {
            const [gestoresRes, gruposRes] = await Promise.all([
                // Select all columns to ensure we have 'setor', 'setores', 'no_grupo_telegram', etc.
                supabase.from('gestores').select('*').eq('ativo', true).order('nome'),
                supabase.from('grupos').select('id, nome').order('nome')
            ]);

            if (gestoresRes.data) {
                const allGestores = gestoresRes.data as any[];

                // Normalize sectors exactly like Gestores.tsx to ensure consistency
                const normalizedGestores = allGestores.map(g => {
                    const setores = new Set([
                        ...(g.setores || []),
                        g.setor || 'calls',
                        ...(g.no_grupo_telegram ? ['telegram'] : [])
                    ]);
                    return { ...g, setores: Array.from(setores) };
                });

                // Filter for 'calls'
                const callsGestores = normalizedGestores.filter(g => g.setores.includes('calls'));
                setGestores(callsGestores);
            }

            if (gruposRes.data) setGrupos(gruposRes.data as any);
            fetchCronograma();
        };

        loadData();
    }, []);

    const fetchCronograma = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('gestor_calls_escala')
            .select(`
        id,
        dia_semana,
        horario,
        observacao,
        gestor_id,
        grupo_id
      `)
            .order('horario');

        if (error) {
            console.error('Erro ao buscar cronograma:', error);
            toast.error("Erro ao carregar dados.");
        } else {
            const mapped = (data || []).map((d: any) => ({
                ...d,
                observacao: d.observacao || ''
            }));
            setItems(mapped);
        }
        setLoading(false);
    };

    const handleAddItem = (dia: string) => {
        let defaultGroupId = grupos[0]?.id || null;

        if (filter === 'geral') {
            const geralGroup = grupos.find(g => g.nome.toLowerCase().includes('geral'));
            if (geralGroup) {
                defaultGroupId = geralGroup.id;
            }
        } else {
            const matchingGroup = grupos.find(g => g.nome.toLowerCase().includes(filter));
            if (matchingGroup) {
                defaultGroupId = matchingGroup.id;
            }
        }

        const newItem: CronogramaItem = {
            id: `temp-${Date.now()}`,
            dia_semana: dia,
            horario: '',
            observacao: '',
            gestor_id: '',
            grupo_id: defaultGroupId,
            isNew: true
        };
        setItems(prev => [...prev, newItem]);
    };

    const handleDeleteItem = async (id: string, isNew?: boolean) => {
        if (isNew) {
            setItems(prev => prev.filter(i => i.id !== id));
            return;
        }

        const { error } = await supabase.from('gestor_calls_escala').delete().eq('id', id);
        if (error) {
            toast.error("Erro ao excluir.");
        } else {
            toast.success("Excluído.");
            setItems(prev => prev.filter(i => i.id !== id));
        }
    };

    const handleSaveItem = async (item: CronogramaItem) => {
        if (!item.horario || !item.gestor_id) {
            toast.error("Preencha horário e gestor.");
            return;
        }

        const payload = {
            dia_semana: item.dia_semana,
            horario: item.horario,
            observacao: item.observacao,
            gestor_id: item.gestor_id,
            grupo_id: item.grupo_id
        };

        let result;
        if (item.isNew) {
            // @ts-ignore
            result = await supabase.from('gestor_calls_escala').insert(payload).select();
        } else {
            // @ts-ignore

            result = await supabase.from('gestor_calls_escala').update(payload).eq('id', item.id).select();
        }

        const { data, error } = result;

        if (error) {
            console.error(error);
            toast.error("Erro ao salvar.");
        } else {
            toast.success("Salvo com sucesso!");
            // Update local item with real ID and remove isNew flag
            if (data && data[0]) {
                setItems(prev => prev.map(i => i.id === item.id ? { ...data[0], isNew: false, observacao: data[0].observacao || '' } : i));
            }
        }
    };

    const updateLocalItem = (id: string, field: keyof CronogramaItem, value: any) => {
        setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
    };

    const handleDownloadDay = async (dia: string) => {
        const element = document.getElementById(`schedule-day-${dia}`);
        if (!element) return;

        try {
            toast.info("Gerando imagem...");

            // Calculate dynamic height based on number of rows
            const dayItems = items.filter(item => item.dia_semana === dia);
            const numRows = dayItems.length;
            console.log(`Day ${dia} has ${numRows} calls`);

            const canvas = await html2canvas(element, {
                scale: 4,
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
                windowWidth: 1920,
                allowTaint: true,
                ignoreElements: (el) => el.hasAttribute('data-html2canvas-ignore'),
                onclone: (clonedDoc, clonedEl) => {
                    const scheduleEl = clonedDoc.getElementById(`schedule-day-${dia}`);
                    if (!scheduleEl) {
                        console.error('Schedule element not found in cloned document');
                        return;
                    }

                    console.log('Starting export modifications...');

                    // Force pure white background using cssText (more aggressive)
                    scheduleEl.style.cssText += `
                        background-color: #ffffff !important;
                        background-image: none !important;
                        padding: 40px !important;
                        width: 1200px !important;
                        height: auto !important;
                        opacity: 1 !important;
                        filter: none !important;
                    `;

                    // Force white background on ALL parent elements
                    let parent = scheduleEl.parentElement;
                    while (parent && parent !== clonedDoc.body) {
                        parent.style.cssText += `
                            background-color: #ffffff !important;
                            background-image: none !important;
                            opacity: 1 !important;
                        `;
                        parent = parent.parentElement;
                    }

                    // Apply colors to header and table headers using data attributes
                    const exportElements = scheduleEl.querySelectorAll('[data-export-bg]');
                    console.log(`Found ${exportElements.length} elements with data-export-bg`);

                    exportElements.forEach((el, index) => {
                        if (el instanceof HTMLElement) {
                            const bgColor = el.getAttribute('data-export-bg');
                            const textColor = el.getAttribute('data-export-color');

                            console.log(`Element ${index}: bg=${bgColor}, text=${textColor}`);

                            if (bgColor && textColor) {
                                // Determine font size based on element type
                                const isDayHeader = el.tagName === 'SPAN';
                                const fontSize = isDayHeader ? '40px' : '24px';
                                const padding = isDayHeader ? '20px 48px' : '18px 16px';


                                // Use cssText to force styles more aggressively
                                el.style.cssText += `
                                    background-color: ${bgColor} !important;
                                    background-image: none !important;
                                    color: ${textColor} !important;
                                    opacity: 1 !important;
                                    font-weight: 700 !important;
                                    font-size: ${fontSize} !important;
                                    ${padding ? `padding: ${padding} !important;` : ''}
                                    ${isDayHeader ? 'text-align: center !important; display: block !important;' : ''}
                                `;
                            }
                        }
                    });

                    // Force ALL elements to be fully opaque
                    const allElements = scheduleEl.querySelectorAll('*');
                    let opaqueCount = 0;
                    allElements.forEach(el => {
                        if (el instanceof HTMLElement) {
                            const opacity = window.getComputedStyle(el).opacity;
                            if (parseFloat(opacity) < 1) {
                                el.style.cssText += 'opacity: 1 !important;';
                                opaqueCount++;
                            }
                            // Remove filters
                            el.style.cssText += 'filter: none !important; backdrop-filter: none !important;';
                        }
                    });
                    console.log(`Fixed opacity on ${opaqueCount} elements`);

                    // Remove the delete column
                    const tableRows = scheduleEl.querySelectorAll('.grid-cols-\\[120px_1fr_250px_70px\\]');
                    tableRows.forEach(row => {
                        if (row instanceof HTMLElement) {
                            row.style.gridTemplateColumns = '140px 1fr 250px';
                            const children = Array.from(row.children);
                            if (children.length >= 4) {
                                (children[3] as HTMLElement).style.display = 'none';
                            }
                        }
                    });

                    // Standardize ALL border widths to 1.5px for consistency
                    const borderElements = scheduleEl.querySelectorAll('*');
                    borderElements.forEach(el => {
                        if (el instanceof HTMLElement) {
                            const computedStyle = window.getComputedStyle(el);

                            // Force ALL borders to be exactly 1.5px
                            if (computedStyle.borderTopWidth && computedStyle.borderTopWidth !== '0px') {
                                el.style.borderTopWidth = '1.5px';
                            }
                            if (computedStyle.borderRightWidth && computedStyle.borderRightWidth !== '0px') {
                                el.style.borderRightWidth = '1.5px';
                            }
                            if (computedStyle.borderBottomWidth && computedStyle.borderBottomWidth !== '0px') {
                                el.style.borderBottomWidth = '1.5px';
                            }
                            if (computedStyle.borderLeftWidth && computedStyle.borderLeftWidth !== '0px') {
                                el.style.borderLeftWidth = '1.5px';
                            }

                            // Fix divide borders
                            if (el.classList.contains('divide-x-[3px]') || el.classList.contains('divide-y-[3px]')) {
                                const children = Array.from(el.children);
                                children.forEach((child, index) => {
                                    if (child instanceof HTMLElement && index > 0) {
                                        child.style.cssText += 'border-left-width: 1.5px !important;';
                                    }
                                });
                            }
                        }
                    });

                    // Replace inputs with static divs
                    const inputs = scheduleEl.querySelectorAll('input');
                    inputs.forEach(input => {
                        const div = clonedDoc.createElement('div');
                        div.textContent = input.value;
                        div.style.cssText = `
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            text-align: center;
                            width: 100%;
                            min-height: 32px;
                            padding: 22px 16px;
                            color: #000000 !important;
                            font-weight: 600;
                            font-size: 28px;
                            line-height: 1.4;
                            opacity: 1 !important;
                            background: transparent;
                        `;
                        input.parentElement?.replaceChild(div, input);
                    });

                    // Replace select buttons with static divs
                    const selectTriggers = scheduleEl.querySelectorAll('button[role="combobox"]');
                    selectTriggers.forEach(btn => {
                        const btnEl = btn as HTMLElement;
                        const computedBg = window.getComputedStyle(btnEl).backgroundColor;

                        if (computedBg.includes('0.05')) {
                            btnEl.style.display = 'none';
                            return;
                        }

                        const div = clonedDoc.createElement('div');
                        div.textContent = btnEl.innerText;
                        div.style.cssText = `
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            text-align: center;
                            width: 100%;
                            padding: 22px 16px;
                            color: #000000 !important;
                            font-weight: 600;
                            font-size: 28px;
                            line-height: 1.4;
                            opacity: 1 !important;
                            background: transparent;
                        `;
                        btnEl.parentElement?.replaceChild(div, btnEl);
                    });

                    console.log('Export modifications complete');
                }
            });

            console.log('Canvas generated, creating blob...');

            // Convert canvas to blob and download
            canvas.toBlob((blob) => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `cronograma-${DIAS_LABEL[dia]}.png`;
                    link.click();
                    URL.revokeObjectURL(url);
                    toast.success("Imagem baixada!");
                    console.log('Download complete');
                }
            }, 'image/png', 1.0);
        } catch (error) {
            console.error('Error generating image:', error);
            toast.error("Erro ao gerar imagem");
        }
    };

    // Filter items
    const filteredItems = items.filter(item => {
        if (filter === 'geral') return true;
        const groupName = grupos.find(g => g.id === item.grupo_id)?.nome.toLowerCase() || '';
        return groupName.includes(filter);
    });

    // Group by day
    const grouped = filteredItems.reduce((acc, item) => {
        if (!acc[item.dia_semana]) acc[item.dia_semana] = [];
        acc[item.dia_semana].push(item);
        return acc;
    }, {} as Record<string, CronogramaItem[]>);

    // Sorting
    Object.keys(grouped).forEach(day => {
        grouped[day].sort((a, b) => a.horario.localeCompare(b.horario));
    });

    return (
        <div className="flex flex-col h-full w-full bg-[#0f172a] text-black overflow-hidden relative">
            <div className="flex-none p-6 border-b border-white/10 flex flex-col justify-center items-center bg-emerald-500/10 shrink-0 gap-6">

                <div className="flex flex-wrap gap-2 justify-center">
                    <Button
                        variant={filter === 'geral' ? 'default' : 'outline'}
                        className={`border-emerald-500 hover:bg-emerald-100 ${filter === 'geral' ? 'bg-emerald-400 font-bold text-black' : 'bg-transparent text-white hover:text-black'}`}
                        onClick={() => setFilter('geral')}
                    >
                        Cronograma Grupo Geral
                    </Button>
                    <Button
                        variant={filter === 'start' ? 'default' : 'outline'}
                        className={`border-emerald-500 hover:bg-emerald-100 ${filter === 'start' ? 'bg-emerald-400 font-bold text-black' : 'bg-transparent text-white hover:text-black'}`}
                        onClick={() => setFilter('start')}
                    >
                        Cronograma Grupo Start
                    </Button>
                    <Button
                        variant={filter === 'vip' ? 'default' : 'outline'}
                        className={`border-emerald-500 hover:bg-emerald-100 ${filter === 'vip' ? 'bg-emerald-400 font-bold text-black' : 'bg-transparent text-white hover:text-black'}`}
                        onClick={() => setFilter('vip')}
                    >
                        Cronograma Grupo Vip
                    </Button>
                    <Button
                        variant={filter === 'premium' ? 'default' : 'outline'}
                        className={`border-emerald-500 hover:bg-emerald-100 ${filter === 'premium' ? 'bg-emerald-400 font-bold text-black' : 'bg-transparent text-white hover:text-black'}`}
                        onClick={() => setFilter('premium')}
                    >
                        Cronograma Grupo Premium
                    </Button>
                </div>

                <div className="flex flex-col items-center w-full">
                    <h2 className="text-xl font-bold bg-emerald-300 px-6 py-2 uppercase tracking-wider text-black shadow-sm border border-emerald-900/5 rounded-sm">
                        CRONOGRAMA DA SEMANA | CALLS
                    </h2>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-12 bg-[#0f172a]">
                {loading ? (
                    <div className="flex justify-center items-center h-40">
                        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                    </div>
                ) : (
                    DIAS_ORDEM.map(dia => (
                        <div key={dia} id={`schedule-day-${dia}`} className="flex flex-col items-center w-full animate-in fade-in duration-500 p-6 bg-[#0f172a] rounded-lg">
                            {/* Day Header */}
                            <div className="mb-4 w-full max-w-5xl space-y-2">
                                <div className="flex items-center justify-end">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-white hover:text-emerald-400 hover:bg-white/5 print:hidden"
                                        onClick={() => handleDownloadDay(dia)}
                                        data-html2canvas-ignore
                                    >
                                        <Download className="w-4 h-4 mr-2" /> Baixar Dia
                                    </Button>
                                </div>
                                <div className="flex justify-center">
                                    <span
                                        className="bg-emerald-500 px-12 py-3 font-bold text-xl uppercase text-white border-2 border-emerald-700 shadow-lg rounded-md block text-center w-full max-w-md"
                                        data-export-bg="#10b981"
                                        data-export-color="#000000"
                                    >
                                        {DIAS_LABEL[dia]}
                                    </span>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="w-full max-w-5xl border-[3px] border-black bg-white shadow-xl rounded-sm overflow-hidden">
                                {/* Table Header */}
                                <div className="grid grid-cols-[120px_1fr_250px_70px] border-b-[3px] border-black divide-x-[3px] divide-black bg-emerald-100 font-bold text-sm uppercase">
                                    <div
                                        className="p-3 bg-emerald-500 text-white flex items-center justify-center font-extrabold"
                                        data-export-bg="#10b981"
                                        data-export-color="#000000"
                                    >HORÁRIO</div>
                                    <div
                                        className="p-3 bg-emerald-500 text-white flex items-center justify-center font-extrabold"
                                        data-export-bg="#10b981"
                                        data-export-color="#000000"
                                    >CALL</div>
                                    <div
                                        className="p-3 bg-emerald-500 text-white flex items-center justify-center font-extrabold"
                                        data-export-bg="#10b981"
                                        data-export-color="#000000"
                                    >GESTOR</div>
                                    <div className="p-3 bg-emerald-500 text-white" data-html2canvas-ignore></div>
                                </div>

                                {/* Table Body */}
                                <div className="divide-y-[2px] divide-black text-sm">
                                    {grouped[dia]?.length ? (
                                        grouped[dia].map((item, idx) => (
                                            <div key={item.id} className="grid grid-cols-[120px_1fr_250px_70px] divide-x-[2px] divide-black hover:bg-gray-50 group">
                                                {/* Horário */}
                                                <div className="p-2">
                                                    <Input
                                                        disabled={readOnly}
                                                        className="h-full border-none shadow-none text-center font-extrabold text-base bg-transparent focus-visible:ring-0 disabled:opacity-100 text-black"
                                                        value={item.horario}
                                                        placeholder="00:00"
                                                        onChange={(e) => updateLocalItem(item.id, 'horario', e.target.value)}
                                                        onBlur={() => !item.isNew && handleSaveItem(item)}
                                                    />
                                                </div>

                                                {/* Call (Topic + Group) */}
                                                <div className="p-2 flex gap-1">
                                                    {/* Optional Group Select - Small */}
                                                    <Select
                                                        disabled={readOnly}
                                                        value={item.grupo_id || ''}
                                                        onValueChange={(v) => {
                                                            updateLocalItem(item.id, 'grupo_id', v);
                                                            // setTimeout(() => !item.isNew && handleSaveItem({ ...item, grupo_id: v }), 200);
                                                        }}
                                                    >
                                                        <SelectTrigger className="w-[120px] h-full border-none shadow-none bg-black/5 text-xs focus:ring-0 font-semibold text-black">
                                                            <SelectValue placeholder="Grupo" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {grupos.map(g => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>

                                                    {/* Topic Input */}
                                                    <Input
                                                        disabled={readOnly}
                                                        className="h-full border-none shadow-none bg-transparent focus-visible:ring-0 flex-1 font-semibold text-black disabled:opacity-100"
                                                        value={item.observacao}
                                                        placeholder="Nome da Call / Tema"
                                                        onChange={(e) => updateLocalItem(item.id, 'observacao', e.target.value)}
                                                        onBlur={() => !item.isNew && handleSaveItem(item)}
                                                    />
                                                </div>

                                                {/* Gestor */}
                                                <div className="p-2">
                                                    <Select
                                                        disabled={readOnly}
                                                        value={item.gestor_id}
                                                        onValueChange={(v) => {
                                                            updateLocalItem(item.id, 'gestor_id', v);
                                                            // setTimeout(() => !item.isNew && handleSaveItem({ ...item, gestor_id: v }), 200);
                                                        }}
                                                    >
                                                        <SelectTrigger className="w-full h-full border-none shadow-none bg-transparent focus:ring-0 font-semibold text-black">
                                                            <SelectValue placeholder="Selecione..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {gestores.map(g => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {/* Actions */}
                                                <div className="p-1 flex items-center justify-center gap-1" data-html2canvas-ignore>
                                                    {!readOnly && (
                                                        <>
                                                            {item.isNew && (
                                                                <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600" onClick={() => handleSaveItem(item)}>
                                                                    <Save className="w-3 h-3" />
                                                                </Button>
                                                            )}
                                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteItem(item.id, item.isNew)}>
                                                                <Trash2 className="w-3 h-3" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-4 text-center text-gray-500 italic">
                                            {filter === 'geral' ? 'Sem agendamentos.' : `Sem agendamentos para ${filter}.`}
                                        </div>
                                    )}

                                    {/* Add Button Row */}
                                    {!readOnly && (
                                        <div className="p-2 bg-gray-50 flex justify-center border-t border-black/10" data-html2canvas-ignore>
                                            <Button variant="ghost" size="sm" onClick={() => handleAddItem(dia)} className="text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 gap-2 h-8">
                                                <Plus className="w-3 h-3" /> Adicionar Call
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

// Kept for compatibility if still used as modal elsewhere
export function CronogramaCalls({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-white text-black border-none">
                <CronogramaCallsView />
                <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="absolute right-4 top-4 hover:bg-black/10 z-10">
                    <X className="w-5 h-5" />
                </Button>
            </DialogContent>
        </Dialog>
    );
}
