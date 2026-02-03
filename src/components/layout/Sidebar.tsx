import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  Trophy,
  LogOut,
  Shield,
  BarChart3,
  Video,
  Calendar,
  Key,
  Menu,
  X
} from 'lucide-react';

// Define props for controlled component
interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
}

export default function Sidebar({ isOpen, onClose, onToggle }: SidebarProps) {
  const { profile, signOut, isAdmin, permissions } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const isActive = (path: string) => location.pathname === path;

  // Define items with access logic
  const allNavItems = [
    {
      path: '/dashboard',
      icon: LayoutDashboard,
      label: 'Dashboard',
      show: isAdmin || permissions?.access_dashboard
    },
    {
      path: '/gestores',
      icon: Users,
      label: 'Gestores',
      show: isAdmin
    },
    {
      path: '/fiscalizacao',
      icon: ClipboardCheck,
      label: 'Fiscalização Telegram',
      show: isAdmin || permissions?.access_telegram
    },
    {
      path: '/fiscalizacao-calls',
      icon: Video,
      label: 'Fiscalização de Calls',
      show: isAdmin || permissions?.access_calls
    },
    {
      path: '/rankings',
      icon: Trophy,
      label: 'Rankings',
      show: isAdmin || permissions?.access_rankings
    },
    {
      path: '/mensagens',
      icon: BarChart3,
      label: 'Relatórios',
      show: isAdmin || permissions?.access_reports
    },
    {
      path: '/escalas',
      icon: Calendar,
      label: 'Escalas',
      show: isAdmin || permissions?.access_scales
    },
    {
      path: '/tokens',
      icon: Key,
      label: 'Tokens de Convite',
      show: isAdmin
    }
  ];

  const navigateTo = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button variant="outline" size="icon" onClick={onToggle} className="bg-sidebar border-sidebar-border shadow-md">
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside className={`fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border transition-transform duration-300 ease-in-out lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30 p-1">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain brightness-0 invert" />
            </div>
            <div>
              <h1 className="font-semibold text-sidebar-foreground">Fiscalização MSA</h1>
              <p className="text-xs text-muted-foreground">Fiscalização</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
            {allNavItems.filter(item => item.show).map((item) => (
              <Button
                key={item.path}
                variant={isActive(item.path) ? 'secondary' : 'ghost'}
                className="w-full justify-start gap-3"
                onClick={() => navigateTo(item.path)}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Button>
            ))}
            {isAdmin && (
              <Button
                variant={isActive('/usuarios') ? 'secondary' : 'ghost'}
                className="w-full justify-start gap-3"
                onClick={() => navigateTo('/usuarios')}
              >
                <Users className="w-4 h-4" />
                Usuários
              </Button>
            )}
          </nav>

          <div className="border-t border-sidebar-border p-4 bg-sidebar/50 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center border border-sidebar-border">
                <span className="text-sm font-semibold">
                  {profile?.nome?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{profile?.nome || 'Usuário'}</p>
                <Badge variant={isAdmin ? 'default' : 'secondary'} className="text-[10px] h-4">
                  {isAdmin ? 'Admin' : 'Fiscalizador'}
                </Badge>
              </div>
            </div>
            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={handleSignOut}>
              <LogOut className="w-4 h-4" />
              Sair
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
// Sidebar Updated
