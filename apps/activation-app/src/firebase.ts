import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDROGIMLjMBsoDciZJDO3Qfrv_zD6MN6Co",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "fivetran-fivetran-248-war-mraw.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "fivetran-fivetran-248-war-mraw",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "fivetran-fivetran-248-war-mraw.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "81810785507",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:81810785507:web:26ef0783a067259f1471d6",
};

const app = initializeApp(firebaseConfig);
// Use the named "activation-demo" database (not default, which is Datastore Mode)
export const db = getFirestore(app, "activation-demo");
