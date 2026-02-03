
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Calendar } from 'lucide-react';
import { MONTHS, YEARS } from '@/lib/constants';


interface MonthYearPickerProps {
    selectedMonth: number | string;
    selectedYear: number | string;
    onMonthChange: (month: string) => void;
    onYearChange: (year: string) => void;
    className?: string;
    showMonth?: boolean;
}

// MONTHS and YEARS moved to src/lib/constants.ts


export function MonthYearPicker({
    selectedMonth,
    selectedYear,
    onMonthChange,
    onYearChange,
    className = "",
    showMonth = true
}: MonthYearPickerProps) {
    return (
        <div className={`flex items-center gap-2 ${className}`}>
            {showMonth && (
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <Select
                        value={selectedMonth.toString()}
                        onValueChange={onMonthChange}
                    >
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Mês" />
                        </SelectTrigger>
                        <SelectContent>
                            {MONTHS.map((month, index) => (
                                <SelectItem key={index + 1} value={(index + 1).toString()}>
                                    {month}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            <Select
                value={selectedYear.toString()}
                onValueChange={onYearChange}
            >
                <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                    {YEARS.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                            {year}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
