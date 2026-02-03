import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Gestores from "./pages/Gestores";
import Fiscalizacao from "./pages/Fiscalizacao";
import FiscalizacaoCalls from "./pages/FiscalizacaoCalls";
import Rankings from "./pages/Rankings";
import Usuarios from "./pages/Usuarios";
import Mensagens from "./pages/Mensagens";
import Escalas from "./pages/Escalas";
import Tokens from "./pages/Tokens";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

import { useAuth } from "@/lib/auth";
import { Loader2, ArrowLeft } from "lucide-react";

// ProtectedRoute component handles access control
const ProtectedRoute = ({
  children,
  requiredRole,
  requiredPermission
}: {
  children: React.ReactNode,
  requiredRole?: 'admin' | 'fiscalizador',
  requiredPermission?: keyof import("@/lib/auth").UserPermissions
}) => {
  const { user, profile, permissions, loading, isAdmin } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Admin bypasses all checks
  if (isAdmin) {
    return <>{children}</>;
  }

  // Check role requirement
  if (requiredRole && profile?.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  // Check permission requirement
  if (requiredPermission && permissions && !permissions[requiredPermission]) {
    // Redirect to first available page or simple unauthorized
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 animate-fade-in">
        <div className="text-xl font-semibold">Acesso não autorizado</div>
        <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
      </div>
    );
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<Auth />} />

            <Route path="/dashboard" element={
              <ProtectedRoute requiredPermission="access_dashboard">
                <Dashboard />
              </ProtectedRoute>
            } />

            <Route path="/gestores" element={
              <ProtectedRoute requiredRole="admin">
                <Gestores />
              </ProtectedRoute>
            } />

            <Route path="/fiscalizacao" element={
              <ProtectedRoute requiredPermission="access_telegram">
                <Fiscalizacao />
              </ProtectedRoute>
            } />

            <Route path="/fiscalizacao-calls" element={
              <ProtectedRoute requiredPermission="access_calls">
                <FiscalizacaoCalls />
              </ProtectedRoute>
            } />

            <Route path="/rankings" element={
              <ProtectedRoute requiredPermission="access_rankings">
                <Rankings />
              </ProtectedRoute>
            } />

            <Route path="/ranking" element={<Navigate to="/rankings" replace />} />

            <Route path="/usuarios" element={
              <ProtectedRoute requiredRole="admin">
                <Usuarios />
              </ProtectedRoute>
            } />

            <Route path="/mensagens" element={
              <ProtectedRoute requiredPermission="access_reports">
                <Mensagens />
              </ProtectedRoute>
            } />

            <Route path="/escalas" element={
              <ProtectedRoute requiredPermission="access_scales">
                <Escalas />
              </ProtectedRoute>
            } />

            <Route path="/tokens" element={
              <ProtectedRoute requiredRole="admin">
                <Tokens />
              </ProtectedRoute>
            } />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
