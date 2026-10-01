import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  serverTimestamp,
  Firestore 
} from 'firebase/firestore';
import firebaseConfigData from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: firebaseConfigData.apiKey,
  authDomain: firebaseConfigData.authDomain,
  projectId: firebaseConfigData.projectId,
  storageBucket: firebaseConfigData.storageBucket,
  messagingSenderId: firebaseConfigData.messagingSenderId,
  appId: firebaseConfigData.appId
};

// Initialize Firebase App singleton
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Firestore with specific database ID if present
const databaseId = firebaseConfigData.firestoreDatabaseId && firebaseConfigData.firestoreDatabaseId !== '(default)'
  ? firebaseConfigData.firestoreDatabaseId
  : undefined;

export const db: Firestore = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

// Authentication Helpers
export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;

  // Persist / update user profile in Firestore
  try {
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || 'Creator',
      photoURL: user.photoURL || '',
      lastLogin: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.warn('Failed to sync user profile to Firestore:', err);
  }

  return user;
}

export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// User Creation / Asset Persistence
export interface UserCreationItem {
  id?: string;
  type: 'video' | 'music' | 'transcription' | 'chat';
  title: string;
  prompt: string;
  model: string;
  resultUrl?: string;
  textContent?: string;
  metadata?: Record<string, any>;
  createdAt?: any;
}

export async function saveUserCreation(userId: string, creation: Omit<UserCreationItem, 'id' | 'createdAt'>): Promise<string> {
  const creationsRef = collection(db, 'users', userId, 'creations');
  const docRef = await addDoc(creationsRef, {
    userId,
    ...creation,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

export async function fetchUserCreations(userId: string): Promise<UserCreationItem[]> {
  try {
    const creationsRef = collection(db, 'users', userId, 'creations');
    const q = query(creationsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as UserCreationItem[];
  } catch (err) {
    console.error('Error fetching user creations from Firestore:', err);
    return [];
  }
}
