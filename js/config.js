// ========== CONFIGURACIÓN DE AMBIENTES - CESPSIC ASISTENCIAS ==========
// Este archivo contiene las configuraciones para los ambientes de PRUEBAS y PRODUCCIÓN
// IMPORTANTE: Solo cambia la variable AMBIENTE_ACTUAL para cambiar entre ambientes

// 🎯 SELECCIONAR AMBIENTE (solo cambia esta variable)
// Valores permitidos: 'PRUEBAS' o 'PRODUCCION'
const AMBIENTE_ACTUAL = 'PRODUCCION';  // 👈 Cambia aquí entre 'PRUEBAS' o 'PRODUCCION'

// ========== CONFIGURACIÓN DE AMBIENTES ==========
const AMBIENTES = {
  PRUEBAS: {
    nombre: 'PRUEBAS',
    // Google Sheets
    SHEET_ID: '1YLmEuA-O3Vc1fWRQ1nC_BojOUSVmzBb8QxCCsb5tQwk',
    EVIDENCIAS_FOLDER_ID: '1tt6yqPycpYT9My16frwjo_c0auz8Du_g',
    
    // Google Apps Script URL (Backend)
    GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbw10UgiYsuGYi16MisVfk7fx-wlGU-gUmCKTz2bZmyqys_2ku1ghZ9zzv71UncZ_sXlDg/exec',
    
    // Firebase
    FIREBASE_CONFIG: {
      apiKey: "AIzaSyBINCTkXd77-SKnCAlcT1wU6d-kpEkEAHs",
      authDomain: "cespsic-asistencias.firebaseapp.com",
      projectId: "cespsic-asistencias",
      storageBucket: "cespsic-asistencias.firebasestorage.app",
      messagingSenderId: "249910813853",
      appId: "1:249910813853:web:f0764208f9db7727046074",
      measurementId: "G-TXEEEQGY1X"
    }
  },
  
  PRODUCCION: {
    nombre: 'PRODUCCIÓN',
    // Google Sheets
    SHEET_ID: '146Q1MG0AUCnzacqrN5kBENRuiql8o07Uts-l_gimL2I',
    EVIDENCIAS_FOLDER_ID: '1YMp3S1Ybzuusav_2Z7tWzZ0hG2_c_5Wc',
    
    // Google Apps Script URL (Backend)
    GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyllBO0vTORygvLlbTeRWfNXz1_Dt1khrM2z_BUxbNM6jWqEGYDqaLnd7LJs9Fl9Q9X/exec',
    
    // Firebase (misma configuración que pruebas, mismo proyecto)
    FIREBASE_CONFIG: {
      apiKey: "AIzaSyCcCqZ98oBrV1DrPjE6kYii6rOc2G_fiqI",
      authDomain: "cespsic-asistencias-a2445.firebaseapp.com",
      projectId: "cespsic-asistencias-a2445",
      storageBucket: "cespsic-asistencias-a2445.firebasestorage.app",
      messagingSenderId: "665878809773",
      appId: "1:665878809773:web:fdddaa550a5ae402844a24",
      measurementId: "G-PJWN1NQCPX"
    }
  }
};

// ========== OBTENER CONFIGURACIÓN ACTIVA ==========
function getConfigActual() {
  if (!AMBIENTES[AMBIENTE_ACTUAL]) {
    console.error(`❌ ERROR: Ambiente "${AMBIENTE_ACTUAL}" no existe. Usa 'PRUEBAS' o 'PRODUCCION'`);
    return AMBIENTES.PRUEBAS; // Fallback a PRUEBAS por seguridad
  }
  return AMBIENTES[AMBIENTE_ACTUAL];
}

// ========== EXPORTAR CONFIGURACIÓN ==========
const CONFIG = getConfigActual();

// Logs de confirmación
console.log('='.repeat(70));
console.log('🔧 CONFIGURACIÓN CARGADA');
console.log('='.repeat(70));
console.log(`🎯 Ambiente Activo: ${CONFIG.nombre}`);
console.log(`📊 Sheet ID: ${CONFIG.SHEET_ID.substring(0, 20)}...`);
console.log(`🔥 Firebase Project: ${CONFIG.FIREBASE_CONFIG.projectId}`);
console.log(`📍 Google Script: ${CONFIG.GOOGLE_SCRIPT_URL.substring(0, 50)}...`);
console.log('='.repeat(70));

// Exportar para uso en otros archivos
export { CONFIG, AMBIENTE_ACTUAL };
