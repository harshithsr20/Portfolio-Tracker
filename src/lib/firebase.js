import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyACfTVQm-KEMJMaDP8V_6F9a6WagzGx5cA",
  authDomain: "portfolio-tracker-626aa.firebaseapp.com",
  projectId: "portfolio-tracker-626aa",
  storageBucket: "portfolio-tracker-626aa.firebasestorage.app",
  messagingSenderId: "252878399418",
  appId: "1:252878399418:web:d9105e03d77f476187df83",
  measurementId: "G-ZCJFZH6K0B"
};

const isConfigValid = firebaseConfig.apiKey !== "YOUR_API_KEY";

export const app = isConfigValid ? initializeApp(firebaseConfig) : null;
export const auth = isConfigValid ? getAuth(app) : null;
export const db = isConfigValid ? getFirestore(app) : null;

const provider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  if (!auth) throw new Error("Firebase is not initialized with a valid config.");
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google:", error);
    throw error;
  }
};

export const logoutUser = async () => {
  if (!auth) return;
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
};
