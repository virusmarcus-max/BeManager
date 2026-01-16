import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types';
import { auth } from '../firebase';
import { onAuthStateChanged, signOut, setPersistence, browserSessionPersistence } from 'firebase/auth';

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
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Set persistence to session mainly
        setPersistence(auth, browserSessionPersistence)
            .then(() => {
                const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
                    if (firebaseUser) {
                        // Map Firebase User to our App User
                        // We will store custom claims or just map by email for now
                        const email = firebaseUser.email || '';
                        let establishmentId = '';

                        // MAPPING LOGIC (Temporary until custom claims)
                        if (email.includes('tienda1')) establishmentId = '1';
                        else if (email.includes('tienda2')) establishmentId = '2';
                        else if (email.includes('malaga2')) establishmentId = '3';
                        else if (email.includes('cordoba')) establishmentId = '4';
                        else if (email.includes('jerez')) establishmentId = '5';
                        else if (email.includes('malaga1')) establishmentId = '6';
                        else if (email.includes('granada')) establishmentId = '7';
                        else if (email.includes('admin')) establishmentId = 'super';

                        const foundUser = MANAGERS.find(u => u.establishmentId === establishmentId);
                        setUser(foundUser || {
                            id: firebaseUser.uid,
                            name: firebaseUser.displayName || 'Usuario',
                            role: 'manager',
                            establishmentId,
                            establishmentName: 'Tienda ' + establishmentId
                        });
                    } else {
                        setUser(null);
                    }
                    setIsLoading(false);
                });
                return () => unsubscribe();
            })
            .catch((error) => {
                console.error("Auth Persistence Error:", error);
                setIsLoading(false);
            });
    }, []);

    const login = async (_establishmentId: string) => {
        // This is now purely for interface compat, actual login happens in Login.tsx
        console.warn("Login should be handled by firebase signInWithEmailAndPassword in Login Page");
    };

    const logout = async () => {
        await signOut(auth);
        setUser(null);
        localStorage.removeItem('saas_schedule_user');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
            {!isLoading && children}
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
