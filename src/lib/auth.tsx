import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface UserPermissions {
  access_telegram: boolean;
  access_calls: boolean;
  access_rankings: boolean;
  access_dashboard: boolean;
  access_reports: boolean;
  access_scales: boolean;
}

interface Profile {
  id: string;
  nome: string; // mapped from full_name
  email: string;
  role: 'admin' | 'fiscalizador'; // Changed from perfil to role to match DB
  ativo: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  permissions: UserPermissions | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, nome: string, token: string) => Promise<{ error: Error | null, data: any }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        setProfile(null);
        setPermissions(null);
        return;
      }

      if (profileData) {
        // Map DB columns to Profile interface
        const mappedProfile: Profile = {
          id: (profileData as any).id,
          nome: (profileData as any).full_name || 'Sem Nome',
          email: (profileData as any).email,
          role: (profileData as any).role as 'admin' | 'fiscalizador',
          ativo: (profileData as any).ativo ?? true
        };
        setProfile(mappedProfile);

        // Fetch permissions or set defaults based on role
        if (mappedProfile.role === 'admin') {
          // Admin has all permissions
          setPermissions({
            access_telegram: true,
            access_calls: true,
            access_rankings: true,
            access_dashboard: true,
            access_reports: true,
            access_scales: true,
          });
        } else {
          // Fetch from user_permissions table
          const { data: permData, error: permError } = await supabase
            .from('user_permissions')
            .select('*')
            .eq('user_id', userId)
            .single();

          if (permData) {
            setPermissions({
              access_telegram: (permData as any).access_telegram,
              access_calls: (permData as any).access_calls,
              access_rankings: (permData as any).access_rankings,
              access_dashboard: (permData as any).access_dashboard,
              access_reports: (permData as any).access_reports ?? false,
              access_scales: (permData as any).access_scales ?? false,
            });
          } else {
            // Default permissions if no record exists (safe default: strictly limited or basic access?)
            // Let's assume no access defaults to false for safety
            setPermissions({
              access_telegram: false,
              access_calls: false,
              access_rankings: false,
              access_dashboard: false,
              access_reports: false,
              access_scales: false,
            });
          }
        }
      }
    } catch (err) {
      console.error('Unexpected error in fetchProfile:', err);
      setProfile(null);
      setPermissions(null);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setPermissions(null);
        }

        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchProfile(session.user.id);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, nome: string, token: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: nome,
          invitation_token: token,
        },
      },
    });
    return { error, data };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setPermissions(null);
  };

  const isAdmin = profile?.role === 'admin';

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      permissions,
      loading,
      signIn,
      signUp,
      signOut,
      isAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
