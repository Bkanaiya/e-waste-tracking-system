import { createContext, useContext, useState, useCallback } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

function readUser() {
    const raw = localStorage.getItem('ewaste_user');
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(readUser);

    const persist = (tkn, nextUser) => {
        localStorage.setItem('ewaste_token', tkn);
        localStorage.setItem('ewaste_user', JSON.stringify(nextUser));
        setUser(nextUser);
    };

    const loginCustomer = useCallback(async (mode, payload) => {
        const path = mode === 'register' ? '/auth/register' : '/auth/login';
        const data = await api(path, { method: 'POST', body: payload, auth: false });
        persist(data.token, {
            kind: 'customer',
            role: 'customer',
            name: data.customer.name,
            email: data.customer.email,
            customerId: data.customer.customerId
        });
        return data.customer;
    }, []);

    const loginStaff = useCallback(async (role, password) => {
        const data = await api('/auth/staff/login', {
            method: 'POST',
            body: { role, password },
            auth: false
        });
        persist(data.token, { kind: 'staff', role });
        return data.staff;
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('ewaste_token');
        localStorage.removeItem('ewaste_user');
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, loginCustomer, loginStaff, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
