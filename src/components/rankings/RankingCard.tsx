import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Crown, Medal, Award, TrendingUp, TrendingDown, MessageSquare, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RankingCardProps {
  position: number;
  nome: string;
  username_telegram?: string | null;
  value: number;
  type: 'score' | 'messages' | 'negatives';
  positivos?: number;
  negativos?: number;
  mensagens?: number;
  onViewDetails?: () => void;
}

export default function RankingCard({
  position,
  nome,
  username_telegram,
  value,
  type,
  positivos,
  negativos,
  mensagens,
  onViewDetails,
}: RankingCardProps) {
  const getPositionIcon = (pos: number) => {
    switch (pos) {
      case 0:
        return <Crown className="w-5 h-5 text-warning" />;
      case 1:
        return <Medal className="w-5 h-5 text-muted-foreground" />;
      case 2:
        return <Award className="w-5 h-5 text-warning/70" />;
      default:
        return null;
    }
  };

  const getPositionStyles = (pos: number) => {
    switch (pos) {
      case 0:
        return 'bg-gradient-to-r from-warning/20 to-warning/5 border-warning/30';
      case 1:
        return 'bg-gradient-to-r from-muted-foreground/10 to-muted-foreground/5 border-muted-foreground/20';
      case 2:
        return 'bg-gradient-to-r from-warning/10 to-warning/5 border-warning/20';
      default:
        return 'bg-card border-border';
    }
  };

  const getValueColor = () => {
    if (type === 'negatives') return 'text-destructive';
    if (type === 'messages') return 'text-primary';
    return value > 0 ? 'text-success' : value < 0 ? 'text-destructive' : 'text-muted-foreground';
  };

  const getValueLabel = () => {
    switch (type) {
      case 'messages':
        return 'Mensagens';
      case 'negatives':
        return 'Negativos';
      default:
        return 'Pontuação';
    }
  };

  return (
    <Card className={`border transition-all duration-300 hover:scale-[1.01] ${getPositionStyles(position)}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Position */}
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${
            position === 0 ? 'bg-warning text-warning-foreground' :
            position === 1 ? 'bg-muted-foreground/30 text-foreground' :
            position === 2 ? 'bg-warning/30 text-warning' :
            'bg-secondary text-muted-foreground'
          }`}>
            {getPositionIcon(position) || (position + 1)}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">{nome}</h3>
              {position === 0 && (
                <Badge variant="warning" className="bg-warning/20 text-warning border-warning/30">
                  Líder
                </Badge>
              )}
            </div>
            {username_telegram && (
              <p className="text-sm text-muted-foreground">@{username_telegram}</p>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4">
            {mensagens !== undefined && (
              <div className="text-center">
                <div className="flex items-center gap-1 text-primary">
                  <MessageSquare className="w-4 h-4" />
                  <span className="text-lg font-bold">{mensagens}</span>
                </div>
                <p className="text-xs text-muted-foreground">Msgs</p>
              </div>
            )}
            {positivos !== undefined && (
              <div className="text-center">
                <div className="flex items-center gap-1 text-success">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-lg font-bold">{positivos}</span>
                </div>
                <p className="text-xs text-muted-foreground">Pos</p>
              </div>
            )}
            {negativos !== undefined && (
              <div className="text-center">
                <div className="flex items-center gap-1 text-destructive">
                  <TrendingDown className="w-4 h-4" />
                  <span className="text-lg font-bold">{negativos}</span>
                </div>
                <p className="text-xs text-muted-foreground">Neg</p>
              </div>
            )}
            <div className="text-center min-w-[80px] border-l border-border pl-4">
              <div className={`text-2xl font-bold ${getValueColor()}`}>
                {type === 'score' && value > 0 ? '+' : ''}{value}
              </div>
              <p className="text-xs text-muted-foreground">{getValueLabel()}</p>
            </div>
          </div>

          {/* View details */}
          {onViewDetails && (
            <Button variant="ghost" size="icon" onClick={onViewDetails}>
              <Eye className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
