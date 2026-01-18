import { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin, register as apiRegister, logout as apiLogout, getCurrentUser } from '../services/api';

const AuthContext = createContext(null);

const SESSION_TOKEN_KEY = 'identityshield_session';
const USER_DATA_KEY = 'identityshield_user';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load user from localStorage on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        const sessionToken = localStorage.getItem(SESSION_TOKEN_KEY);
        const savedUser = localStorage.getItem(USER_DATA_KEY);

        if (sessionToken && savedUser) {
          // Verify session is still valid
          try {
            const userData = await getCurrentUser(sessionToken);
            setUser({
              ...userData,
              userId: userData.user_id ?? userData.userId,
              sessionToken,
            });
          } catch (err) {
            // Session expired, clear storage
            localStorage.removeItem(SESSION_TOKEN_KEY);
            localStorage.removeItem(USER_DATA_KEY);
          }
        }
      } catch (err) {
        console.error('Error loading user:', err);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = async (email, password) => {
    setError(null);
    try {
      const result = await apiLogin(email, password);

      if (result.success) {
        const userData = {
          userId: result.user_id,
          email: result.email,
          name: result.name,
          sessionToken: result.session_token,
        };

        localStorage.setItem(SESSION_TOKEN_KEY, result.session_token);
        localStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
        setUser(userData);
        return { success: true };
      } else {
        setError(result.message || 'Login failed');
        return { success: false, message: result.message };
      }
    } catch (err) {
      const message = err.response?.data?.detail || 'Login failed';
      setError(message);
      return { success: false, message };
    }
  };

  const register = async (email, password, name) => {
    setError(null);
    try {
      const result = await apiRegister(email, password, name);

      if (result.success) {
        const userData = {
          userId: result.user_id,
          email: result.email,
          name: result.name,
          sessionToken: result.session_token,
        };

        localStorage.setItem(SESSION_TOKEN_KEY, result.session_token);
        localStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
        setUser(userData);
        return { success: true };
      } else {
        setError(result.message || 'Registration failed');
        return { success: false, message: result.message };
      }
    } catch (err) {
      const message = err.response?.data?.detail || 'Registration failed';
      setError(message);
      return { success: false, message };
    }
  };

  const logout = async () => {
    try {
      const sessionToken = localStorage.getItem(SESSION_TOKEN_KEY);
      if (sessionToken) {
        await apiLogout(sessionToken);
      }
    } catch (err) {
      console.error('Error logging out:', err);
    } finally {
      localStorage.removeItem(SESSION_TOKEN_KEY);
      localStorage.removeItem(USER_DATA_KEY);
      setUser(null);
    }
  };

  const refreshUser = async () => {
    const sessionToken = localStorage.getItem(SESSION_TOKEN_KEY);
    if (!sessionToken) return;

    try {
      const userData = await getCurrentUser(sessionToken);
      setUser({
        ...userData,
        userId: userData.user_id ?? userData.userId,
        sessionToken,
      });
    } catch (err) {
      console.error('Error refreshing user:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        register,
        logout,
        refreshUser,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
