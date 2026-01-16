import type { StoreSettings } from '../types';

const STORAGE_KEY = 'hour_ia_store_settings';

const DEFAULT_SETTINGS: Omit<StoreSettings, 'establishmentId'> = {
    storeName: 'Mi Tienda',
    managerName: '',
    contactEmail: '',
    holidays: [],
    openSundays: [],
    openingHours: {
        morningStart: '10:00',
        morningEnd: '14:00',
        afternoonStart: '17:00',
        afternoonEnd: '21:00'
    }
};

export const DEFAULT_STORE_NAMES: Record<string, string> = {
    '1': 'Sevilla 1',
    '2': 'Sevilla 2'
};

export const getStoreSettings = (establishmentId: string): StoreSettings => {
    try {
        const storedData = localStorage.getItem(STORAGE_KEY);
        if (storedData) {
            const allSettings = JSON.parse(storedData);
            // If we have settings for this specific establishment, return them merged with defaults
            if (allSettings[establishmentId]) {
                return {
                    ...DEFAULT_SETTINGS,
                    ...allSettings[establishmentId],
                    establishmentId
                };
            }
        }
    } catch (error) {
        console.error('Error loading store settings:', error);
    }

    // Return defaults if no custom settings found
    // Return defaults if no custom settings found
    return {
        ...DEFAULT_SETTINGS,
        establishmentId,
        storeName: DEFAULT_STORE_NAMES[establishmentId] || DEFAULT_SETTINGS.storeName
    };
};

export const saveStoreSettings = (settings: StoreSettings): void => {
    try {
        const storedData = localStorage.getItem(STORAGE_KEY);
        const allSettings = storedData ? JSON.parse(storedData) : {};

        allSettings[settings.establishmentId] = settings;

        localStorage.setItem(STORAGE_KEY, JSON.stringify(allSettings));
    } catch (error) {
        console.error('Error saving store settings:', error);
    }
};
