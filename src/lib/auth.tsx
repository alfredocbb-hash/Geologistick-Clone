import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface Profile {
  id: string;
  user_id: string;
  email: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  avatar_url: string | null;
  sucursal_id: string | null;
  activo: boolean | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, nombre: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isAdmin: () => boolean;
  isSuperAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData as Profile);
      }

      // Fetch roles
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (rolesData) {
        setRoles(rolesData.map((r) => r.role));
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  useEffect(() => {
    let mounted = true;
    let initialSessionLoaded = false;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        // Log auth events for debugging (only in development)
        if (import.meta.env.DEV) {
          console.log('Auth event:', event, session?.user?.id);
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Use setTimeout to avoid potential race conditions with Supabase internals
          setTimeout(() => {
            if (mounted) {
              fetchUserData(session.user.id);
            }
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
        }

        // Only update loading after initial session has been loaded
        if (initialSessionLoaded) {
          setLoading(false);
        }
      }
    );

    // THEN get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;

      initialSessionLoaded = true;
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    // Set up periodic session check to detect expired sessions
    const sessionCheckInterval = setInterval(async () => {
      if (!mounted) return;
      
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      
      if (error) {
        if (import.meta.env.DEV) {
          console.error('Session check error:', error);
        }
        return;
      }

      // If we had a session but now we don't, update state
      if (session && !currentSession) {
        setSession(null);
        setUser(null);
        setProfile(null);
        setRoles([]);
      }
    }, 60000); // Check every minute

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearInterval(sessionCheckInterval);
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, nombre: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { nombre },
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRoles([]);
  };

  const hasRole = (role: AppRole) => roles.includes(role);

  const isAdmin = () => hasRole('admin') || hasRole('super_admin');

  const isSuperAdmin = () => hasRole('super_admin');

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        roles,
        loading,
        signIn,
        signUp,
        signOut,
        hasRole,
        isAdmin,
        isSuperAdmin,
      }}
    >
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
