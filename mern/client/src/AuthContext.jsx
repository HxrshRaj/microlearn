import { createContext, useContext, useEffect, useState } from 'react';
import { api, refreshSession, setAccessToken, setAuthLostHandler } from './api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAuthLostHandler(() => setUser(null));
    refreshSession().then(setUser).finally(() => setReady(true));
  }, []);

  const authenticate = async (path, body) => {
    const data = await api(path, { method: 'POST', body, auth: false });
    setAccessToken(data.accessToken);
    setUser(data.user);
  };
  const login = (identifier, password) => authenticate('/auth/login', { identifier, password });
  const register = (username, email, password) => authenticate('/auth/register', { username, email, password });
  const logout = async () => {
    await api('/auth/logout', { method: 'POST', auth: false }).catch(() => {});
    setAccessToken(null);
    setUser(null);
  };

  return <Ctx.Provider value={{ user, ready, login, register, logout }}>{children}</Ctx.Provider>;
}
