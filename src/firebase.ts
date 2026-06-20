import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyC7-HVT813wCqylToObDmSVB9UapJGkQmE",
  authDomain: "gen-lang-client-0188617279.firebaseapp.com",
  projectId: "gen-lang-client-0188617279",
  storageBucket: "gen-lang-client-0188617279.firebasestorage.app",
  messagingSenderId: "771365099722",
  appId: "1:771365099722:web:6255633754c5501e1b7c33"
};

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Firestore with the exact Database ID from configuration
export const db = initializeFirestore(app, {}, "ai-studio-9d647ece-b3a7-4633-8e1b-43cb8a85dd4c");

// Initialize Auth
export const auth = getAuth(app);

// Test connection on boot
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase connected successfully.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. Client is offline.");
    } else {
      console.log("Firebase connection response (non-blocking):", error);
    }
  }
}

testConnection();
