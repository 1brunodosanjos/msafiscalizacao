import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { addDays, format } from 'date-fns';

interface ExportDataDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onExport: (startDate: string, endDate: string, format: 'pdf' | 'csv') => Promise<void>;
    title?: string;
    description?: string;
}

export function ExportDataDialog({
    open,
    onOpenChange,
    onExport,
    title = "Exportar Dados",
    description = "Selecione o período para exportar o relatório de desempenho."
}: ExportDataDialogProps) {
    const [startDate, setStartDate] = useState(format(addDays(new Date(), -30), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [isExporting, setIsExporting] = useState<'pdf' | 'csv' | null>(null);

    const handleExport = async (format: 'pdf' | 'csv') => {
        setIsExporting(format);
        try {
            await onExport(startDate, endDate, format);
            onOpenChange(false);
        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            setIsExporting(null);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="start-date">Data Inicial</Label>
                            <Input
                                id="start-date"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="end-date">Data Final</Label>
                            <Input
                                id="end-date"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => handleExport('csv')}
                        disabled={!!isExporting}
                    >
                        {isExporting === 'csv' ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
                        )}
                        Exportar Excel (CSV)
                    </Button>
                    <Button
                        className="w-full sm:w-auto"
                        onClick={() => handleExport('pdf')}
                        disabled={!!isExporting}
                    >
                        {isExporting === 'pdf' ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <FileText className="mr-2 h-4 w-4 text-red-500" />
                        )}
                        Exportar PDF
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
