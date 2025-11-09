// ========== CESPSIC - SISTEMA DE ASISTENCIAS CON FIREBASE ==========
// Versión: 2.0 Firebase
// Mantiene Google Drive para evidencias fotográficas
// Usa Firebase Firestore para datos de asistencias

// ========== IMPORTS DE FIREBASE ==========
import { 
  db, 
  auth, 
  collection, 
  addDoc, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  signInWithPopup, 
  GoogleAuthProvider, 
  firebaseSignOut 
} from './firebase-config.js';

// ========================================================================================================
// 📊 IMPORTAR SISTEMA DE LOGS Y AUDITORÍA
// ========================================================================================================
import { 
  guardarAsistenciaConLogs,
  verificarDuplicado,
  registrarIntentoRecibido,
  registrarIntentoFallido,
  registrarAuditoria,
  obtenerEstadisticasLogs
} from './firebase-logger.js';

console.log('📊 Sistema de logs Firebase: CARGADO');
// ========================================================================================================
// 🔧 CONFIGURACIÓN - Importada desde config.js
// ========================================================================================================
import { CONFIG, AMBIENTE_ACTUAL } from './config.js';

// URL del backend de Google Apps Script (para evidencias en Drive)
const GOOGLE_SCRIPT_URL = CONFIG.GOOGLE_SCRIPT_URL;

// Logs de confirmación
console.log('='.repeat(70));
console.log('🔧 CONFIGURACIÓN FRONTEND CARGADA');
console.log('='.repeat(70));
console.log('🎯 Ambiente Activo:', AMBIENTE_ACTUAL);
console.log('📍 Google Script URL:', GOOGLE_SCRIPT_URL.substring(0, 50) + '...');
console.log('🔥 Firebase Project:', CONFIG.FIREBASE_CONFIG.projectId);
console.log('='.repeat(70));

// ========== DETECCIÓN DE DISPOSITIVO ==========
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || 
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

function detectDesktop() {
    const ua = navigator.userAgent.toLowerCase();
    const isWindows = /windows nt/.test(ua);
    const isMacOS = /macintosh|mac os x/.test(ua) && navigator.maxTouchPoints <= 1;
    const isLinux = /linux/.test(ua) && !/android/.test(ua);
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
    return (isWindows || isMacOS || isLinux) && !isMobile;
}

function getDeviceType() {
    const ua = navigator.userAgent.toLowerCase();
    if (/android/.test(ua)) return 'Android';
    if (/iphone|ipod/.test(ua)) return 'iPhone';
    if (/ipad/.test(ua)) return 'iPad';
    if (/windows phone/.test(ua)) return 'Windows Phone';
    if (/windows nt/.test(ua)) return 'Windows Desktop';
    if (/macintosh|mac os x/.test(ua) && navigator.maxTouchPoints <= 1) return 'macOS Desktop';
    if (/linux/.test(ua) && !/android/.test(ua)) return 'Linux Desktop';
    if (navigator.maxTouchPoints > 0) return 'Tablet/Touch Device';
    return 'Desktop/Laptop';
}

const isDesktop = detectDesktop();
const deviceType = getDeviceType();

// ========== VARIABLES GLOBALES ==========
let currentLocation = null;
let currentUser = null;
let isAuthenticated = false;
let locationValid = false;
let locationAttempts = 0;
let selectedFiles = [];

const REQUIRED_ACCURACY = isDesktop ? 1000 : 50;
const REQUIRED_ACCURACY_OPTIMAL = isDesktop ? 300 : 30;
const MAX_LOCATION_ATTEMPTS = 3;
const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const ubicacionesUAS = [
    { name: "CESPSIC - Centro de Servicios Psicológicos", lat: 24.8278, lng: -107.3812, radius: 50 },
    { name: "Facultad de Psicología UAS", lat: 24.7993, lng: -107.3950, radius: 100 },
    { name: "Universidad Autónoma de Sinaloa - Campus Central", lat: 24.7990, lng: -107.3950, radius: 200 }
];

console.log(`📱 Dispositivo: ${deviceType}`);
console.log(`💻 Es Desktop: ${isDesktop ? 'Sí' : 'No'}`);
console.log(`📱 Es iOS: ${isIOS ? 'Sí' : 'No'}`);
console.log(`🌐 Navegador: ${isSafari ? 'Safari' : 'Otro'}`);
console.log(`🔥 Firebase: Conectado`);

// ========== FUNCIÓN: Información del Dispositivo ==========
function getDeviceInfo() {
    return {
        type: deviceType,
        isDesktop: isDesktop,
        isMobile: !isDesktop,
        isIOS: isIOS,
        isSafari: isSafari,
        userAgent: navigator.userAgent,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        touchPoints: navigator.maxTouchPoints || 0,
        requiredAccuracy: REQUIRED_ACCURACY,
        optimalAccuracy: REQUIRED_ACCURACY_OPTIMAL
    };
}

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== INFORMACIÓN DEL DISPOSITIVO ===');
    console.log('Tipo:', deviceType);
    console.log('Es Desktop:', isDesktop);
    console.log('Precisión requerida:', REQUIRED_ACCURACY + 'm');
    console.log('Precisión óptima:', REQUIRED_ACCURACY_OPTIMAL + 'm');
    
    if (isDesktop) {
        console.log('⚠️ MODO DESKTOP ACTIVADO');
        console.log('   Los ordenadores no tienen GPS integrado.');
        console.log('   La ubicación se obtiene por IP/WiFi (menor precisión).');
        console.log('   Precisión aceptada: hasta ' + REQUIRED_ACCURACY + 'm');
        showDesktopWarning();
    }
    
    if (isIOS) {
        console.log('🎯 Modo iOS activado - Aplicando compatibilidad especial');
    }
    
    initializeForm();
    setupEventListeners();
    setupEvidenciasHandlers();
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
});

function initializeForm() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    document.getElementById('fecha').value = `${year}-${month}-${day}`;
    updateCurrentTime();
}

function updateCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('hora').value = `${hours}:${minutes}`;
}

function showDesktopWarning() {
    const authSection = document.getElementById('auth-section');
    let desktopWarning = document.getElementById('desktop-warning');
    
    if (!desktopWarning) {
        desktopWarning = document.createElement('div');
        desktopWarning.id = 'desktop-warning';
        desktopWarning.style.cssText = `
            background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
            border: 2px solid #ffc107;
            border-radius: 10px;
            padding: 15px;
            margin-top: 15px;
            color: #856404;
            font-size: 14px;
            line-height: 1.6;
        `;
        desktopWarning.innerHTML = `
            <strong>💻 Dispositivo Desktop Detectado (${deviceType})</strong><br>
            Los ordenadores no tienen GPS integrado y usan ubicación por IP/WiFi.<br>
            <strong>Precisión esperada:</strong> 100-1000 metros (vs 5-50m en móviles)<br>
            ℹ️ El sistema aceptará precisiones de hasta ${REQUIRED_ACCURACY} metros.
        `;
        authSection.appendChild(desktopWarning);
    }
}

// ========== AUTENTICACIÓN CON FIREBASE ==========
async function requestAuthentication() {
    try {
        console.log('🔐 Iniciando autenticación con Firebase...');
        
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({
            prompt: 'select_account'
        });
        
        const result = await signInWithPopup(auth, provider);
        
        // Obtener el Google User ID real del proveedor de Google
        const googleUserID = result.user.providerData.find(p => p.providerId === 'google.com')?.uid || result.user.uid;
        
        currentUser = {
            id: googleUserID,                    // ✅ Google User ID real
            email: result.user.email,
            name: result.user.displayName,
            picture: result.user.photoURL
        };
        
        console.log('🆔 Google User ID:', googleUserID);
        
        isAuthenticated = true;
        document.getElementById('email').value = currentUser.email;
        document.getElementById('google_user_id').value = currentUser.id;
        
        updateAuthenticationUI();
        enableForm();
        getCurrentLocation();
        
        // Cargar registros del día
        setTimeout(() => mostrarRegistrosDelDia(), 2000);
        
        showStatus(`✅ ¡Bienvenido ${currentUser.name}!`, 'success');
        setTimeout(() => hideStatus(), 3000);
        
        console.log('✅ Autenticación exitosa:', currentUser.email);
        
    } catch (error) {
        console.error('❌ Error en autenticación:', error);
        showStatus('Error en la autenticación: ' + error.message, 'error');
    }
}

function updateAuthenticationUI() {
    const authSection = document.getElementById('auth-section');
    const authTitle = document.getElementById('auth-title');
    const userInfo = document.getElementById('user-info');
    const signinContainer = document.getElementById('signin-button-container');

    if (isAuthenticated && currentUser) {
        authSection.classList.add('authenticated');
        authTitle.textContent = '✅ Autenticación Exitosa';
        authTitle.classList.add('authenticated');
        
        document.getElementById('user-avatar').src = currentUser.picture;
        document.getElementById('user-email').textContent = currentUser.email;
        document.getElementById('user-name').textContent = currentUser.name;
        userInfo.classList.add('show');
        signinContainer.style.display = 'none';
    } else {
        authSection.classList.remove('authenticated');
        authTitle.textContent = '🔒 Autenticación Requerida';
        authTitle.classList.remove('authenticated');
        userInfo.classList.remove('show');
        signinContainer.style.display = 'block';
    }
}

function enableForm() {
    document.getElementById('form-container').classList.add('authenticated');
    hideStatus(); // Limpiar cualquier mensaje de error previo
}

function disableForm() {
    document.getElementById('form-container').classList.remove('authenticated');
    locationValid = false;
    updateSubmitButton();
}

async function signOut() {
    try {
        await firebaseSignOut(auth);
        
        isAuthenticated = false;
        currentUser = null;
        locationValid = false;
        currentLocation = null;
        selectedFiles = [];
        
        ['email', 'google_user_id', 'latitude', 'longitude', 'location_status'].forEach(id => {
            document.getElementById(id).value = '';
        });
        
        updateAuthenticationUI();
        disableForm();
        resetLocationFields();
        resetEvidenciasSection();
        ocultarRegistrosDelDia();
        
        showStatus('Sesión cerrada correctamente.', 'success');
        setTimeout(() => hideStatus(), 3000);
        
        console.log('✅ Sesión cerrada');
    } catch (error) {
        console.error('Error cerrando sesión:', error);
        showStatus('Error al cerrar sesión.', 'error');
    }
}

// ========== GUARDAR ASISTENCIA EN FIRESTORE ==========
async function handleSubmit(e) {
    e.preventDefault();
    
    console.log('\n' + '='.repeat(70));
    console.log('🔥 GUARDANDO EN FIREBASE FIRESTORE');
    console.log('='.repeat(70));
    
    // Validaciones
    if (!isAuthenticated || !currentUser) {
        showStatus('❌ Debe autenticarse con Google', 'error');
        return;
    }
    
    if (!locationValid || !currentLocation) {
        showStatus('❌ Ubicación GPS requerida', 'error');
        return;
    }
    
    if (currentLocation.accuracy > REQUIRED_ACCURACY) {
        showStatus(`❌ Precisión GPS insuficiente: ${Math.round(currentLocation.accuracy)}m`, 'error');
        return;
    }
    
    if (!validateConditionalFields()) {
        return;
    }
    
    const submitBtn = document.querySelector('.submit-btn');
    const originalText = submitBtn.textContent;
    
    // Deshabilitar botón inmediatamente
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.6';
    submitBtn.style.cursor = 'not-allowed';
    submitBtn.textContent = '⏳ Guardando, espere...';
    
    try {
        // 1. Subir evidencias a Google Drive
        console.log('📸 Procesando evidencias...');
        submitBtn.textContent = '📤 Subiendo evidencias a Drive...';
        const evidenciasUrls = await uploadEvidenciasToGoogleDrive();
        
        // 2. Preparar datos
        const registroID = generateRegistroID();
        const formData = new FormData(e.target);
        
        const asistenciaData = {
            // IDs y timestamps
            registro_id: registroID,
            timestamp: serverTimestamp(),
            fecha_creacion: new Date().toISOString(),
            
            // Usuario
            email: currentUser.email,
            google_user_id: currentUser.id,
            authenticated_user_name: currentUser.name,
            
            // Datos personales
            nombre: formData.get('nombre'),
            apellido_paterno: formData.get('apellido_paterno'),
            apellido_materno: formData.get('apellido_materno'),
            nombre_completo: `${formData.get('nombre')} ${formData.get('apellido_paterno')} ${formData.get('apellido_materno')}`,
            
            // Tipo de estudiante
            tipo_estudiante: formData.get('tipo_estudiante'),
            modalidad: formData.get('modalidad'),
            
            // Registro
            fecha: formData.get('fecha'),
            hora: formData.get('hora'),
            tipo_registro: formData.get('tipo_registro'),
            permiso_detalle: formData.get('permiso_detalle') || '',
            otro_detalle: formData.get('otro_detalle') || '',
            
            // Ubicación
            ubicacion: {
                lat: currentLocation.latitude,
                lng: currentLocation.longitude,
                accuracy: currentLocation.accuracy,
                direccion: formData.get('direccion_completa'),
                lugar: formData.get('ubicacion_detectada'),
                precision_metros: Math.round(currentLocation.accuracy)
            },
            
            // Evidencias
            evidencias: evidenciasUrls,
            total_evidencias: evidenciasUrls.filter(e => e.uploadStatus === 'SUCCESS').length,
            carpeta_evidencias: generateStudentFolderName(),
            
            // Actividades (si es salida)
            intervenciones_psicologicas: parseInt(formData.get('intervenciones_psicologicas')) || 0,
            grupos_edad: {
                ninos_ninas: parseInt(formData.get('ninos_ninas')) || 0,
                adolescentes: parseInt(formData.get('adolescentes')) || 0,
                adultos: parseInt(formData.get('adultos')) || 0,
                mayores_60: parseInt(formData.get('mayores_60')) || 0,
                familia: parseInt(formData.get('familia')) || 0
            },
            actividades: formData.getAll('actividades[]') || [],
            actividades_varias_texto: formData.get('actividades_varias_texto') || '',
            pruebas_psicologicas_texto: formData.get('pruebas_psicologicas_texto') || '',
            comentarios_adicionales: formData.get('comentarios_adicionales') || '',
            
            // Metadata
            device_type: deviceType,
            is_desktop: isDesktop,
            gps_method: isDesktop ? 'IP/WiFi' : 'GPS',
            required_accuracy: REQUIRED_ACCURACY,
            device_info: getDeviceInfo(),
            version: '2.0 Firebase'
        };
        
        console.log('📊 Datos preparados:', asistenciaData);
        
        // 3. 🔥 GUARDAR EN FIRESTORE CON SISTEMA DE LOGS COMPLETO
        submitBtn.textContent = '🔥 Guardando en Firebase...';
        console.log('🔥 Guardando en Firestore con logs y validaciones...');
        const resultado = await guardarAsistenciaConLogs(asistenciaData);
        
        console.log('✅✅✅ GUARDADO EXITOSO - Firestore ID:', resultado.docId);
        const docRef = { id: resultado.docId }; // Para compatibilidad con código existente
        
        // 4. Mostrar confirmación
        const hora = new Date().toLocaleTimeString('es-MX', {hour: '2-digit', minute: '2-digit'});
        
        showStatus(`✅✅✅ ASISTENCIA REGISTRADA

Registro ID: ${registroID}
Usuario: ${currentUser.name}
Modalidad: ${asistenciaData.modalidad}
Ubicación: ${asistenciaData.ubicacion.lugar}
Hora: ${hora}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Guardado instantáneo en Firebase
📊 Firestore Document ID: ${docRef.id}
⚡ Sin necesidad de verificación adicional
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'success');
        
        // 5. Actualizar registros del día
        setTimeout(() => mostrarRegistrosDelDia(), 1000);
        
        // 6. Rehabilitar botón completamente
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
        submitBtn.textContent = originalText;
        
        // 7. Preguntar si desea continuar
        setTimeout(() => {
            if (confirm(`✅ ASISTENCIA REGISTRADA CORRECTAMENTE\n\nRegistro ID: ${registroID}\nUsuario: ${currentUser.name}\nHora: ${hora}\n\n¿Desea registrar otra asistencia?`)) {
                resetFormOnly();
                getCurrentLocation();
                hideStatus();
            } else {
                hideStatus();
                signOut();
            }
        }, 5000);
        
    } catch (error) {
        console.error('❌ Error guardando en Firebase:', error);
        
        // Determinar si es error de duplicado
        const esDuplicado = error.message.includes('DUPLICADO');
        
        let mensajeError = '';
        
        if (esDuplicado) {
            // Error de duplicado - mensaje específico
            mensajeError = `⚠️ REGISTRO DUPLICADO
    
    ${error.message}
    
    Este registro ya fue guardado anteriormente.
    No es necesario volver a registrarlo.`;
        } else {
            // Otros errores
            mensajeError = `❌ ERROR: No se pudo guardar
    
    Error: ${error.message}
    
    Por favor:
    1. Verifique su conexión a Internet
    2. Verifique que todos los campos estén llenos correctamente
    3. Intente nuevamente
    
    Si el problema persiste, contacte al administrador.`;
        }
        
        showStatus(mensajeError, esDuplicado ? 'warning' : 'error');
        
        // Rehabilitar botón completamente
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
        submitBtn.textContent = originalText;
    }
}

function generateRegistroID() {
    const timestamp = new Date().getTime();
    const email = currentUser.email ? currentUser.email.substring(0, 10) : 'unknown';
    const random = Math.random().toString(36).substring(2, 10);
    const registroID = `REG_${timestamp}_${email}_${random}`.replace(/[^a-zA-Z0-9_]/g, '');
    
    console.log('📋 Registro ID generado:', registroID);
    return registroID;
}

// ========== SUBIR EVIDENCIAS A GOOGLE DRIVE ==========
async function uploadEvidenciasToGoogleDrive() {
    if (selectedFiles.length === 0) {
        console.log('ℹ️ No hay evidencias para subir');
        return [];
    }
    
    console.log(`📤 Subiendo ${selectedFiles.length} evidencia(s) a Google Drive...`);
    
    const tipoRegistro = document.getElementById('tipo_registro').value || 'sin_tipo';
    const evidenciasInfo = [];
    const erroresDetallados = [];
    
    showEvidenciasStatus('Subiendo a Google Drive...', 'loading');
    
    for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const fileName = generateEvidenciaFileName(tipoRegistro, i);
        const extension = file.name.split('.').pop();
        const fullFileName = `${fileName}.${extension}`;
        
        try {
            console.log(`📤 [${i+1}/${selectedFiles.length}] Procesando: ${file.name}`);
            showEvidenciasStatus(`Subiendo imagen ${i + 1}/${selectedFiles.length}: ${file.name}`, 'loading');
            
            if (!file || !file.type || file.size === 0) {
                throw new Error('Archivo inválido o corrupto');
            }
            
            // Convertir a Base64
            let base64Data;
            try {
                base64Data = await fileToBase64(file);
                console.log(`✅ Conversión Base64 exitosa: ${(base64Data.length/1024).toFixed(1)}KB`);
            } catch (b64Error) {
                console.error(`❌ Error en conversión Base64:`, b64Error);
                throw new Error(`Error al procesar la imagen: ${b64Error.message}`);
            }
            
            // Preparar datos para Google Apps Script (Drive)
            const uploadData = new URLSearchParams({
                action: 'uploadEvidencia',  // ⬅️ Cambiado de 'upload_evidencia' a 'uploadEvidencia'
                fileName: fullFileName,
                fileData: base64Data,
                mimeType: file.type,
                studentFolder: generateStudentFolderName(),
                userEmail: currentUser.email,
                timestamp: new Date().toISOString()
            });
            
            console.log(`🚀 Enviando archivo ${i + 1} a Google Drive: ${fullFileName}`);
            
            // Subir a Google Drive usando Google Apps Script existente
            const uploadResult = await Promise.race([
                fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    body: uploadData,
                    headers: {
                        'Accept': 'application/json'
                    }
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout: El servidor no respondió en 30 segundos')), 30000)
                )
            ]);
            
            if (!uploadResult.ok) {
                throw new Error(`Error HTTP ${uploadResult.status}: ${uploadResult.statusText}`);
            }
            
            let result;
            try {
                result = await uploadResult.json();
            } catch (jsonError) {
                console.error('❌ Error parseando respuesta JSON:', jsonError);
                throw new Error('Error del servidor: Respuesta inválida (no es JSON válido)');
            }
            
            console.log(`📋 Respuesta del servidor para ${fullFileName}:`, result);
            
            if (result.success) {
                evidenciasInfo.push({
                    fileName: fullFileName,
                    originalName: file.name,
                    size: file.size,
                    driveFileId: result.file_id || null,
                    uploadTime: new Date().toISOString(),
                    uploadStatus: 'SUCCESS',
                    storage: 'Google Drive'
                });
                
                console.log(`✅ Archivo ${i+1}/${selectedFiles.length} subido exitosamente a Drive: ${fullFileName}`);
                showEvidenciasStatus(`✅ Imagen ${i + 1}/${selectedFiles.length} subida correctamente`, 'success');
            } else {
                // Construir mensaje de error más específico del servidor
                const serverError = result.message || result.error || result.details || 'El servidor rechazó el archivo sin proporcionar detalles';
                throw new Error(`Error del servidor: ${serverError}`);
            }
            
        } catch (error) {
            console.error(`❌ Error subiendo archivo ${file.name}:`, error);
            console.error(`   Tipo de error: ${error.name}`);
            console.error(`   Mensaje: ${error.message}`);
            console.error(`   Stack:`, error.stack);
            
            // Construir mensaje de error detallado
            let errorDetalle = error.message || 'Error no especificado';
            
            // Detectar tipos específicos de error
            if (error.message && error.message.includes('Failed to fetch')) {
                errorDetalle = 'Error de conexión: No se pudo conectar con Google Drive. Verifique su internet o intente nuevamente.';
            } else if (error.message && error.message.includes('NetworkError')) {
                errorDetalle = 'Error de red: Problema de conectividad. Verifique su conexión a internet.';
            } else if (error.message && error.message.includes('Timeout')) {
                errorDetalle = 'Tiempo de espera agotado: El servidor tardó demasiado en responder (>30 seg). Intente con archivos más pequeños.';
            } else if (error.message && error.message.includes('Error HTTP')) {
                errorDetalle = error.message; // Ya tiene el formato correcto
            } else if (error.message && error.message.includes('Error del servidor')) {
                errorDetalle = error.message; // Mensaje del servidor de Google Drive
            } else if (error.message && error.message.includes('Archivo inválido')) {
                errorDetalle = 'Archivo inválido o corrupto. Verifique el archivo.';
            } else if (error.message && error.message.includes('Error al procesar la imagen')) {
                errorDetalle = error.message; // Error de conversión Base64
            } else if (error.name === 'TypeError') {
                errorDetalle = 'Error de tipo: El servidor no respondió correctamente. Puede ser un problema temporal. Intente nuevamente.';
            } else if (error.name === 'SyntaxError') {
                errorDetalle = 'Error de sintaxis: Respuesta inválida del servidor. Contacte al administrador.';
            } else if (!error.message || error.message === 'Error desconocido') {
                errorDetalle = 'Error no identificado: Verifique su conexión y el tamaño del archivo (<10MB). Si el problema persiste, intente con una conexión más estable.';
            }
            
            evidenciasInfo.push({
                fileName: fullFileName,
                originalName: file.name,
                size: file.size,
                uploadTime: new Date().toISOString(),
                uploadStatus: 'FAILED',
                error: errorDetalle,
                errorType: error.name || 'Error',
                storage: 'Google Drive'
            });
            
            erroresDetallados.push(`${file.name}: ${errorDetalle}`);
            
            showEvidenciasStatus(
                `⚠️ Error en ${file.name}: ${errorDetalle}`, 
                'warning'
            );
            
            // Esperar más tiempo después de un error para permitir recuperación
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        // Esperar entre archivos para evitar saturar el servidor
        if (i < selectedFiles.length - 1) {
            console.log(`⏳ Esperando 2 segundos antes del siguiente archivo...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    const successCount = evidenciasInfo.filter(e => e.uploadStatus === 'SUCCESS').length;
    const failCount = evidenciasInfo.filter(e => e.uploadStatus === 'FAILED').length;
    
    console.log(`\n📊 RESUMEN DE SUBIDA:`);
    console.log(`   ✅ Exitosas: ${successCount}`);
    console.log(`   ❌ Fallidas: ${failCount}`);
    console.log(`   📁 Total: ${evidenciasInfo.length}`);
    
    // CRÍTICO: Si hay alguna evidencia fallida, lanzar error para detener el guardado en Firebase
    if (failCount > 0) {
        const mensajeError = `❌ ERROR CRÍTICO: ${failCount} de ${evidenciasInfo.length} evidencias NO se pudieron subir a Google Drive:\n\n${erroresDetallados.join('\n')}\n\n⚠️ Debe corregir estos errores antes de guardar el registro en Firebase.`;
        showEvidenciasStatus(mensajeError, 'error');
        throw new Error(mensajeError);
    }
    
    if (successCount > 0) {
        showEvidenciasStatus(
            `✅ ${successCount} evidencia(s) subida(s) exitosamente a Google Drive`, 
            'success'
        );
    }
    
    return evidenciasInfo;
}

function generateEvidenciaFileName(tipoRegistro, index) {
    const apellidoPaterno = document.getElementById('apellido_paterno').value || 'Sin_Apellido';
    const apellidoMaterno = document.getElementById('apellido_materno').value || 'Sin_Apellido';
    const nombre = document.getElementById('nombre').value || 'Sin_Nombre';
    const fecha = new Date();
    
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const año = fecha.getFullYear();
    const hora = String(fecha.getHours()).padStart(2, '0');
    const minuto = String(fecha.getMinutes()).padStart(2, '0');
    const segundo = String(fecha.getSeconds()).padStart(2, '0');
    const consecutivo = String(index + 1).padStart(3, '0');
    
    const nombreLimpio = `${apellidoPaterno}_${apellidoMaterno}_${nombre}`.replace(/[^a-zA-Z0-9_]/g, '');
    const fechaFormateada = `${dia}_${mes}_${año}`;
    const horaFormateada = `${hora}_${minuto}_${segundo}`;
    
    return `${nombreLimpio}_${fechaFormateada}_${horaFormateada}_${tipoRegistro}_${consecutivo}`;
}

function generateStudentFolderName() {
    const apellidoPaterno = document.getElementById('apellido_paterno').value || 'Sin_Apellido';
    const apellidoMaterno = document.getElementById('apellido_materno').value || 'Sin_Apellido';
    const nombre = document.getElementById('nombre').value || 'Sin_Nombre';
    
    return `${apellidoPaterno}_${apellidoMaterno}_${nombre}`.replace(/[^a-zA-Z0-9_]/g, '');
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject(new Error('Archivo no válido'));
            return;
        }
        
        if (!file.type) {
            reject(new Error('Archivo sin tipo MIME'));
            return;
        }
        
        if (file.size === 0) {
            reject(new Error('Archivo vacío (0 bytes)'));
            return;
        }
        
        if (file.size > MAX_FILE_SIZE) {
            reject(new Error(`Archivo muy grande: ${(file.size/1024/1024).toFixed(1)}MB`));
            return;
        }
        
        console.log(`📄 Convirtiendo ${file.name} a Base64...`);
        
        const reader = new FileReader();
        
        reader.onload = () => {
            try {
                const result = reader.result;
                if (!result || typeof result !== 'string') {
                    reject(new Error('Error: resultado de lectura inválido'));
                    return;
                }
                
                const base64 = result.split(',')[1];
                if (!base64 || base64.length === 0) {
                    reject(new Error('Error: conversión Base64 falló'));
                    return;
                }
                
                console.log(`✅ Base64 generado: ${(base64.length/1024).toFixed(1)}KB`);
                resolve(base64);
            } catch (error) {
                console.error('❌ Error procesando Base64:', error);
                reject(new Error(`Error al procesar: ${error.message}`));
            }
        };
        
        reader.onerror = (error) => {
            console.error('❌ Error leyendo archivo:', error);
            reject(new Error(`Error al leer archivo: ${file.name}`));
        };
        
        reader.onabort = () => {
            console.error('❌ Lectura abortada');
            reject(new Error('Lectura de archivo abortada'));
        };
        
        try {
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('❌ Error iniciando lectura:', error);
            reject(new Error(`No se pudo leer el archivo: ${error.message}`));
        }
    });
}

// ========== OBTENER REGISTROS DEL DÍA DESDE FIRESTORE ==========
async function mostrarRegistrosDelDia() {
    const registrosSection = document.getElementById('registros-section');
    const registrosLista = document.getElementById('registros-lista');
    const registrosCount = document.getElementById('registros-count');
    
    if (!registrosSection || !registrosLista) {
        console.warn('⚠️ Sección de registros no encontrada');
        return;
    }
    
    if (!isAuthenticated || !currentUser) {
        console.warn('⚠️ Usuario no autenticado');
        return;
    }
    
    // Mostrar loading
    registrosSection.style.display = 'block';
    registrosLista.innerHTML = '<div class="registro-loading">📊 Cargando registros desde Firebase...</div>';
    registrosCount.textContent = 'Cargando...';
    registrosCount.style.background = '#6c757d';
    
    try {
        // Obtener fecha de hoy
        const hoy = new Date();
        const año = hoy.getFullYear();
        const mes = String(hoy.getMonth() + 1).padStart(2, '0');
        const dia = String(hoy.getDate()).padStart(2, '0');
        const fechaHoy = `${año}-${mes}-${dia}`;
        
        console.log('📊 Cargando registros de:', fechaHoy, 'para:', currentUser.email);
        
        // Query a Firestore
        const q = query(
            collection(db, 'asistencias'),
            where('email', '==', currentUser.email),
            where('fecha', '==', fechaHoy)
        );
        
        const querySnapshot = await getDocs(q);
        const registros = [];
        
        querySnapshot.forEach((documento) => {
            const data = documento.data();
            registros.push({
                id: documento.id,
                ...data
            });
        });
        
        // Ordenar en el cliente
        registros.sort((a, b) => {
            const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp).getTime();
            const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp).getTime();
            return timeB - timeA; // Descendente (más reciente primero)
        });
        
        console.log(`✅ ${registros.length} registro(s) encontrado(s)`);
        
        // Mostrar registros
        if (registros.length === 0) {
            registrosLista.innerHTML = `
                <div class="registro-vacio">
                    <div style="font-size: 2em; margin-bottom: 10px;">📝</div>
                    <div><strong>No hay registros para hoy</strong></div>
                    <div style="font-size: 0.9em; color: #666; margin-top: 5px;">
                        Cuando registre su primera asistencia aparecerá aquí
                    </div>
                </div>
            `;
            registrosCount.textContent = '0 registros';
            registrosCount.style.background = '#6c757d';
            return;
        }
        
        registrosCount.textContent = `${registros.length} registro${registros.length !== 1 ? 's' : ''}`;
        registrosCount.style.background = '#667eea';
        
        let html = '';
        registros.forEach((reg, index) => {
            const tipoIcon = {
                'entrada': '🔵',
                'salida': '🔴',
                'permiso': '🟡',
                'otro': '⚪'
            };
            
            const icon = tipoIcon[reg.tipo_registro] || '⚪';
            
            html += `
                <div class="registro-item" style="animation: slideInRegistro 0.3s ease-out ${index * 0.05}s both;">
                    <div class="registro-header-item">
                        <span class="registro-numero">#${index + 1}</span>
                        <span class="registro-tipo">${icon} ${reg.tipo_registro || 'N/A'}</span>
                        <span class="registro-hora">⏰ ${reg.hora || 'N/A'}</span>
                    </div>
                    <div class="registro-body">
                        <div class="registro-detalle">
                            <strong>📋 Modalidad:</strong> ${reg.modalidad || 'N/A'}
                        </div>
                        <div class="registro-detalle">
                            <strong>📍 Ubicación:</strong> ${(reg.ubicacion?.lugar || 'N/A').substring(0, 50)}${reg.ubicacion?.lugar && reg.ubicacion.lugar.length > 50 ? '...' : ''}
                        </div>
                        <div class="registro-detalle">
                            <strong>🎯 Precisión:</strong> ${reg.ubicacion?.precision_metros || 0} metros
                        </div>
                        ${reg.total_evidencias > 0 ? `<div class="registro-detalle"><strong>📸 Evidencias:</strong> ${reg.total_evidencias}</div>` : ''}
                    </div>
                </div>
            `;
        });
        
        registrosLista.innerHTML = html;
        console.log('✅ Registros mostrados en pantalla');
        
    } catch (error) {
        console.error('❌ Error cargando registros:', error);
        
        registrosLista.innerHTML = `
            <div class="registro-error">
                <div class="error-icon">⚠️</div>
                <div class="error-text">
                    Error cargando registros: ${error.message}
                </div>
                <button class="btn-retry-registros" onclick="window.reintentarCargarRegistros()">
                    🔄 Reintentar
                </button>
            </div>
        `;
        registrosCount.textContent = 'Error';
        registrosCount.style.background = '#dc3545';
    }
}

function ocultarRegistrosDelDia() {
    const registrosSection = document.getElementById('registros-section');
    if (registrosSection) {
        registrosSection.style.display = 'none';
    }
}

// Exponer función globalmente para el botón de reintentar
window.reintentarCargarRegistros = mostrarRegistrosDelDia;

// ========== VALIDACIONES ==========
function validateConditionalFields() {
    const tipoRegistro = document.getElementById('tipo_registro');
    const permisoDetalle = document.getElementById('permiso_detalle');
    const otroDetalle = document.getElementById('otro_detalle');
    
    if (tipoRegistro.value === 'permiso' && !permisoDetalle.value.trim()) {
        showStatus('Especifique el motivo del permiso.', 'error');
        permisoDetalle.focus();
        return false;
    }
    
    if (tipoRegistro.value === 'otro' && !otroDetalle.value.trim()) {
        showStatus('Especifique el tipo de registro.', 'error');
        otroDetalle.focus();
        return false;
    }
    
    const actividadesVarias = document.getElementById('actividades_varias');
    const actividadesVariasTexto = document.getElementById('actividades_varias_texto');
    
    if (actividadesVarias && actividadesVarias.checked && !actividadesVariasTexto.value.trim()) {
        showStatus('Describa las actividades varias realizadas.', 'error');
        actividadesVariasTexto.focus();
        return false;
    }
    
    const pruebasPsicologicas = document.getElementById('pruebas_psicologicas');
    const pruebasPsicologicasTexto = document.getElementById('pruebas_psicologicas_texto');
    
    if (pruebasPsicologicas && pruebasPsicologicas.checked && !pruebasPsicologicasTexto.value.trim()) {
        showStatus('Especifique qué pruebas psicológicas aplicó.', 'error');
        pruebasPsicologicasTexto.focus();
        return false;
    }
    
    const intervenciones = parseInt(document.getElementById('intervenciones_psicologicas').value) || 0;
    
    if (intervenciones > 0) {
        const ninos = parseInt(document.getElementById('ninos_ninas').value) || 0;
        const adolescentes = parseInt(document.getElementById('adolescentes').value) || 0;
        const adultos = parseInt(document.getElementById('adultos').value) || 0;
        const mayores = parseInt(document.getElementById('mayores_60').value) || 0;
        const familia = parseInt(document.getElementById('familia').value) || 0;
        
        const sumaGrupos = ninos + adolescentes + adultos + mayores + familia;
        
        if (sumaGrupos !== intervenciones) {
            showStatus(`Error: Total intervenciones (${intervenciones}) ≠ suma grupos (${sumaGrupos})`, 'error');
            return false;
        }
    }
    
    return true;
}

function resetFormOnly() {
    document.getElementById('attendanceForm').reset();
    initializeForm();
    
    document.querySelectorAll('.conditional-field').forEach(field => {
        field.classList.remove('show');
    });
    
    document.getElementById('evidencias_section').style.display = 'none';
    resetEvidenciasSection();
    
    document.getElementById('ubicacion_detectada').value = 'Obteniendo ubicación...';
    document.getElementById('direccion_completa').value = 'Consultando dirección...';
    document.getElementById('precision_gps').value = 'Calculando...';
    
    ['ubicacion_detectada', 'direccion_completa', 'precision_gps'].forEach(id => {
        document.getElementById(id).className = 'location-field';
    });
    
    document.getElementById('retry_location_btn').style.display = 'none';
    
    document.getElementById('email').value = currentUser.email;
    document.getElementById('google_user_id').value = currentUser.id;
    
    locationValid = false;
    locationAttempts = 0;
    updateLocationStatus('loading', 'Obteniendo nueva ubicación GPS...', '');
    updateSubmitButton();
}

function showStatus(message, type) {
    const status = document.getElementById('status');
    status.innerHTML = message;
    status.className = `status ${type}`;
    status.style.display = 'block';
}

function hideStatus() {
    document.getElementById('status').style.display = 'none';
}

function updateSubmitButton() {
    const submitBtn = document.getElementById('submit_btn');
    
    if (!isAuthenticated) {
        submitBtn.disabled = true;
        submitBtn.textContent = '🔒 Autentíquese primero';
        submitBtn.style.background = '#6c757d';
    } else if (locationValid) {
        submitBtn.disabled = false;
        submitBtn.textContent = '📋 Registrar Asistencia';
        submitBtn.style.background = 'linear-gradient(45deg, #667eea, #764ba2)';
    } else {
        submitBtn.disabled = true;
        submitBtn.textContent = '⚠️ Ubicación GPS requerida';
        submitBtn.style.background = '#6c757d';
    }
}

// ========== MANEJO DE EVIDENCIAS (COMPATIBLE iOS) ==========
function setupEvidenciasHandlers() {
    const evidenciasInput = document.getElementById('evidencias');
    
    if (isIOS) {
        console.log('🎯 iOS: Configurando manejo simple de archivos');
        evidenciasInput.addEventListener('change', function(e) {
            handleIOSFileSelection(e.target.files);
        });
    } else {
        evidenciasInput.addEventListener('change', function(e) {
            handleFileSelection(e.target.files);
        });
        
        const evidenciasContainer = document.querySelector('.evidencias-container');
        evidenciasContainer.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
            evidenciasContainer.style.borderColor = '#4854c7';
        });
        
        evidenciasContainer.addEventListener('dragleave', function(e) {
            e.preventDefault();
            e.stopPropagation();
            evidenciasContainer.style.borderColor = '#667eea';
        });
        
        evidenciasContainer.addEventListener('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
            evidenciasContainer.style.borderColor = '#667eea';
            handleFileSelection(e.dataTransfer.files);
        });
    }
}

function handleIOSFileSelection(files) {
    console.log(`📱 iOS: Procesando ${files.length} archivo(s)...`);
    
    const fileArray = Array.from(files);
    const validFiles = [];
    const errors = [];
    
    fileArray.forEach(file => {
        if (!file.type || !ALLOWED_FILE_TYPES.includes(file.type)) {
            errors.push(`${file.name}: Solo JPG, PNG, WEBP`);
            return;
        }
        
        if (file.size > MAX_FILE_SIZE) {
            const sizeMB = (file.size / 1024 / 1024).toFixed(1);
            errors.push(`${file.name}: ${sizeMB}MB (máx. 10MB)`);
            return;
        }
        
        validFiles.push(file);
    });
    
    if (selectedFiles.length + validFiles.length > MAX_FILES) {
        errors.push(`Máximo ${MAX_FILES} imágenes (ya tiene ${selectedFiles.length})`);
        showEvidenciasStatus(errors.join('<br>'), 'error');
        return;
    }
    
    if (errors.length > 0) {
        showEvidenciasStatus(errors.join('<br>'), 'error');
    }
    
    validFiles.forEach(file => {
        selectedFiles.push(file);
        addFilePreview(file, selectedFiles.length - 1);
    });
    
    if (validFiles.length > 0) {
        showEvidenciasStatus(`${validFiles.length} imagen(es) agregada(s).`, 'success');
    }
}

function handleFileSelection(files) {
    const fileArray = Array.from(files);
    const validFiles = [];
    const errors = [];
    
    fileArray.forEach(file => {
        if (!file.type || !ALLOWED_FILE_TYPES.includes(file.type)) {
            errors.push(`${file.name}: Formato no válido`);
            return;
        }
        
        if (file.size > MAX_FILE_SIZE) {
            const sizeMB = (file.size / 1024 / 1024).toFixed(1);
            errors.push(`${file.name}: ${sizeMB}MB (máx. 10MB)`);
            return;
        }
        
        validFiles.push(file);
    });
    
    if (selectedFiles.length + validFiles.length > MAX_FILES) {
        errors.push(`Máximo ${MAX_FILES} imágenes (ya tiene ${selectedFiles.length})`);
        showEvidenciasStatus(errors.join('<br>'), 'error');
        return;
    }
    
    if (errors.length > 0) {
        showEvidenciasStatus(errors.join('<br>'), 'error');
    }
    
    validFiles.forEach(file => {
        selectedFiles.push(file);
        addFilePreview(file, selectedFiles.length - 1);
    });
    
    if (!isIOS) {
        updateFileInput();
    }
    
    if (validFiles.length > 0) {
        showEvidenciasStatus(`${validFiles.length} imagen(es) agregada(s) correctamente.`, 'success');
    }
}

function addFilePreview(file, index) {
    const preview = document.getElementById('evidencias-preview');
    const fileItem = document.createElement('div');
    fileItem.className = 'evidencia-item';
    fileItem.dataset.index = index;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        fileItem.innerHTML = `
            <img src="${e.target.result}" alt="Evidencia ${index + 1}">
            <div class="evidencia-info">
                ${file.name.length > 15 ? file.name.substring(0, 15) + '...' : file.name}<br>
                <small>${(file.size / 1024).toFixed(1)} KB</small>
            </div>
            <button type="button" class="evidencia-remove" onclick="window.removeFile(${index})">×</button>
        `;
    };
    reader.readAsDataURL(file);
    preview.appendChild(fileItem);
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    updatePreview();
    if (!isIOS) {
        updateFileInput();
    }
    showEvidenciasStatus(`Imagen removida. Total: ${selectedFiles.length}/${MAX_FILES}`, 'success');
}

window.removeFile = removeFile;

function updatePreview() {
    const preview = document.getElementById('evidencias-preview');
    preview.innerHTML = '';
    selectedFiles.forEach((file, index) => addFilePreview(file, index));
}

function updateFileInput() {
    if (isIOS) return;
    
    try {
        const input = document.getElementById('evidencias');
        const dt = new DataTransfer();
        selectedFiles.forEach(file => dt.items.add(file));
        input.files = dt.files;
    } catch (error) {
        console.warn('⚠️ Error actualizando input.files:', error);
    }
}

function showEvidenciasStatus(message, type) {
    const status = document.getElementById('evidencias-status');
    status.innerHTML = message;
    status.className = `evidencias-status ${type}`;
    if (type === 'success') {
        setTimeout(() => status.style.display = 'none', 5000);
    }
}

function resetEvidenciasSection() {
    selectedFiles = [];
    const input = document.getElementById('evidencias');
    input.value = '';
    document.getElementById('evidencias-preview').innerHTML = '';
    document.getElementById('evidencias-status').style.display = 'none';
}

// ========== GEOLOCALIZACIÓN ==========
function getCurrentLocation() {
    if (!isAuthenticated) {
        updateLocationStatus('error', 'Se requiere ubicación GPS', '');
        ['ubicacion_detectada', 'direccion_completa', 'precision_gps'].forEach(id => {
            document.getElementById(id).value = 'Se requiere ubicación GPS';
        });
        document.getElementById('location_status').value = 'Se requiere ubicación GPS';
        return;
    }

    if (!navigator.geolocation) {
        updateLocationStatus('error', 'Geolocalización no soportada', '');
        return;
    }

    locationAttempts++;
    
    const statusMsg = isDesktop 
        ? `Obteniendo ubicación por IP/WiFi... (${locationAttempts}/${MAX_LOCATION_ATTEMPTS})` 
        : `Obteniendo ubicación GPS... (${locationAttempts}/${MAX_LOCATION_ATTEMPTS})`;
    
    updateLocationStatus('loading', statusMsg, '');

    const options = { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 };
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            currentLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
            };
            
            document.getElementById('latitude').value = currentLocation.latitude;
            document.getElementById('longitude').value = currentLocation.longitude;
            
            console.log(`📍 Ubicación obtenida - Precisión: ${Math.round(currentLocation.accuracy)}m (límite: ${REQUIRED_ACCURACY}m)`);
            
            if (currentLocation.accuracy <= REQUIRED_ACCURACY) {
                locationValid = true;
                document.getElementById('location_status').value = 'success';
                
                let successMsg = 'Ubicación obtenida correctamente';
                let successDesc = `Precisión: ${Math.round(currentLocation.accuracy)} metros`;
                
                if (isDesktop && currentLocation.accuracy > REQUIRED_ACCURACY_OPTIMAL) {
                    successDesc += ` (normal para ordenadores)`;
                }
                
                updateLocationStatus('success', successMsg, successDesc);
                updateSubmitButton();
                updateLocationFields(currentLocation);
            } else {
                locationValid = false;
                
                const precisedMsg = isDesktop 
                    ? `Precisión insuficiente (${Math.round(currentLocation.accuracy)}m > ${REQUIRED_ACCURACY}m)`
                    : `Precisión GPS insuficiente`;
                
                const preciseDesc = isDesktop
                    ? `Se requiere ${REQUIRED_ACCURACY}m o menos. En desktop, intente conectarse a una red WiFi conocida.`
                    : `Se requiere ${REQUIRED_ACCURACY}m o menos. Actual: ${Math.round(currentLocation.accuracy)}m`;
                
                updateLocationStatus('warning', precisedMsg, preciseDesc);
                
                if (locationAttempts < MAX_LOCATION_ATTEMPTS) {
                    setTimeout(() => getCurrentLocation(), 2000);
                } else {
                    updateLocationStatus('error', 'No se pudo obtener la precisión requerida', 
                        isDesktop ? 'Intente conectarse a WiFi o usar un dispositivo móvil' : '');
                    document.getElementById('retry_location_btn').style.display = 'block';
                }
            }
        },
        function(error) {
            locationValid = false;
            let errorMessage, errorDescription;
            
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Permisos denegados';
                    errorDescription = 'Permita el acceso a la ubicación';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Ubicación no disponible';
                    errorDescription = isDesktop 
                        ? 'Verifique su conexión a Internet o WiFi' 
                        : 'Verifique su conexión GPS';
                    break;
                case error.TIMEOUT:
                    errorMessage = 'Tiempo agotado';
                    errorDescription = 'Intente nuevamente';
                    break;
                default:
                    errorMessage = 'Error desconocido';
                    errorDescription = 'Error inesperado';
            }
            
            document.getElementById('location_status').value = 'error: ' + errorMessage;
            updateLocationStatus('error', errorMessage, errorDescription);
            
            ['ubicacion_detectada', 'direccion_completa', 'precision_gps'].forEach(id => {
                document.getElementById(id).value = 'Error: ' + errorMessage;
                document.getElementById(id).className = 'location-field error';
            });
            
            if (locationAttempts < MAX_LOCATION_ATTEMPTS && error.code !== error.PERMISSION_DENIED) {
                setTimeout(() => getCurrentLocation(), 3000);
            } else {
                document.getElementById('retry_location_btn').style.display = 'block';
            }
        },
        options
    );
}

function updateLocationStatus(type, message, description) {
    const statusDiv = document.getElementById('location_status_display');
    const icons = { loading: '🌍', success: '✅', warning: '⚠️', error: '❌' };
    
    statusDiv.className = `location-status ${type}`;
    statusDiv.innerHTML = `${icons[type]} <strong>${message}</strong>${description ? '<br>' + description : ''}`;
}

function updateLocationFields(location) {
    const accuracy = Math.round(location.accuracy);
    let precisionText = `${accuracy} metros`;
    let precisionClass = '';
    
    if (isDesktop) {
        if (accuracy <= 200) {
            precisionText += ' (Excelente para Desktop)';
            precisionClass = 'uas-location';
        } else if (accuracy <= 500) {
            precisionText += ' (Muy Buena para Desktop)';
            precisionClass = 'uas-location';
        } else if (accuracy <= 1000) {
            precisionText += ' (Aceptable para Desktop)';
            precisionClass = '';
        } else {
            precisionText += ' (Baja - típica de Desktop)';
            precisionClass = 'warning';
        }
    } else {
        if (accuracy <= 10) {
            precisionText += ' (Excelente)';
            precisionClass = 'uas-location';
        } else if (accuracy <= 30) {
            precisionText += ' (Muy Buena)';
            precisionClass = 'uas-location';
        } else if (accuracy <= 50) {
            precisionText += ' (Buena)';
            precisionClass = '';
        } else {
            precisionText += ' (Regular)';
            precisionClass = 'warning';
        }
    }
    
    document.getElementById('precision_gps').value = precisionText;
    document.getElementById('precision_gps').className = `location-field ${precisionClass}`;
    
    const ubicacionDetectada = detectarUbicacionEspecifica(location.latitude, location.longitude);
    const campoUbicacion = document.getElementById('ubicacion_detectada');
    
    if (ubicacionDetectada.encontrada && ubicacionDetectada.esUAS) {
        campoUbicacion.value = ubicacionDetectada.nombre;
        campoUbicacion.className = 'location-field uas-location';
    } else {
        campoUbicacion.value = "Consultando ubicación...";
        campoUbicacion.className = 'location-field';
    }
    
    obtenerDireccionCompleta(location.latitude, location.longitude, ubicacionDetectada);
}

function detectarUbicacionEspecifica(lat, lng) {
    for (let ubicacion of ubicacionesUAS.sort((a, b) => a.radius - b.radius)) {
        const distancia = calcularDistancia(lat, lng, ubicacion.lat, ubicacion.lng);
        
        if (distancia <= ubicacion.radius) {
            return {
                encontrada: true,
                esUAS: true,
                nombre: ubicacion.name,
                distancia: Math.round(distancia)
            };
        }
    }
    
    return { encontrada: false, esUAS: false, nombre: "Ubicación externa" };
}

async function obtenerDireccionCompleta(lat, lng, ubicacionDetectada) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=es&zoom=18`);
        const data = await response.json();
        
        const direccionField = document.getElementById('direccion_completa');
        
        if (data && data.display_name) {
            direccionField.value = data.display_name;
            direccionField.className = 'location-field';
            
            if (!ubicacionDetectada.esUAS) {
                actualizarUbicacionEspecifica(data);
            }
        } else {
            direccionField.value = 'Dirección no disponible';
            direccionField.className = 'location-field warning';
        }
    } catch (error) {
        const direccionField = document.getElementById('direccion_completa');
        direccionField.value = 'Error al obtener dirección';
        direccionField.className = 'location-field warning';
    }
}

function actualizarUbicacionEspecifica(direccionData) {
    const campoUbicacion = document.getElementById('ubicacion_detectada');
    const address = direccionData.address || {};
    
    let ubicacionEspecifica = '';
    
    if (address.house_number && address.road) {
        ubicacionEspecifica = `${address.road} ${address.house_number}`;
    } else if (address.road) {
        ubicacionEspecifica = address.road;
    } else if (address.neighbourhood || address.suburb) {
        ubicacionEspecifica = address.neighbourhood || address.suburb;
    } else if (address.city || address.town) {
        ubicacionEspecifica = address.city || address.town;
    } else {
        ubicacionEspecifica = "Ubicación no especificada";
    }
    
    campoUbicacion.value = ubicacionEspecifica;
}

function calcularDistancia(lat1, lng1, lat2, lng2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lng2-lng1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}

function resetLocationFields() {
    ['ubicacion_detectada', 'direccion_completa', 'precision_gps'].forEach(id => {
        document.getElementById(id).value = 'Se requiere ubicación GPS';
        document.getElementById(id).className = 'location-field';
    });
    document.getElementById('retry_location_btn').style.display = 'none';
    updateLocationStatus('loading', 'Autenticándose para obtener ubicación GPS', '');
}

// ========== EVENT LISTENERS ==========
function setupEventListeners() {
    // Tipo de registro
    document.getElementById('tipo_registro').addEventListener('change', function() {
        const salidaSection = document.getElementById('salida_section');
        const evidenciasSection = document.getElementById('evidencias_section');
        const permisoSection = document.getElementById('permiso_detalle_section');
        const otroSection = document.getElementById('otro_detalle_section');
        const permisoTextarea = document.getElementById('permiso_detalle');
        const otroTextarea = document.getElementById('otro_detalle');
        
        salidaSection.classList.remove('show');
        evidenciasSection.style.display = 'none';
        permisoSection.classList.remove('show');
        otroSection.classList.remove('show');
        permisoTextarea.required = false;
        otroTextarea.required = false;
        permisoTextarea.value = '';
        otroTextarea.value = '';
        
        if (this.value !== 'salida') {
            resetEvidenciasSection();
        }
        
        if (this.value === 'salida') {
            salidaSection.classList.add('show');
            evidenciasSection.style.display = 'block';
        } else if (this.value === 'permiso' || this.value === 'noabrioclinica' || this.value === 'festivo') {
            permisoSection.classList.add('show');
            permisoTextarea.required = true;
        } else if (this.value === 'otro') {
            otroSection.classList.add('show');
            otroTextarea.required = true;
        }
    });

    // Intervenciones psicológicas
    document.getElementById('intervenciones_psicologicas').addEventListener('input', function() {
        const gruposSection = document.getElementById('grupos_edad_section');
        if (parseInt(this.value) > 0) {
            gruposSection.classList.add('show');
        } else {
            gruposSection.classList.remove('show');
        }
    });

    // Actividades varias
    document.getElementById('actividades_varias').addEventListener('change', function() {
        const detalle = document.getElementById('actividades_varias_detalle');
        const textarea = document.getElementById('actividades_varias_texto');
        if (this.checked) {
            detalle.classList.add('show');
            textarea.required = true;
        } else {
            detalle.classList.remove('show');
            textarea.required = false;
            textarea.value = '';
        }
    });

    // Pruebas psicológicas
    document.getElementById('pruebas_psicologicas').addEventListener('change', function() {
        const detalle = document.getElementById('pruebas_psicologicas_detalle');
        const textarea = document.getElementById('pruebas_psicologicas_texto');
        if (this.checked) {
            detalle.classList.add('show');
            textarea.required = true;
        } else {
            detalle.classList.remove('show');
            textarea.required = false;
            textarea.value = '';
        }
    });

    // Reintentar ubicación
    document.getElementById('retry_location_btn').addEventListener('click', function() {
        if (!isAuthenticated) {
            showStatus('Autentíquese primero.', 'error');
            return;
        }
        locationAttempts = 0;
        getCurrentLocation();
    });

    // Submit del formulario
    document.getElementById('attendanceForm').addEventListener('submit', handleSubmit);
}

// ========== EXPORTAR FUNCIONES GLOBALES ==========
window.requestAuthentication = requestAuthentication;
window.signOut = signOut;

// ========== LOG FINAL ==========
console.log('✅ Script Firebase cargado completamente');
console.log('🔥 Firebase Firestore: Conectado');
console.log('📁 Google Drive: Para evidencias');
console.log('🎯 Versión: 2.0 Firebase');
console.log('📋 Funciones disponibles:');
console.log('   - requestAuthentication()');
console.log('   - signOut()');
console.log('   - mostrarRegistrosDelDia()');
console.log('='.repeat(70));

// ========== FIX: Actualizar botón periódicamente ==========
setInterval(() => {
    if (isAuthenticated && locationValid) {
        const submitBtn = document.getElementById('submit_btn');
        if (submitBtn && submitBtn.disabled) {
            console.log('🔧 Auto-fix: Habilitando botón...');
            submitBtn.disabled = false;
            submitBtn.textContent = '📋 Registrar Asistencia';
            submitBtn.style.background = 'linear-gradient(45deg, #667eea, #764ba2)';
        }
    }
}, 1000);
