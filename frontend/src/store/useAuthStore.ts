import { create } from 'zustand';
import { UserProfile, UserRole, ApiMessageResponse } from '../api/types';
import { loginApi, registerApi, getMeApi, loginWithGoogleApi } from '../api/authClient';

const TOKEN_KEY = 'cashflow_auth_token';

interface AuthState {
  isAuthenticated: boolean;
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  isInitializing: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithGoogle: (googleToken: string, role?: UserRole) => Promise<boolean>;
  register: (name: string, email: string, password: string, role: UserRole) => Promise<ApiMessageResponse>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,
  token: localStorage.getItem(TOKEN_KEY),
  isLoading: false,
  isInitializing: true,
  error: null,

  checkAuth: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      set({ isAuthenticated: false, user: null, token: null, isInitializing: false });
      return;
    }

    try {
      set({ isInitializing: true });
      const user = await getMeApi();
      set({
        isAuthenticated: true,
        user,
        token,
        isInitializing: false,
        error: null,
      });
    } catch (err: any) {
      console.warn('Session verification failed, logging out:', err?.message);
      localStorage.removeItem(TOKEN_KEY);
      set({
        isAuthenticated: false,
        user: null,
        token: null,
        isInitializing: false,
      });
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await loginApi(email, password);
      localStorage.setItem(TOKEN_KEY, response.access_token);
      set({
        isAuthenticated: true,
        user: response.user,
        token: response.access_token,
        isLoading: false,
        error: null,
      });
      return true;
    } catch (err: any) {
      const errorMsg = err?.response?.data?.detail || err?.message || 'Login failed. Please check credentials.';
      set({ isLoading: false, error: errorMsg });
      return false;
    }
  },

  loginWithGoogle: async (googleToken: string, role?: UserRole) => {
    set({ isLoading: true, error: null });
    try {
      const response = await loginWithGoogleApi(googleToken, role);
      localStorage.setItem(TOKEN_KEY, response.access_token);
      set({
        isAuthenticated: true,
        user: response.user,
        token: response.access_token,
        isLoading: false,
        error: null,
      });
      return true;
    } catch (err: any) {
      const errorMsg = err?.response?.data?.detail || err?.message || 'Google sign-in failed. Please try again.';
      set({ isLoading: false, error: errorMsg });
      return false;
    }
  },

  register: async (name: string, email: string, password: string, role: UserRole) => {
    set({ isLoading: true, error: null });
    try {
      const response = await registerApi(name, email, password, role);
      set({ isLoading: false, error: null });
      return response;
    } catch (err: any) {
      const errorMsg = err?.response?.data?.detail || err?.message || 'Registration failed.';
      set({ isLoading: false, error: errorMsg });
      throw new Error(errorMsg);
    }
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({
      isAuthenticated: false,
      user: null,
      token: null,
      error: null,
    });
  },

  clearError: () => set({ error: null }),
}));
