import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types';

interface AuthContextType {
    user: User | null;
    login: (establishmentId: string) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MANAGERS: User[] = [
    { id: 'mgr_1', name: 'Roberto Manager', role: 'manager', establishmentId: '1', establishmentName: 'Sevilla 1' },
    { id: 'mgr_2', name: 'Laura Manager', role: 'manager', establishmentId: '2', establishmentName: 'Sevilla 2' },
    { id: 'mgr_3', name: 'Carlos Manager', role: 'manager', establishmentId: '3', establishmentName: 'Malaga 2' },
    { id: 'mgr_4', name: 'Ana Manager', role: 'manager', establishmentId: '4', establishmentName: 'Cordoba' },
    { id: 'mgr_5', name: 'David Manager', role: 'manager', establishmentId: '5', establishmentName: 'Jerez' },
    { id: 'mgr_6', name: 'Elena Manager', role: 'manager', establishmentId: '6', establishmentName: 'Malaga 1' },
    { id: 'mgr_7', name: 'Sofia Manager', role: 'manager', establishmentId: '7', establishmentName: 'Granada' },
    { id: 'admin_hq', name: 'Supervisor General', role: 'admin', establishmentId: 'super', establishmentName: 'Central HQ' }
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('saas_schedule_user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    const login = (establishmentId: string) => {
        const foundUser = MANAGERS.find(u => u.establishmentId === establishmentId);
        if (foundUser) {
            setUser(foundUser);
            localStorage.setItem('saas_schedule_user', JSON.stringify(foundUser));
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('saas_schedule_user');
    };

    console.log('AuthProvider rendering, user:', user);

    return (
        <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
