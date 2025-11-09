// ========== CONFIGURACIÓN FIREBASE PARA CESPSIC ==========
// Este archivo se configura automáticamente desde config.js
// NO modifiques este archivo directamente, usa config.js para cambiar ambientes

// Importar configuración de ambientes
import { CONFIG } from './config.js';

// Usar la configuración del ambiente activo
const firebaseConfig = CONFIG.FIREBASE_CONFIG;

// ========== IMPORTAR MÓDULOS DE FIREBASE (CDN) ==========
// Usamos la versión 10.7.1 que es estable y compatible

// Firebase App (Core)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';

// Firestore Database
import { 
  getFirestore,           // Obtener instancia de Firestore
  collection,             // Referencia a colección
  addDoc,                 // Agregar documento nuevo
  setDoc,                 // ← Agregar
  doc,                    // Referencia a documento específico
  getDoc,                 // Obtener un documento
  getDocs,                // Obtener múltiples documentos
  query,                  // Crear consulta
  where,                  // Filtro condicional
  orderBy,                // Ordenar resultados
  serverTimestamp,        // Timestamp del servidor (recomendado)
  updateDoc,              // Actualizar documento existente
  deleteField,            // Eliminar campo de documento
  increment               // Incrementar valor numérico
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Authentication
import { 
  getAuth,                // Obtener instancia de Auth
  signInWithPopup,        // Login con popup
  GoogleAuthProvider,     // Proveedor de Google
  signOut as firebaseSignOut  // Cerrar sesión (renombrado para evitar conflictos)
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// ========== INICIALIZAR FIREBASE ==========
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);     // Base de datos Firestore
const auth = getAuth(app);        // Servicio de autenticación

// ========== LOGS DE CONFIRMACIÓN ==========
console.log('🔥 Firebase inicializado correctamente');
console.log('📊 Proyecto:', firebaseConfig.projectId);
console.log('🔐 Auth Domain:', firebaseConfig.authDomain);
console.log('🗄️ Firestore Database: Conectado');
console.log('✅ Listo para usar');

// ========== EXPORTAR TODO PARA USAR EN OTROS ARCHIVOS ==========
export { 
  // Instancias principales
  db,                    // Base de datos Firestore
  auth,                  // Servicio de autenticación
  
  // Funciones de Firestore
  collection,            // collection(db, 'asistencias')
  addDoc,                // addDoc(collection(db, 'asistencias'), data)
  setDoc,                // ← AGREGAR ESTA LÍNEA
  doc,                   // doc(db, 'asistencias', 'id')
  getDoc,                // getDoc(docRef)
  getDocs,               // getDocs(querySnapshot)
  query,                 // query(collectionRef, where(...), orderBy(...))
  where,                 // where('email', '==', 'user@email.com')
  orderBy,               // orderBy('timestamp', 'desc')
  serverTimestamp,       // timestamp: serverTimestamp()
  updateDoc,             // updateDoc(docRef, { campo: valor })
  deleteField,           // campo: deleteField()
  increment,             // contador: increment(1)
  
  // Funciones de autenticación
  signInWithPopup,       // signInWithPopup(auth, provider)
  GoogleAuthProvider,    // new GoogleAuthProvider()
  firebaseSignOut        // firebaseSignOut(auth)
};
