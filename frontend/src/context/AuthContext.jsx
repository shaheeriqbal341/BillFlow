import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState('');

  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await api.get('/auth/me');
        setUser(data.user);
        setBusiness(data.business);
      } catch (error) {
        setUser(null);
        setBusiness(null);
        if (!error.response || error.response.status >= 500) setConnectionError('BillFlow could not reach the API. Check that the backend is running and MongoDB is connected.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const login = async ({ email, password }) => {
    const { data } = await api.post('/auth/login', { email, password });
    const { data: session } = await api.get('/auth/me');
    setUser(session.user);
    setBusiness(session.business);
    setConnectionError('');
    return { ...data, user: session.user, business: session.business };
  };

  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    const { data: session } = await api.get('/auth/me');
    setUser(session.user);
    setBusiness(session.business);
    setConnectionError('');
    return { ...data, user: session.user, business: session.business };
  };

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
    setBusiness(null);
  };

  const value = useMemo(() => ({ user, business, loading, connectionError, login, register, logout }), [user, business, loading, connectionError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
