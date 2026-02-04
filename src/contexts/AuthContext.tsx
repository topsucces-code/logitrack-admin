import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import type { AdminUser } from '../types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  adminUser: AdminUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchAdminUser(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchAdminUser(session.user.id);
      } else {
        setAdminUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchAdminUser = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('logitrack_admin_users')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching admin user:', error);
        // Create admin user if not exists (for initial setup)
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          const newAdmin: Partial<AdminUser> = {
            id: userId,
            email: userData.user.email || '',
            full_name: userData.user.user_metadata?.full_name || 'Admin',
            role: 'super_admin',
            permissions: ['*'],
            is_active: true,
          };
          setAdminUser(newAdmin as AdminUser);
        }
      } else {
        setAdminUser(data);
      }
    } catch (err) {
      console.error('Error in fetchAdminUser:', err);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string): Promise<{ error?: string }> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      return {};
    } catch (err) {
      return { error: 'Une erreur est survenue' };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setAdminUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, adminUser, loading, signIn, signOut }}>
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
