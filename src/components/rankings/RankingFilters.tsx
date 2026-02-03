import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Calendar, User, Filter } from 'lucide-react';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import { MONTHS } from '@/lib/constants';


interface Gestor {
  id: string;
  nome: string;
}

interface RankingFiltersProps {
  period: 'week' | 'month';
  setPeriod: (period: 'week' | 'month') => void;
  selectedWeek: number;
  setSelectedWeek: (week: number) => void;
  selectedMonth: number;
  setSelectedMonth: (month: number) => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  selectedGestor: string;
  setSelectedGestor: (gestor: string) => void;
  gestores: Gestor[];
}

// MONTHS moved to src/lib/constants.ts


export default function RankingFilters({
  period,
  setPeriod,
  selectedWeek,
  setSelectedWeek,
  selectedMonth,
  setSelectedMonth,
  selectedYear,
  setSelectedYear,
  selectedGestor,
  setSelectedGestor,
  gestores,
}: RankingFiltersProps) {

  return (
    <div className="flex flex-wrap gap-4 p-4 rounded-xl bg-secondary/30 border border-border">
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">Filtros:</span>
      </div>

      {/* Período */}
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

      {/* Mês e Ano */}
      <MonthYearPicker
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onMonthChange={(v) => setSelectedMonth(parseInt(v))}
        onYearChange={(v) => setSelectedYear(parseInt(v))}
      />

      {/* Semana (se período semanal) */}
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

      {/* Gestor */}
      <div className="flex items-center gap-2">
        <User className="w-4 h-4 text-muted-foreground" />
        <Label className="text-sm text-muted-foreground">Gestor:</Label>
        <Select value={selectedGestor} onValueChange={setSelectedGestor}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os gestores</SelectItem>
            {gestores.map((gestor) => (
              <SelectItem key={gestor.id} value={gestor.id}>
                {gestor.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
