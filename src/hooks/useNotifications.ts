
import { useEffect, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import type { Task } from '../types';

export const useNotifications = () => {
    const { tasks, isLoaded } = useStore();
    const { user } = useAuth();

    // Store IDs of tasks we've already seen or notified about
    const processedTaskIds = useRef<Set<string>>(new Set());
    // Track if it's the first load to avoid spamming existing tasks
    const isFirstLoad = useRef(true);

    useEffect(() => {
        // Request permission on mount if default
        if ('Notification' in window) {
            if (Notification.permission === 'default') {
                // We cannot request permission automatically in all browsers without user interaction.
                // But we can try, or rely on a UI button. 
                // For now, let's keep it here but we might need a button in UI.
                Notification.requestPermission().catch(() => { });
            }
        }
    }, []);

    useEffect(() => {
        if (!user || !tasks || !isLoaded) return;

        // On first load, just mark all current tasks as processed so we don't notify for them
        if (isFirstLoad.current) {
            tasks.forEach(task => processedTaskIds.current.add(task.id));
            isFirstLoad.current = false;
            return;
        }

        // Check for new tasks
        tasks.forEach(task => {
            if (processedTaskIds.current.has(task.id)) return;

            // Mark as processed immediately
            processedTaskIds.current.add(task.id);

            // Filter logic: Is this task relevant to the user?
            // 1. If I am a Manager, is it for my store?
            // 2. If it's a future task, maybe notify anyway so they know it's coming? 
            //    Actually, user asked to notify when a new task is ADDED.
            const isRelevant =
                user.role === 'admin' || // Admins/Supervisors see everything
                task.targetStores === 'all' ||
                (user.establishmentId && task.targetStores.includes(user.establishmentId));

            if (isRelevant) {
                sendNotification(task);
            }
        });
    }, [tasks, user]);

    const sendNotification = (task: Task) => {
        if (!('Notification' in window)) return;

        if (Notification.permission === 'granted') {
            // Play a subtle sound
            try {
                // Audio logic here
            } catch (e) { }

            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.ready.then(registration => {
                    registration.showNotification('Nueva Tarea Asignada', {
                        body: `${task.title} \n${task.priority ? `Prioridad: ${task.priority.toUpperCase()}` : ''} `,
                        icon: '/vite.svg',
                        tag: task.id,
                        // @ts-ignore
                        renotify: true,
                        requireInteraction: true,
                        actions: [{ action: 'open', title: 'Ver Tarea' }, { action: 'close', title: 'Cerrar' }],
                        data: { url: '/tasks', taskId: task.id }
                    });
                });
            } else {
                const notif = new Notification('Nueva Tarea Asignada', {
                    body: `${task.title} \n${task.priority ? `Prioridad: ${task.priority.toUpperCase()}` : ''} `,
                    icon: '/vite.svg', // Fallback to standard favicon if specific icon missing
                    tag: task.id // Prevent duplicate notifications for same task
                });
                notif.onclick = () => {
                    window.focus();
                    notif.close();
                };
            }
        }
    };
};
