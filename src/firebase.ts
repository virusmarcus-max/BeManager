import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyCC7vC6WQW6g3bqG7AaTllGBEHN7FcO-S0",
    authDomain: "bemanager-733d7.firebaseapp.com",
    projectId: "bemanager-733d7",
    storageBucket: "bemanager-733d7.firebasestorage.app",
    messagingSenderId: "629180584818",
    appId: "1:629180584818:web:e27f0720f0a6d99ad803eb",
    measurementId: "G-6M7GSPC4PM"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const analytics = getAnalytics(app);
