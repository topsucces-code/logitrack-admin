import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import type { AdminUser } from '../types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  adminUser: AdminUser | null;
  loading: boolean;
  signIn: (phone: string, password: string) => Promise<{ error?: string }>;
  signUp: (data: SignUpData) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

interface SignUpData {
  phone: string;
  password: string;
  fullName: string;
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
            email: userData.user.phone || userData.user.email || '',
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

  const signIn = async (phone: string, password: string): Promise<{ error?: string }> => {
    try {
      // Format phone as email for Supabase auth
      const cleanPhone = phone.replace(/\D/g, '');
      const email = `admin_${cleanPhone}@logitrack.app`;

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          return { error: 'Numéro ou mot de passe incorrect' };
        }
        return { error: error.message };
      }

      return {};
    } catch (err) {
      return { error: 'Une erreur est survenue' };
    }
  };

  const signUp = async (data: SignUpData): Promise<{ error?: string }> => {
    try {
      const cleanPhone = data.phone.replace(/\D/g, '');
      const email = `admin_${cleanPhone}@logitrack.app`;

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
            phone: data.phone,
          },
        },
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          return { error: 'Ce numéro est déjà utilisé. Essayez de vous connecter.' };
        }
        return { error: authError.message };
      }

      if (!authData.user) {
        return { error: 'Erreur lors de la création du compte' };
      }

      // If session exists, user is auto-confirmed
      if (authData.session) {
        setSession(authData.session);
        setUser(authData.user);
      }

      // Small delay to ensure auth user is fully created
      await new Promise(resolve => setTimeout(resolve, 500));

      // Create admin profile
      const { error: adminError } = await supabase
        .from('logitrack_admin_users')
        .insert({
          user_id: authData.user.id,
          email: email,
          full_name: data.fullName,
          role: 'super_admin',
          permissions: ['*'],
          is_active: true,
        });

      if (adminError) {
        console.error('Admin creation error:', adminError);
        // Don't return error - user can still login
      }

      return {};
    } catch (err) {
      console.error('SignUp exception:', err);
      return { error: 'Erreur lors de l\'inscription' };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setAdminUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, adminUser, loading, signIn, signUp, signOut }}>
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
