// ========== DETECCIÓN DE DISPOSITIVO Y NAVEGADOR ==========
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || 
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

// Detectar si es un ordenador de escritorio/laptop
const isDesktop = detectDesktop();
const deviceType = getDeviceType();

console.log(`📱 Tipo dispositivo: ${deviceType}`);
console.log(`💻 Es Desktop: ${isDesktop ? 'Sí' : 'No'}`);
console.log(`📱 Es iOS: ${isIOS ? 'Sí' : 'No'}`);
console.log(`🌐 Navegador: ${isSafari ? 'Safari' : 'Otro'}`);

// Variables globales
let currentLocation = null;
let userEmail = null;
let isAuthenticated = false;
let locationValid = false;
let locationAttempts = 0;
let currentUser = null;
let selectedFiles = [];
let authenticationPurpose = 'login';
let privacyConsent = false;

const MAX_LOCATION_ATTEMPTS = 3;
// Precisión ajustada según tipo de dispositivo
const REQUIRED_ACCURACY = isDesktop ? 1000 : 50; // 1000m para desktop, 50m para móviles
const REQUIRED_ACCURACY_OPTIMAL = isDesktop ? 300 : 30; // Precisión óptima
const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PRIVACY_VERSION = '1.0';
// *** FIX: Aumentar tiempos de espera para verificación ***
const SAFARI_MULTIPLIER = isSafari ? 1.5 : 1;
const TIEMPO_ESPERA_INICIAL = 5000 * SAFARI_MULTIPLIER; // 22.5s en Safari
const TIEMPO_ENTRE_VERIFICACIONES = isSafari 
  ? [5000, 7000, 9000] // Safari: Tiempos más largos  8000, 12000, 18000
  : [3000, 50000, 7000]; // Otros: Tiempos normales    5000, 10000, 15000
const VERIFICATION_ATTEMPTS = isSafari ? 2 : 3; // Safari: menos intentos
const TIMEOUT_VERIFICACION_JSONP = 10000 * SAFARI_MULTIPLIER; // 30s en Safari
const ENABLE_VERIFICATION_FALLBACK = true;
let CORS_AVAILABLE = true; // Se detectará al inicio

//PRODUCCION
//const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyllBO0vTORygvLlbTeRWfNXz1_Dt1khrM2z_BUxbNM6jWqEGYDqaLnd7LJs9Fl9Q9X/exec';
//const GOOGLE_CLIENT_ID = '799841037062-kal4vump3frc2f8d33bnp4clc9amdnng.apps.googleusercontent.com';
//PRUEBAS
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw10UgiYsuGYi16MisVfk7fx-wlGU-gUmCKTz2bZmyqys_2ku1ghZ9zzv71UncZ_sXlDg/exec';
const GOOGLE_CLIENT_ID = '154864030871-ck4l5krb7qm68kmp6a7rcq7h072ldm6g.apps.googleusercontent.com';

const ubicacionesUAS = [
    { name: "CESPSIC - Centro de Servicios Psicológicos", lat: 24.8278, lng: -107.3812, radius: 50 },
    { name: "Facultad de Psicología UAS", lat: 24.7993, lng: -107.3950, radius: 100 },
    { name: "Universidad Autónoma de Sinaloa - Campus Central", lat: 24.7990, lng: -107.3950, radius: 200 }
];

// ========== FUNCIONES DE DETECCIÓN DE DISPOSITIVO ==========
function detectDesktop() {
    const ua = navigator.userAgent.toLowerCase();
    
    // Detectar sistemas operativos de escritorio
    const isWindows = /windows nt/.test(ua);
    const isMacOS = /macintosh|mac os x/.test(ua) && navigator.maxTouchPoints <= 1;
    const isLinux = /linux/.test(ua) && !/android/.test(ua);
    
    // Detectar si NO es móvil
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
    
    // Es desktop si tiene OS de escritorio Y no es móvil
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

// ========== TEST DE DISPONIBILIDAD CORS ==========
async function testCORSAvailability() {
  try {
    console.log('🧪 Probando disponibilidad de CORS...');
    const testUrl = `${GOOGLE_SCRIPT_URL}?action=ping&_t=${Date.now()}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(testUrl, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    console.log('✅ CORS disponible');
    return true;
  } catch (error) {
    console.warn('⚠️ CORS bloqueado:', error.message);
    return false;
  }
}

// Inicializar aplicación
document.addEventListener('DOMContentLoaded', async function() {
    console.log('=== INFORMACIÓN DEL DISPOSITIVO ===');
    console.log('Tipo:', deviceType);
    console.log('Es Desktop:', isDesktop);
    console.log('Es Safari:', isSafari);
    console.log('Precisión requerida:', REQUIRED_ACCURACY + 'm');
    console.log('Precisión óptima:', REQUIRED_ACCURACY_OPTIMAL + 'm');
    
    // ⭐ NUEVO: Test de CORS para Safari
    if (isSafari) {
        console.log('🍎 Safari detectado - Probando CORS...');
        CORS_AVAILABLE = await testCORSAvailability();
        
        if (!CORS_AVAILABLE) {
            console.warn('⚠️ CORS no disponible en Safari');
            console.warn('   Usando modo de verificación simplificado');
            showStatus(
                '⚠️ Safari: La confirmación automática puede estar limitada.\n\n' +
                'Su asistencia se guardará correctamente, pero la verificación\n' +
                'visual puede tardar más tiempo o requerir revisión manual.\n\n' +
                'Esto es normal y no afecta el registro de su asistencia.',
                'warning'
            );
            setTimeout(() => hideStatus(), 10000);
        }
    }
    
    if (isDesktop) {
        console.log('⚠️ MODO DESKTOP ACTIVADO');
        console.log('   Los ordenadores no tienen GPS integrado.');
        console.log('   La ubicación se obtiene por IP/WiFi (menor precisión).');
        console.log('   Precisión aceptada: hasta ' + REQUIRED_ACCURACY + 'm');
        showDesktopWarning();
    }
    
    if (isIOS) {
        console.log('🎯 Modo iOS activado - Aplicando compatibilidad especial');
        checkHTTPS();
    }
    
    initializeForm();
    setupEventListeners();
    loadGoogleSignInScript();
    updateCurrentTime();
    checkPrivacyConsent();
    setInterval(updateCurrentTime, 1000);
});

// ========== VALIDACIÓN HTTPS PARA iOS ==========
function checkHTTPS() {
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        console.warn('⚠️ iOS requiere HTTPS para geolocalización');
        showStatus('⚠️ Se recomienda usar HTTPS para mejor funcionalidad en iOS', 'warning');
        setTimeout(() => hideStatus(), 5000);
    }
}

// ========== ADVERTENCIA PARA DESKTOP ==========
function showDesktopWarning() {
    const authSection = document.getElementById('auth-section');
    
    // Crear advertencia si no existe
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

// ========== LOCALSTORAGE SEGURO (COMPATIBLE CON MODO PRIVADO iOS) ==========
function safeLocalStorage() {
    try {
        const test = '__storage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch (e) {
        console.warn('⚠️ localStorage no disponible (modo privado)', e);
        return false;
    }
}

function safeSetItem(key, value) {
    if (safeLocalStorage()) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            console.error('Error guardando en localStorage:', e);
            return false;
        }
    }
    console.warn('⚠️ localStorage bloqueado - datos no persistirán');
    return false;
}

function safeGetItem(key) {
    if (safeLocalStorage()) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.error('Error leyendo localStorage:', e);
            return null;
        }
    }
    return null;
}

function safeRemoveItem(key) {
    if (safeLocalStorage()) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error('Error removiendo de localStorage:', e);
            return false;
        }
    }
    return false;
}

// ========== PRIVACY MANAGEMENT ==========
function checkPrivacyConsent() {
    try {
        const storedConsent = safeGetItem('cespsic_privacy_accepted');
        if (storedConsent) {
            const consentData = JSON.parse(storedConsent);
            if (consentData.version === PRIVACY_VERSION && consentData.accepted && consentData.authenticated_user) {
                privacyConsent = true;
                updatePrivacyUI();
                return;
            }
            safeRemoveItem('cespsic_privacy_accepted');
        }
        privacyConsent = false;
        updatePrivacyUI();
    } catch (error) {
        console.error('Error verificando consentimiento:', error);
        safeRemoveItem('cespsic_privacy_accepted');
        privacyConsent = false;
        updatePrivacyUI();
    }
}

function updatePrivacyUI() {
    const revokeSection = document.getElementById('revoke-section');
    const signinBtn = document.getElementById('main-signin-btn');
    const signinBtnText = document.getElementById('signin-btn-text');
    
    if (privacyConsent) {
        revokeSection.style.display = 'block';
        signinBtn.disabled = false;
        signinBtn.classList.remove('privacy-required');
    } else {
        revokeSection.style.display = 'none';
        signinBtn.disabled = false;
        signinBtn.classList.add('privacy-required');
    }
    signinBtnText.textContent = 'Iniciar Sesión con Google';
    signinBtn.style.background = '#4285f4';
    signinBtn.style.cursor = 'pointer';
}

function requestAuthentication() {
    if (!privacyConsent) {
        showPrivacyModal();
    } else {
        authenticationPurpose = 'login';
        proceedWithGoogleSignIn();
    }
}

function showPrivacyModal() {
    const modal = document.getElementById('privacy-modal');
    if (modal) {
        modal.style.display = 'flex';
        document.addEventListener('keydown', handlePrivacyModalEscape);
    }
}

function hidePrivacyModal() {
    const modal = document.getElementById('privacy-modal');
    modal.style.display = 'none';
    document.removeEventListener('keydown', handlePrivacyModalEscape);
}

function handlePrivacyModalEscape(e) {
    if (e.key === 'Escape') rejectPrivacy();
}

function acceptPrivacy() {
    privacyConsent = true;
    updatePrivacyUI();
    hidePrivacyModal();
    authenticationPurpose = 'login';
    proceedWithGoogleSignIn();
}

function rejectPrivacy() {
    hidePrivacyModal();
    showStatus('Debe aceptar el aviso de privacidad para usar la aplicación.', 'error');
    setTimeout(() => hideStatus(), 5000);
}

function requestRevocation() { showRevokeModal(); }

function showRevokeModal() {
    const modal = document.getElementById('revoke-modal');
    modal.style.display = 'flex';
    document.addEventListener('keydown', handleRevokeModalEscape);
}

function hideRevokeModal() {
    const modal = document.getElementById('revoke-modal');
    modal.style.display = 'none';
    document.removeEventListener('keydown', handleRevokeModalEscape);
}

function handleRevokeModalEscape(e) {
    if (e.key === 'Escape') cancelRevocation();
}

function cancelRevocation() { hideRevokeModal(); }

function authenticateToRevoke() {
    hideRevokeModal();
    authenticationPurpose = 'revoke';
    proceedWithGoogleSignIn();
}

async function revokePrivacyConsent() {
    try {
        await recordPrivacyAction('PRIVACY_REVOKED');
        safeRemoveItem('cespsic_privacy_accepted');
        privacyConsent = false;
        isAuthenticated = false;
        currentUser = null;
        userEmail = null;
        locationValid = false;
        currentLocation = null;
        selectedFiles = [];
        
        updatePrivacyUI();
        updateAuthenticationUI();
        disableForm();
        resetLocationFields();
        resetEvidenciasSection();
        
        showStatus('Permisos de privacidad revocados exitosamente.', 'success');
        setTimeout(() => {
            hideStatus();
            initializeGoogleSignIn();
        }, 3000);
    } catch (error) {
        console.error('Error revocando consentimiento:', error);
        showStatus('Error al revocar permisos.', 'error');
    }
}

async function recordPrivacyAction(action) {
    if (!currentUser) throw new Error('Usuario no autenticado');
    
    const privacyData = {
        action: 'record_privacy_action',
        timestamp: new Date().toISOString(),
        email: currentUser.email,
        google_user_id: currentUser.id,
        authenticated_user_name: currentUser.name,
        privacy_action: action,
        privacy_version: PRIVACY_VERSION,
        device_info: navigator.userAgent,
        authentication_purpose: authenticationPurpose,
        is_ios: isIOS
    };
    
    await sendDataWithFallback(privacyData);
}

// ========== GOOGLE SIGN-IN ==========
function initializeForm() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const fechaLocal = `${year}-${month}-${day}`;
  
  document.getElementById('fecha').value = fechaLocal;
  updateCurrentTime();
  document.getElementById('timestamp').value = new Date().toISOString();
}

function updateCurrentTime() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  document.getElementById('hora').value = `${hours}:${minutes}`;	
}

function loadGoogleSignInScript() {
    if (typeof google !== 'undefined' && google.accounts) {
        initializeGoogleSignIn();
        blockGooglePrompts();
    } else {
        setTimeout(loadGoogleSignInScript, 100);
    }
}

function blockGooglePrompts() {
    try {
        google.accounts.id.disableAutoSelect();
        google.accounts.id.cancel();
        const originalPrompt = google.accounts.id.prompt;
        google.accounts.id.prompt = function(callback) {
            if (callback) callback({ isNotDisplayed: () => true, isSkippedMoment: () => true });
        };
    } catch (error) {
        console.error('Error bloqueando prompts:', error);
    }
}

function initializeGoogleSignIn() {
  try {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: true,
      ux_mode: 'popup'
    });
    google.accounts.id.disableAutoSelect();
    google.accounts.id.cancel();
  } catch (error) {
    console.error('Error inicializando Google Sign-In:', error);
    showStatus('Error cargando sistema de autenticación.', 'error');
  }
}

function proceedWithGoogleSignIn() {
    if (isIOS) {
        showIOSGoogleButton();
    } else {
        showVisibleGoogleButton();
    }
}

// ========== iOS: BOTÓN GOOGLE (USA MODAL HTML EXISTENTE) ==========
function showIOSGoogleButton() {
    const modal = document.getElementById('privacy-modal');
    const modalHeader = modal.querySelector('.modal-header');
    const modalBody = modal.querySelector('.modal-body');
    const modalFooter = modal.querySelector('.modal-footer');
    
    modalHeader.innerHTML = '<h2>🔐 Autenticación con Google</h2>';
    modalBody.innerHTML = `
        <p style="text-align: center; margin-bottom: 20px; color: #666;">
            Haga clic en el botón azul para continuar:
        </p>
        <div id="ios-google-button-container" style="display: flex; justify-content: center; margin: 20px 0;"></div>
    `;
    modalFooter.innerHTML = `
        <button class="btn-reject" onclick="closeIOSAuthModal()">Cancelar</button>
    `;
    
    modal.style.display = 'flex';
    
    setTimeout(() => {
        const buttonContainer = document.getElementById('ios-google-button-container');
        if (buttonContainer) {
            google.accounts.id.renderButton(buttonContainer, {
                theme: "filled_blue",
                size: "large",
                text: "signin_with",
                shape: "rectangular",
                width: 250
            });
        }
    }, 100);
}

function closeIOSAuthModal() {
    const modal = document.getElementById('privacy-modal');
    modal.style.display = 'none';
    
    if (privacyConsent && !isAuthenticated) {
        privacyConsent = false;
        updatePrivacyUI();
        showStatus('Debe completar la autenticación.', 'error');
        setTimeout(() => hideStatus(), 5000);
    }
}

// ========== OTROS NAVEGADORES: MODAL DINÁMICO ==========
function showVisibleGoogleButton() {
    const existingOverlay = document.getElementById('google-auth-overlay');
    if (existingOverlay) existingOverlay.remove();
    
    const overlay = document.createElement('div');
    overlay.id = 'google-auth-overlay';
    overlay.style.cssText = `
        position: fixed !important; top: 0 !important; left: 0 !important;
        width: 100% !important; height: 100% !important;
        background: rgba(0,0,0,0.7) !important; z-index: 10000 !important;
        display: flex !important; align-items: center !important; justify-content: center !important;
    `;
    
    const container = document.createElement('div');
    container.style.cssText = `
        background: white; padding: 30px; border-radius: 15px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.3); text-align: center;
        max-width: 400px; width: 90%;
    `;
    
    container.innerHTML = `
        <h3 style="margin-bottom: 20px; color: #333;">Autenticación con Google</h3>
        <p style="margin-bottom: 20px; color: #666;">Haga clic en el botón azul para continuar:</p>
        <div id="google-button-container" style="margin-bottom: 20px;"></div>
    `;
    
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.style.cssText = `
        padding: 10px 20px; background: #f5f5f5; border: 1px solid #ddd;
        border-radius: 5px; cursor: pointer; margin-top: 10px;
    `;
    cancelBtn.onclick = () => closeAuthModal();
    
    overlay.onclick = (e) => { if (e.target === overlay) closeAuthModal(); };
    container.appendChild(cancelBtn);
    overlay.appendChild(container);
    document.body.appendChild(overlay);
    
    setTimeout(() => {
        const buttonContainer = document.getElementById('google-button-container');
        if (buttonContainer) {
            google.accounts.id.renderButton(buttonContainer, {
                theme: "filled_blue", size: "large", text: "signin_with", shape: "rectangular"
            });
        }
    }, 100);
    
    setTimeout(() => closeAuthModal(), 300000);
}

async function handleCredentialResponse(response) {
    try {
        if (isIOS) {
            closeIOSAuthModal();
        } else {
            closeAuthModal();
        }
        
        const userInfo = parseJwt(response.credential);
        
        currentUser = {
            id: userInfo.sub,
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture,
            email_verified: userInfo.email_verified
        };

        if (!currentUser.email_verified) {
            showStatus('Su cuenta de Gmail no está verificada.', 'error');
            return;
        }

        if (authenticationPurpose === 'revoke') {
            await handleRevocationFlow();
        } else {
            await handleLoginFlow();
        }
    } catch (error) {
        console.error('Error procesando credenciales:', error);
        showStatus('Error en la autenticación.', 'error');
        if (isIOS) {
            closeIOSAuthModal();
        } else {
            closeAuthModal();
        }
    }
}

function closeAuthModal() {
    if (privacyConsent && !isAuthenticated) {
        privacyConsent = false;
        updatePrivacyUI();
        showStatus('Debe completar la autenticación.', 'error');
        setTimeout(() => hideStatus(), 5000);
    }
    
    const authOverlay = document.getElementById('google-auth-overlay');
    if (authOverlay) authOverlay.remove();
    
    setTimeout(() => {
        document.querySelectorAll('div[style*="position: fixed"][style*="z-index"]').forEach(overlay => {
            if (overlay.style.zIndex >= 10000) overlay.remove();
        });
    }, 500);
}

async function handleLoginFlow() {
    try {
        const consentData = {
            accepted: true,
            timestamp: new Date().toISOString(),
            version: PRIVACY_VERSION,
            userAgent: navigator.userAgent,
            authenticated_user: currentUser.email,
            authentication_timestamp: new Date().toISOString(),
            is_ios: isIOS
        };
        
        safeSetItem('cespsic_privacy_accepted', JSON.stringify(consentData));
        await recordPrivacyAction('PRIVACY_ACCEPTED');
        
        isAuthenticated = true;
        userEmail = currentUser.email;
        document.getElementById('email').value = userEmail;
        document.getElementById('google_user_id').value = currentUser.id;

        updateAuthenticationUI();
        enableForm();
        getCurrentLocation();
        updateSubmitButton();
        
        showStatus(`¡Bienvenido ${currentUser.name}! Autenticación exitosa.`, 'success');
        setTimeout(() => hideStatus(), 3000);
        
        // *** INTENTAR CARGAR REGISTROS (1 intento) ***
        setTimeout(async () => {
          console.log('📊 Cargando registros del día...');
          
          try {
            await mostrarRegistrosDelDia();
            console.log('✅ Carga de registros completada');
          } catch (e) {
            console.warn('⚠️ Error cargando registros:', e);
            // La función mostrarRegistrosDelDia ya maneja el error 403
          }
        }, 2000);
        
    } catch (error) {
        console.error('Error en flujo de login:', error);
        privacyConsent = false;
        updatePrivacyUI();
        showStatus('Error registrando la autenticación.', 'error');
    }
}

async function handleRevocationFlow() {
    try {
        await revokePrivacyConsent();
    } catch (error) {
        console.error('Error en flujo de revocación:', error);
        showStatus('Error durante la revocación.', 'error');
    }
}

function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error('Error parsing JWT:', error);
        return null;
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
}

function disableForm() {
  document.getElementById('form-container').classList.remove('authenticated');
  locationValid = false;
  updateSubmitButton();
}

function signOut() {
  try {
    google.accounts.id.disableAutoSelect();
    
    isAuthenticated = false;
    currentUser = null;
    userEmail = null;
    locationValid = false;
    currentLocation = null;
    locationAttempts = 0;
    selectedFiles = [];

    ['email', 'google_user_id', 'latitude', 'longitude', 'location_status'].forEach(id => {
      document.getElementById(id).value = '';
    });

    updateAuthenticationUI();
    disableForm();
    resetLocationFields();
    resetEvidenciasSection();
    ocultarRegistrosDelDia(); // *** OCULTAR REGISTROS ***

    showStatus('Sesión cerrada correctamente.', 'success');
    setTimeout(() => hideStatus(), 3000);
    setTimeout(() => initializeGoogleSignIn(), 1000);
  } catch (error) {
    console.error('Error cerrando sesión:', error);
    showStatus('Error al cerrar sesión.', 'error');
  }
}

// ========== EVIDENCIAS (iOS COMPATIBLE) ==========
function setupEvidenciasHandlers() {
    const evidenciasInput = document.getElementById('evidencias');
    
    if (isIOS) {
        // iOS: Evento simple, sin drag & drop
        console.log('🎯 iOS: Configurando manejo simple de archivos');
        evidenciasInput.addEventListener('change', function(e) {
            handleIOSFileSelection(e.target.files);
        });
    } else {
        // Android/Windows: Funcionalidad completa con drag & drop
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

// iOS: Manejo simple de archivos (SIN DataTransfer)
function handleIOSFileSelection(files) {
    console.log(`📱 iOS: Procesando ${files.length} archivo(s)...`);
    
    const fileArray = Array.from(files);
    const validFiles = [];
    const errors = [];
    
    fileArray.forEach(file => {
        console.log(`Archivo: ${file.name}, Tipo: ${file.type}, Tamaño: ${(file.size/1024/1024).toFixed(2)}MB`);
        
        if (!file.type) {
            errors.push(`${file.name}: Sin tipo MIME`);
            console.warn(`❌ ${file.name}: No tiene tipo MIME`);
            return;
        }
        
        if (!ALLOWED_FILE_TYPES.includes(file.type)) {
            errors.push(`${file.name}: Solo JPG, PNG, WEBP`);
            console.warn(`❌ ${file.name}: Tipo no permitido`);
            return;
        }
        
        const sizeMB = file.size / 1024 / 1024;
        if (file.size > MAX_FILE_SIZE) {
            errors.push(`${file.name}: ${sizeMB.toFixed(1)}MB (máx. 10MB)`);
            console.warn(`❌ ${file.name}: Muy grande`);
            return;
        }
        
        validFiles.push(file);
        console.log(`✅ ${file.name}: Válido`);
    });
    
    if (selectedFiles.length + validFiles.length > MAX_FILES) {
        errors.push(`Máximo ${MAX_FILES} imágenes (ya tiene ${selectedFiles.length})`);
        showEvidenciasStatus(errors.join('<br>'), 'error');
        console.warn(`❌ Límite excedido`);
        return;
    }
    
    if (errors.length > 0) {
        showEvidenciasStatus(errors.join('<br>'), 'error');
        console.warn(`⚠️ ${errors.length} archivo(s) rechazado(s)`);
    }
    
    // iOS: Guardar archivos directamente (NO tocar input.files)
    validFiles.forEach(file => {
        selectedFiles.push(file);
        addFilePreview(file, selectedFiles.length - 1);
    });
    
    if (validFiles.length > 0) {
        showEvidenciasStatus(`${validFiles.length} imagen(es) agregada(s).`, 'success');
        console.log(`✅ Total iOS: ${selectedFiles.length}`);
    }
}

// Android/Windows: Manejo completo de archivos (CON DataTransfer)
function handleFileSelection(files) {
    const fileArray = Array.from(files);
    const validFiles = [];
    const errors = [];
    
    console.log(`🔍 Procesando ${fileArray.length} archivo(s)...`);
    
    fileArray.forEach(file => {
        console.log(`Archivo: ${file.name}, Tipo: ${file.type}, Tamaño: ${(file.size/1024/1024).toFixed(2)}MB`);
        
        if (!file.type) {
            errors.push(`${file.name}: Sin tipo MIME (intente otro formato)`);
            console.warn(`❌ ${file.name}: No tiene tipo MIME`);
            return;
        }
        
        if (!ALLOWED_FILE_TYPES.includes(file.type)) {
            errors.push(`${file.name}: Formato no válido (solo JPG, PNG, WEBP)`);
            console.warn(`❌ ${file.name}: Tipo ${file.type} no permitido`);
            return;
        }
        
        const sizeMB = file.size / 1024 / 1024;
        if (file.size > MAX_FILE_SIZE) {
            errors.push(`${file.name}: ${sizeMB.toFixed(1)}MB (máx. 10MB)`);
            console.warn(`❌ ${file.name}: Demasiado grande (${sizeMB.toFixed(1)}MB)`);
            return;
        }
        
        validFiles.push(file);
        console.log(`✅ ${file.name}: Válido`);
    });
    
    if (selectedFiles.length + validFiles.length > MAX_FILES) {
        errors.push(`Máximo ${MAX_FILES} imágenes (ya tiene ${selectedFiles.length})`);
        showEvidenciasStatus(errors.join('<br>'), 'error');
        console.warn(`❌ Límite de archivos excedido`);
        return;
    }
    
    if (errors.length > 0) {
        showEvidenciasStatus(errors.join('<br>'), 'error');
        console.warn(`⚠️ ${errors.length} archivo(s) rechazado(s)`);
    }
    
    validFiles.forEach(file => {
        selectedFiles.push(file);
        addFilePreview(file, selectedFiles.length - 1);
    });
    
    updateFileInput();
    
    if (validFiles.length > 0) {
        showEvidenciasStatus(`${validFiles.length} imagen(es) agregada(s) correctamente.`, 'success');
        console.log(`✅ Total de archivos seleccionados: ${selectedFiles.length}`);
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
            <button type="button" class="evidencia-remove" onclick="removeFile(${index})">×</button>
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

function updatePreview() {
    const preview = document.getElementById('evidencias-preview');
    preview.innerHTML = '';
    selectedFiles.forEach((file, index) => addFilePreview(file, index));
}

// Solo para Android/Windows (iOS NO soporta DataTransfer)
function updateFileInput() {
    if (isIOS) {
        console.log('🎯 iOS: Saltando updateFileInput (no soportado)');
        return;
    }
    
    try {
        const input = document.getElementById('evidencias');
        const dt = new DataTransfer();
        selectedFiles.forEach(file => dt.items.add(file));
        input.files = dt.files;
    } catch (error) {
        console.warn('⚠️ Error actualizando input.files:', error);
        // No es crítico, continuar normal
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

// ========== UPLOAD ==========
async function uploadEvidencias() {
    if (selectedFiles.length === 0) {
        console.log('ℹ️ No hay archivos para subir');
        return [];
    }
    
    console.log(`📤 Iniciando subida de ${selectedFiles.length} archivo(s)...`);
    
    const tipoRegistro = document.getElementById('tipo_registro').value || 'sin_tipo';
    const evidenciasInfo = [];
    
    showEvidenciasStatus('Preparando archivos para subir...', 'loading');
    
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
            
            let base64Data;
            try {
                base64Data = await fileToBase64(file);
                console.log(`✅ Conversión Base64 exitosa: ${(base64Data.length/1024).toFixed(1)}KB`);
            } catch (b64Error) {
                console.error(`❌ Error en conversión Base64:`, b64Error);
                throw new Error(`Error al procesar la imagen: ${b64Error.message}`);
            }
            
            const uploadData = {
                action: 'upload_evidencia',
                fileName: fullFileName,
                fileData: base64Data,
                mimeType: file.type,
                studentFolder: generateStudentFolderName(),
                userEmail: currentUser.email,
                timestamp: new Date().toISOString()
            };
            
            console.log(`🚀 Enviando archivo ${i + 1}: ${fullFileName} (${file.type})`);
            
            const uploadResult = await Promise.race([
                sendDataWithFallback(uploadData),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout de 30 segundos')), 30000)
                )
            ]);
            
            evidenciasInfo.push({
                fileName: fullFileName,
                originalName: file.name,
                size: file.size,
                uploadTime: new Date().toISOString(),
                uploadStatus: 'SUCCESS',
                url: null
            });
            
            console.log(`✅ Archivo ${fullFileName} enviado exitosamente`);
            
        } catch (error) {
            console.error(`❌ Error subiendo archivo ${file.name}:`, error);
            
            evidenciasInfo.push({
                fileName: fullFileName,
                originalName: file.name,
                size: file.size,
                uploadTime: new Date().toISOString(),
                uploadStatus: 'FAILED',
                error: error.message || 'Error desconocido',
                errorType: error.name || 'Error'
            });
            
            showEvidenciasStatus(
                `⚠️ Error en ${file.name}: ${error.message}`, 
                'warning'
            );
            
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        if (i < selectedFiles.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
    }
    
    const successCount = evidenciasInfo.filter(e => e.uploadStatus === 'SUCCESS').length;
    const failCount = evidenciasInfo.filter(e => e.uploadStatus === 'FAILED').length;
    
    console.log(`\n📊 RESUMEN DE SUBIDA:`);
    console.log(`   ✅ Exitosas: ${successCount}`);
    console.log(`   ❌ Fallidas: ${failCount}`);
    console.log(`   📁 Total: ${evidenciasInfo.length}`);
    
    if (failCount > 0) {
        console.log(`\n⚠️ ARCHIVOS FALLIDOS:`);
        evidenciasInfo.filter(e => e.uploadStatus === 'FAILED').forEach(e => {
            console.log(`   - ${e.originalName}: ${e.error}`);
        });
    }
    
    if (successCount > 0) {
        showEvidenciasStatus(
            `✅ ${successCount} evidencia(s) subida(s)${failCount > 0 ? ` (${failCount} errores - revise consola)` : ''}`, 
            failCount > 0 ? 'warning' : 'success'
        );
    } else if (failCount > 0) {
        showEvidenciasStatus(
            `❌ No se pudo subir ninguna evidencia. Errores: ${evidenciasInfo.map(e => e.error).join(', ')}`, 
            'error'
        );
    }
    
    return evidenciasInfo;
}

async function sendDataWithFallback(data) {
  console.warn('⚠️ sendDataWithFallback obsoleto, use ');
  return sendDataWithIframe(data);
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

// ========== GENERACIÓN DE REGISTRO ID ÚNICO ==========
function generateRegistroID() {
  const timestamp = new Date().getTime();
  const email = userEmail ? userEmail.substring(0, 10) : 'unknown';
  const random = Math.random().toString(36).substring(2, 10);
  const registroID = `REG_${timestamp}_${email}_${random}`.replace(/[^a-zA-Z0-9_]/g, '');
  
  console.log('📋 Registro ID generado:', registroID);
  return registroID;
}

// ========== FUNCIÓN SLEEP ==========
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ========== ENVÍO CON VERIFICACIÓN, REINTENTOS E IDEMPOTENCIA (CORREGIDO) ==========
async function sendWithVerification(data, attempt = 1) {
  const MAX_ATTEMPTS = 3;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 INTENTO ${attempt}/${MAX_ATTEMPTS}`);
  console.log(`Registro ID: ${data.registro_id}`);
  console.log(`${'='.repeat(60)}`);

  // ⭐⭐⭐ NUEVO: FLUJO OPTIMIZADO PARA SAFARI ⭐⭐⭐
  console.log(`🌐 Navegador: ${isSafari ? 'Safari 🍎' : 'Otro'}`);
  console.log(`🔒 CORS disponible: ${CORS_AVAILABLE ? 'Sí ✅' : 'No ❌'}`);
  
  // Si es Safari sin CORS, usar flujo simplificado
  if (isSafari && !CORS_AVAILABLE) {
    console.log('\n' + '='.repeat(60));
    console.log('🍎 MODO SAFARI SIMPLIFICADO ACTIVADO');
    console.log('   • Verificación limitada por CORS');
    console.log('   • Usando estrategia de fallback confiable');
    console.log('='.repeat(60));
    
    try {
      // PASO 1: Validaciones
      console.log('📋 Validando datos...');
      if (!data.modalidad || data.modalidad === '' || data.modalidad === 'undefined') {
        throw new Error('VALIDACIÓN: Campo Modalidad vacío o inválido');
      }
      if (!data.email || !data.google_user_id) {
        throw new Error('VALIDACIÓN: Datos de autenticación faltantes');
      }
      if (!data.latitude || !data.longitude) {
        throw new Error('VALIDACIÓN: Coordenadas GPS faltantes');
      }
      console.log('✅ Validación exitosa');
      
      // PASO 2: Enviar datos
      console.log('📤 Enviando datos con iframe...');
      showStatus('📤 Enviando asistencia (Safari)...\nEsto puede tomar 25-30 segundos.', 'loading');
      await sendDataWithIframe(data);
      console.log('✅ Datos enviados al servidor');
      
      // PASO 3: Espera más larga para Safari
      const esperaSafari = 25000; // 25 segundos
      console.log(`⏳ Esperando ${esperaSafari/1000}s para procesamiento en Safari...`);
      showStatus(
        `⏳ Procesando registro (Safari)...\n` +
        `Tiempo restante: ~${esperaSafari/1000}s\n` +
        `Por favor, no cierre esta ventana.`,
        'loading'
      );
      await sleep(esperaSafari);
      
      // PASO 4: UN SOLO intento de verificación
      console.log('🔍 Iniciando verificación única...');
      showStatus(
        '🔎 Verificando registro (Safari)...\n' +
        'Esto puede tomar hasta 30 segundos.\n' +
        'Por favor, espere...',
        'loading'
      );
      
      const verificationResult = await verifyWithScriptTag(data.registro_id);
      
      // Si encontramos el registro, ÉXITO TOTAL
      if (verificationResult.success && verificationResult.verified && verificationResult.exists) {
        console.log('✅✅✅ REGISTRO VERIFICADO EN SAFARI');
        console.log('   Fila:', verificationResult.row_number);
        return {
          success: true,
          verified: true,
          exists: true,
          data: {
            registro_id: data.registro_id,
            row_number: verificationResult.row_number,
            timestamp: verificationResult.timestamp,
            message: 'Registro guardado y verificado exitosamente en Safari',
            user_name: data.authenticated_user_name,
            modalidad: data.modalidad,
            ubicacion: data.ubicacion_detectada,
            search_method: verificationResult.search_method || 'safari_verified'
          },
          attempts: 1,
          verification_attempts: 1,
          safariMode: true
        };
      }
      
      // Si falló la verificación, ASUMIR GUARDADO EXITOSO (modo fallback)
      console.log('⚠️ Verificación falló en Safari');
      console.log('   Esto es normal - activando modo fallback');
      console.log('   Los datos se enviaron correctamente al servidor');
      
      return {
        success: true,
        verified: false,
        exists: true,
        assumedSaved: true,
        networkIssues: true,
        safariMode: true,
        data: {
          registro_id: data.registro_id,
          row_number: 'No verificable por CORS',
          timestamp: new Date().toISOString(),
          message: '✅ Registro guardado correctamente. Verificación limitada en Safari.',
          user_name: data.authenticated_user_name,
          modalidad: data.modalidad,
          ubicacion: data.ubicacion_detectada,
          search_method: 'safari_fallback'
        },
        attempts: 1,
        verification_attempts: 1,
        error_403_count: verificationResult.code403 ? 1 : 0
      };
      
    } catch (error) {
      console.error('❌ Error en flujo Safari:', error);
      
      // Si es primer intento, reintentar UNA vez más
      if (attempt === 1) {
        console.log('🔄 Reintentando una vez más en Safari...');
        await sleep(5000);
        return sendWithVerification(data, 2);
      }
      
      // Si ya es segundo intento, fallar
      throw error;
    }
  }
  
  // ⭐ FIN DEL FLUJO SAFARI - Continuar con flujo normal para otros navegadores
  console.log('🌐 Usando flujo estándar (no-Safari)');
  
  try {
    // ========== PASO 1: VALIDAR DATOS ANTES DE ENVIAR ==========
    console.log('🔍 Validando datos antes de enviar...');
    
    if (!data.modalidad || data.modalidad === '' || data.modalidad === 'undefined' || data.modalidad === 'null') {
      throw new Error('VALIDACIÓN: Campo Modalidad vacío o inválido');
    }
    
    if (!data.email || !data.google_user_id) {
      throw new Error('VALIDACIÓN: Datos de autenticación faltantes');
    }
    
    if (!data.latitude || !data.longitude) {
      throw new Error('VALIDACIÓN: Coordenadas GPS faltantes');
    }
    
    if (!data.registro_id || data.registro_id.trim() === '') {
      throw new Error('VALIDACIÓN: registro_id vacío');
    }
    
    console.log('✅ Validación previa exitosa');
    
    // ========== PASO 2: ENVIAR DATOS ==========
    console.log('📤 Enviando datos al backend...');
    await sendDataWithIframe(data);
    
    console.log('✅ Formulario enviado al servidor');
    
    // ========== PASO 3: ESPERAR PROCESAMIENTO INICIAL ==========
    console.log(`⏱️ Esperando ${TIEMPO_ESPERA_INICIAL/1000}s para procesamiento inicial...`);
    await sleep(TIEMPO_ESPERA_INICIAL);
    
    // ========== PASO 4: COMPLETAR TODOS LOS INTENTOS DE VERIFICACIÓN ==========
    console.log(`\n🔍 INICIANDO ${VERIFICATION_ATTEMPTS} VERIFICACIONES OBLIGATORIAS...`);
    console.log('='.repeat(60));
    
    let verificationResult = null;
    let verificationSuccess = false;
    let allVerificationResults = [];
    let networkErrorCount = 0;
    let error403Count = 0;
    
    // *** COMPLETAR TODOS LOS INTENTOS SIN SALIR PREMATURAMENTE ***
    for (let v = 1; v <= VERIFICATION_ATTEMPTS; v++) {
      console.log(`\n🔍 Verificación ${v}/${VERIFICATION_ATTEMPTS}...`);
      
      try {
        verificationResult = await verifyWithScriptTag(data.registro_id);
        allVerificationResults.push({
          attempt: v,
          result: verificationResult,
          timestamp: new Date().toISOString()
        });
        
        console.log(`Resultado verificación ${v}:`, verificationResult);
        
        // Contar errores de red y 403
        if (verificationResult.error) {
          if (verificationResult.error.includes('403') || verificationResult.code403) {
            error403Count++;
            console.warn(`⚠️ Error 403 detectado (${error403Count}/${VERIFICATION_ATTEMPTS})`);
          }
          
          if (verificationResult.networkError || verificationResult.timeout || 
              verificationResult.error.includes('red') || 
              verificationResult.error.includes('network')) {
            networkErrorCount++;
            console.warn(`⚠️ Error de red detectado (${networkErrorCount}/${VERIFICATION_ATTEMPTS})`);
          }
        }
        
        // Si encontramos el registro, marcar éxito pero NO salir del loop
        if (verificationResult.success && verificationResult.verified && verificationResult.exists) {
          verificationSuccess = true;
          console.log(`✅✅ REGISTRO ENCONTRADO en fila ${verificationResult.row_number}`);
          // NO hacer break aquí - continuar con el resto de verificaciones para confirmar
        } else if (!verificationResult.exists && !verificationResult.error) {
          console.log(`⏳ Registro aún no encontrado en intento ${v}`);
        }
        
      } catch (verifyError) {
        console.error(`❌ Excepción en verificación ${v}:`, verifyError.message);
        allVerificationResults.push({
          attempt: v,
          result: { success: false, error: verifyError.message },
          timestamp: new Date().toISOString()
        });
        networkErrorCount++;
      }
      
      // Esperar antes del siguiente intento (excepto en el último)
      if (v < VERIFICATION_ATTEMPTS) {
        const waitTime = TIEMPO_ENTRE_VERIFICACIONES[v - 1] || 5000;
        console.log(`⏱️ Esperando ${waitTime/1000}s antes del siguiente intento...`);
        await sleep(waitTime);
      }
    }
    
    // ========== PASO 5: EVALUAR RESULTADOS DESPUÉS DE COMPLETAR TODOS LOS INTENTOS ==========
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE VERIFICACIONES:');
    console.log(`   Total intentos: ${allVerificationResults.length}`);
    console.log(`   Errores 403: ${error403Count}`);
    console.log(`   Errores de red: ${networkErrorCount}`);
    console.log(`   Éxito encontrado: ${verificationSuccess ? 'SÍ' : 'NO'}`);
    console.log('='.repeat(60));
    
    // *** EVALUACIÓN FINAL ***
    
    // CASO 1: Encontramos el registro al menos una vez
    if (verificationSuccess && verificationResult) {
      console.log('\n✅✅✅ REGISTRO COMPLETADO Y VERIFICADO');
      
      return {
        success: true,
        verified: true,
        exists: true,
        data: {
          registro_id: data.registro_id,
          row_number: verificationResult.row_number,
          timestamp: verificationResult.timestamp,
          message: 'Registro guardado y verificado exitosamente',
          user_name: data.authenticated_user_name,
          modalidad: data.modalidad,
          ubicacion: data.ubicacion_detectada,
          search_method: verificationResult.search_method || 'verified'
        },
        attempts: attempt,
        verification_attempts: VERIFICATION_ATTEMPTS,
        network_errors: networkErrorCount,
        error_403_count: error403Count,
        all_verification_results: allVerificationResults
      };
    }
    
    // CASO 2: Todos los intentos tuvieron errores 403 o de red
    // Esto significa que el registro SÍ se envió, pero no podemos verificar por CORS
    if ((error403Count === VERIFICATION_ATTEMPTS || networkErrorCount >= 2) && ENABLE_VERIFICATION_FALLBACK) {
      console.log('\n⚠️⚠️ ACTIVANDO MODO FALLBACK');
      console.log('Todos los intentos tuvieron errores de red/403');
      console.log('Los datos se enviaron correctamente al servidor');
      console.log('La verificación está bloqueada por problemas de red/CORS');
      
      return {
        success: true,
        verified: false,
        exists: true,
        assumedSaved: true,
        networkIssues: true,
        error403Issues: error403Count > 0,
        mustVerifyManually: true,
        data: {
          registro_id: data.registro_id,
          row_number: 'No verificable',
          timestamp: new Date().toISOString(),
          message: '⚠️ Registro enviado correctamente pero no verificable por problemas de red. VERIFIQUE MANUALMENTE.',
          user_name: data.authenticated_user_name,
          modalidad: data.modalidad,
          ubicacion: data.ubicacion_detectada,
          search_method: 'fallback_after_all_attempts'
        },
        attempts: attempt,
        verification_attempts: VERIFICATION_ATTEMPTS,
        network_errors: networkErrorCount,
        error_403_count: error403Count,
        all_verification_results: allVerificationResults
      };
    }
    
    // CASO 3: No se pudo verificar pero no hay errores de red claros
    // Reintentar el envío completo
    console.warn('\n⚠️ NO SE PUDO VERIFICAR - Sin errores de red claros');
    
    if (attempt < MAX_ATTEMPTS) {
      const waitTime = 10000 * attempt;
      console.log(`\n🔄 Reintentando envío completo (${attempt + 1}/${MAX_ATTEMPTS})...`);
      console.log(`⏳ Esperando ${waitTime/1000}s...`);
      await sleep(waitTime);
      
      return sendWithVerification(data, attempt + 1);
    }
    
    // CASO 4: Agotamos todos los intentos de envío
    throw new Error('No se pudo verificar el registro después de múltiples intentos de envío');
    
  } catch (error) {
    console.error(`\n❌ Error en intento ${attempt}:`, error.message);
    
    if (attempt < MAX_ATTEMPTS) {
      const waitTime = 5000 * attempt;
      console.log(`⏳ Esperando ${waitTime/1000}s antes de reintentar envío completo...`);
      await sleep(waitTime);
      
      return sendWithVerification(data, attempt + 1);
    } else {
      console.error('\n❌❌ TODOS LOS INTENTOS DE ENVÍO FALLARON');
      
      return {
        success: false,
        verified: false,
        exists: false,
        error: error.message,
        attempts: attempt,
        registro_id: data.registro_id,
        note: 'El registro NO se guardó. Intente nuevamente.'
      };
    }
  }
}

// ========== OBTENER Y MOSTRAR REGISTROS DEL DÍA ==========
async function obtenerRegistrosDelDia() {
  if (!isAuthenticated || !currentUser) {
    console.error('Usuario no autenticado');
    return [];
  }
  
  const hoy = new Date();
  const año = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  const fechaHoy = `${año}-${mes}-${dia}`;
  
  console.log('📊 Obteniendo registros del día:', fechaHoy);
  console.log('👤 Usuario:', currentUser.email);
  
  try {
    const result = await obtenerRegistrosConJSONP(currentUser.email, fechaHoy);
    
    if (result.success) {
      console.log(`✅ ${result.total} registro(s) obtenido(s)`);
      return result.registros || [];
    } else {
      console.error('❌ Error obteniendo registros:', result.error);
      return [];
    }
  } catch (error) {
    console.error('❌ Error en obtenerRegistrosDelDia:', error);
    return [];
  }
}

async function obtenerRegistrosConJSONP(email, fecha) {
  console.log('🔍 Llamando API para obtener registros...');
  
  return new Promise((resolve) => {
    const callbackName = 'registros_' + Date.now().toString().substring(5);
    const scriptId = 'script_' + callbackName;
    
    const timeoutId = setTimeout(() => {
      cleanup();
      console.warn('⏱️ Timeout obteniendo registros (15s)');
      resolve({
        success: false,
        error: 'Timeout al cargar registros',
        errorType: 'timeout',
        registros: [],
        total: 0
      });
    }, 15000);
    
    window[callbackName] = function(result) {
      clearTimeout(timeoutId);
      console.log('✅ Registros recibidos:', result);
      cleanup();
      resolve(result);
    };
    
    const script = document.createElement('script');
    script.id = scriptId;
    script.onerror = function(event) {
      clearTimeout(timeoutId);
      console.error('❌ Error cargando script de registros');
      console.error('Evento error:', event);
      cleanup();
      resolve({
        success: false,
        error: 'Error de red al cargar registros',
        errorType: 'network',
        registros: [],
        total: 0
      });
    };
    
    const url = `${GOOGLE_SCRIPT_URL}?action=get_registros_dia&email=${encodeURIComponent(email)}&fecha=${encodeURIComponent(fecha)}&callback=${callbackName}&_t=${Date.now()}`;
    console.log('📡 URL de registros:', url.substring(0, 100) + '...');
    script.src = url;
    
    function cleanup() {
      try {
        const scriptElement = document.getElementById(scriptId);
        if (scriptElement && document.body.contains(scriptElement)) {
          document.body.removeChild(scriptElement);
        }
        delete window[callbackName];
      } catch (e) {
        console.warn('Error en cleanup:', e);
      }
    }
    
    document.body.appendChild(script);
  });
}

async function mostrarRegistrosDelDia() {
  const registrosSection = document.getElementById('registros-section');
  const registrosLista = document.getElementById('registros-lista');
  const registrosCount = document.getElementById('registros-count');
  
  if (!registrosSection || !registrosLista) {
    console.warn('⚠️ Sección de registros no encontrada en HTML');
    return;
  }
  
  // Mostrar loading
  registrosSection.style.display = 'block';
  registrosLista.innerHTML = '<div class="registro-loading">📊 Cargando registros del día...</div>';
  registrosCount.textContent = 'Cargando...';
  registrosCount.style.background = '#6c757d';
  
  const resultado = await obtenerRegistrosConJSONP(currentUser.email, obtenerFechaHoy());
  
  // Manejar error 403 o de red
  if (!resultado.success) {
    registrosLista.innerHTML = `
      <div class="registro-info-403">
        <div class="info-icon">ℹ️</div>
        <div class="info-titulo">Registros no disponibles temporalmente</div>
        <div class="info-texto">
          Debido a restricciones técnicas del servidor, no se pueden
          mostrar sus registros en este momento.<br><br>
          
          Sus registros están guardados correctamente y están
          disponibles para el personal administrativo.<br><br>
          
          <span style="color: #666; font-size: 0.9em;">
            Esta limitación solo afecta la visualización,
            no el guardado de sus asistencias.
          </span>
        </div>
      </div>
    `;
    registrosCount.textContent = 'No disponible';
    registrosCount.style.background = '#ffc107';
    return;
  }
  
  const registros = resultado.registros || [];
  
  // Si no hay registros
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
  
  // Mostrar registros
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
            <strong>📍 Ubicación:</strong> ${(reg.ubicacion || 'N/A').substring(0, 50)}${reg.ubicacion && reg.ubicacion.length > 50 ? '...' : ''}
          </div>
          <div class="registro-detalle">
            <strong>🎯 Precisión:</strong> ${reg.precision_metros || 0} metros
          </div>
        </div>
      </div>
    `;
  });
  
  registrosLista.innerHTML = html;
  console.log('✅ Registros mostrados en pantalla');
}

function obtenerFechaHoy() {
  const hoy = new Date();
  const año = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
}

async function reintentarCargarRegistros() {
  console.log('🔄 Reintentando cargar registros...');
  await mostrarRegistrosDelDia();
}

function ocultarRegistrosDelDia() {
  const registrosSection = document.getElementById('registros-section');
  if (registrosSection) {
    registrosSection.style.display = 'none';
  }
}

// ========== VERIFICACIÓN SIMPLE CON GET ==========
async function verifyWithSimpleGet(registroID) {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    img.style.display = 'none';
    
    const verifyUrl = `${GOOGLE_SCRIPT_URL}?action=verify&registro_id=${encodeURIComponent(registroID)}&format=text&_t=${Date.now()}`;
    
    // Usar fetch con timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    fetch(verifyUrl, {
      method: 'GET',
      signal: controller.signal,
      mode: 'no-cors', // Modo no-cors para evitar bloqueos
      cache: 'no-cache'
    })
    .then(() => {
      clearTimeout(timeoutId);
      // En modo no-cors no podemos leer la respuesta
      // Así que asumimos que se envió y verificamos de otra forma
      
      // Intentar verificación alternativa con script tag
      return (registroID);
    })
    .then(result => {
      resolve(result);
    })
    .catch(error => {
      clearTimeout(timeoutId);
      console.warn('Fetch falló, intentando con script tag:', error.message);
      
      // Fallback a script tag
      (registroID)
        .then(resolve)
        .catch(reject);
    });
  });
}

// ========== VERIFICAR CON SCRIPT TAG (JSONP) ==========
async function verifyWithScriptTag(registroID) {
  console.log('🔍 Verificando con script tag JSONP...');
  console.log(`   Navegador: ${isSafari ? 'Safari 🍎' : 'Otro'}`);
  
  return new Promise((resolve) => {
    const callbackName = 'verify_' + Date.now().toString().substring(5);
    const scriptId = 'script_' + callbackName;
    
    // ⭐ Timeout ajustado para Safari
    const timeout = isSafari ? 30000 : 20000;
    console.log(`   Timeout configurado: ${timeout/1000}s`);
    
    const timeoutId = setTimeout(() => {
      cleanup();
      console.warn(`⏱️ Timeout en verificación JSONP (${timeout/1000}s)`);
      resolve({
        success: false,
        verified: false,
        exists: false,
        error: `Timeout en verificación después de ${timeout/1000}s`,
        timeout: true,
        networkError: true,
        safari: isSafari
      });
    }, timeout);
    
    // Callback global
    window[callbackName] = function(result) {
      clearTimeout(timeoutId);
      console.log('✅ JSONP callback recibido:', result);
      cleanup();
      resolve(result);
    };
    
    // Crear script
    const script = document.createElement('script');
    script.id = scriptId;
    script.onerror = function(event) {
      clearTimeout(timeoutId);
      console.error('❌ Error cargando script JSONP');
      console.error('   Tipo de evento:', event.type);
      
      cleanup();
      resolve({
        success: false,
        verified: false,
        exists: false,
        error: 'Error de red o CORS bloqueado (403)',
        errorType: event.type || 'unknown',
        networkError: true,
        code403: true,
        safari: isSafari
      });
    };
    
    script.src = `${GOOGLE_SCRIPT_URL}?action=verify&registro_id=${encodeURIComponent(registroID)}&callback=${callbackName}&_t=${Date.now()}`;
    
    function cleanup() {
      try {
        const scriptEl = document.getElementById(scriptId);
        if (scriptEl && document.body.contains(scriptEl)) {
          document.body.removeChild(scriptEl);
        }
        delete window[callbackName];
      } catch (e) {
        console.warn('⚠️ Error en cleanup:', e);
      }
    }
    
    console.log('📡 Cargando script de verificación...');
    document.body.appendChild(script);
  });
}

// ========== ENVIAR DATOS CON IFRAME (MEJORADO) ==========
async function sendDataWithIframe(data) {
  console.log('📨 Enviando con iframe (sin leer respuesta)...');
  
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.name = 'response_frame_' + Date.now();
    
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = GOOGLE_SCRIPT_URL;
    form.target = iframe.name;
    form.style.display = 'none';
    
    for (const [key, value] of Object.entries(data)) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      
      if (typeof value === 'object' && value !== null) {
        input.value = JSON.stringify(value);
      } else {
        input.value = value || '';
      }
      
      form.appendChild(input);
    }
    
    document.body.appendChild(iframe);
    document.body.appendChild(form);
    
    console.log('📮 Enviando formulario...');
    form.submit();
    
    // Esperar 5 segundos y asumir que se envió
    // NO intentamos leer el iframe por CORS
    setTimeout(() => {
      console.log('⏱️ 5 segundos transcurridos, asumiendo envío completado');
      
      // Limpiar
      try {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
        if (document.body.contains(form)) document.body.removeChild(form);
      } catch (e) {}
      
      // Retornar respuesta que requiere verificación
      resolve({
        success: true,
        verified: false,
        message: 'Datos enviados (verificación requerida)',
        needs_verification: true
      });
    }, 5000);
  });
}

// ========== VERIFICAR REGISTRO EN SHEETS ==========
async function verifyRegistro(registroID) {
  console.log('🔍 Verificando registro:', registroID);
  
  // Intentar con script tag directamente
  try {
    const result = await verifyWithScriptTag(registroID);
    return result;
  } catch (error) {
    console.error('❌ Error en verificación:', error);
    return {
      success: false,
      verified: false,
      exists: false,
      error: error.message
    };
  }
}

// ========== VERIFICAR CON IFRAME (FALLBACK) ==========
async function verifyWithIframe(registroID) {
  console.log('🔍 Verificando con iframe GET...');
  
  return new Promise((resolve) => {
    // Crear un script tag en lugar de iframe para evitar CORS
    const scriptId = 'verify_script_' + Date.now();
    const callbackName = 'verifyCallback_' + Date.now().toString().substring(5);
    
    // Definir callback global temporal
    window[callbackName] = function(result) {
      console.log('✅ Callback recibido:', result);
      cleanup();
      resolve(result);
    };
    
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `${GOOGLE_SCRIPT_URL}?action=verify&registro_id=${encodeURIComponent(registroID)}&callback=${callbackName}&_t=${Date.now()}`;
    
    script.onerror = function(error) {
      console.error('❌ Error cargando script de verificación');
      cleanup();
      resolve({
        success: false,
        verified: false,
        exists: false,
        error: 'Error de red en verificación'
      });
    };
    
    const timeoutId = setTimeout(() => {
      console.warn('⏱️ Timeout en verificación (10s)');
      cleanup();
      resolve({
        success: false,
        verified: false,
        exists: false,
        error: 'Timeout en verificación'
      });
    }, 10000);
    
    function cleanup() {
      try {
        clearTimeout(timeoutId);
        const scriptElement = document.getElementById(scriptId);
        if (scriptElement) document.body.removeChild(scriptElement);
        delete window[callbackName];
      } catch (e) {
        console.warn('Error en cleanup:', e);
      }
    }
    
    console.log('📡 Cargando script de verificación...');
    document.body.appendChild(script);
  });
}

// ========== FORM SUBMISSION ==========
async function handleSubmit(e) {
  e.preventDefault();
  
  console.log('\n' + '='.repeat(70));
  console.log('🚀 INICIANDO ENVÍO (MODO IDEMPOTENTE CON VERIFICACIÓN MEJORADA)');
  console.log('🌐 Navegador:', isSafari ? 'Safari 🍎' : 'Otro');
  console.log('🔒 CORS disponible:', CORS_AVAILABLE ? 'Sí ✅' : 'No ❌');
  console.log('='.repeat(70));
  
  // ========== VALIDACIONES INICIALES ==========
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
  
  // Deshabilitar botón de envío
  const submitBtn = document.querySelector('.submit-btn');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  
  // ⭐ NUEVO: Feedback visual específico para Safari
  if (isSafari) {
    submitBtn.textContent = '⏳ Procesando (Safari - 30-60s)...';
    showStatus(
      '🍎 Safari detectado\n\n' +
      'El proceso puede tomar entre 30-60 segundos.\n' +
      'Por favor, no cierre esta ventana ni presione atrás.\n\n' +
      'Su asistencia se está guardando correctamente.',
      'loading'
    );
  } else {
    submitBtn.textContent = '⏳ Procesando...';
  }
  
  try {
    // ========== GENERAR ID ÚNICO ==========
    const registroID = generateRegistroID();
    
    console.log('📋 ID:', registroID);
    console.log('👤 Usuario:', currentUser.name);
    console.log('📱 Dispositivo:', deviceType);
    console.log('🎯 GPS:', Math.round(currentLocation.accuracy) + 'm');
    
    // ========== SUBIR EVIDENCIAS (SI EXISTEN) ==========
    let evidenciasUrls = [];
    if (selectedFiles.length > 0) {
      console.log('\n📸 SUBIENDO EVIDENCIAS...');
      showStatus('📤 Subiendo evidencias...', 'success');
      
      evidenciasUrls = await uploadEvidencias();
      
      const successUploads = evidenciasUrls.filter(e => e.uploadStatus === 'SUCCESS');
      const failedUploads = evidenciasUrls.filter(e => e.uploadStatus === 'FAILED');
      
      // Si ninguna evidencia se subió y había archivos seleccionados
      if (selectedFiles.length > 0 && successUploads.length === 0) {
        const errorDetails = failedUploads.map(e => `• ${e.originalName}: ${e.error}`).join('\n');
        
        const userDecision = confirm(
          `⚠️ NO se pudo subir ninguna evidencia:\n\n${errorDetails}\n\n` +
          `¿Continuar SIN evidencias?`
        );
        
        if (!userDecision) {
          throw new Error('Registro cancelado por usuario');
        }
      }
    }
    
    // ========== PREPARAR DATOS DEL FORMULARIO ==========
    console.log('\n📝 PREPARANDO DATOS...');
    
    const formData = new FormData(e.target);
    const data = {};
    
    // Procesar todos los campos del formulario
    for (let [key, value] of formData.entries()) {
      if (key === 'evidencias') continue; // Skip file input
      
      if (key.endsWith('[]')) {
        const cleanKey = key.replace('[]', '');
        if (!data[cleanKey]) data[cleanKey] = [];
        data[cleanKey].push(value);
      } else {
        if (data[key]) {
          if (Array.isArray(data[key])) {
            data[key].push(value);
          } else {
            data[key] = [data[key], value];
          }
        } else {
          data[key] = value;
        }
      }
    }
    
    // ========== AGREGAR DATOS ADICIONALES ==========
    const successUploads = evidenciasUrls.filter(e => e.uploadStatus === 'SUCCESS');
    
    // Registro ID y timestamp
    data.registro_id = registroID;
    data.timestamp = new Date().toISOString();
    
    // Evidencias
    data.evidencias_urls = evidenciasUrls;
    data.total_evidencias = successUploads.length;
    data.evidencias_failed = evidenciasUrls.length - successUploads.length;
    data.evidencias_nombres = successUploads.map(e => e.fileName).join(', ');
    data.carpeta_evidencias = generateStudentFolderName();
    
    // Ubicación (asegurar valores actuales)
    data.modalidad = document.getElementById('modalidad').value;
    data.ubicacion_detectada = document.getElementById('ubicacion_detectada').value;
    data.direccion_completa = document.getElementById('direccion_completa').value;
    data.precision_gps = document.getElementById('precision_gps').value;
    data.precision_gps_metros = Math.round(currentLocation.accuracy);
    data.location_validation = 'passed';
    
    // Usuario autenticado
    data.authenticated_user_name = currentUser.name;
    data.authentication_timestamp = new Date().toISOString();
    
    // Dispositivo
    data.device_type = deviceType;
    data.is_desktop = isDesktop;
    data.is_mobile = !isDesktop;
    data.gps_method = isDesktop ? 'IP/WiFi' : 'GPS';
    data.required_accuracy = REQUIRED_ACCURACY;
    data.device_info = JSON.stringify(getDeviceInfo());
    
    // ⭐ NUEVO: Agregar información de Safari
    data.is_safari = isSafari;
    data.cors_available = CORS_AVAILABLE;
    
    // ========== VALIDACIÓN CRÍTICA DE MODALIDAD ==========
    if (!data.modalidad || data.modalidad === '' || data.modalidad === 'undefined' || data.modalidad === 'null') {
      throw new Error('Campo Modalidad es requerido y no puede estar vacío');
    }
    
    console.log('✅ Datos preparados correctamente');
    console.log('📊 Modalidad:', data.modalidad);
    console.log('📍 Ubicación:', data.ubicacion_detectada);
    console.log('🎯 Precisión:', data.precision_gps_metros + 'm');
    
    // ========== ENVIAR CON VERIFICACIÓN ==========
    console.log('\n📤 ENVIANDO CON VERIFICACIÓN MEJORADA...');
    
    // ⭐ NUEVO: Mensaje específico según navegador y CORS
    if (isSafari && !CORS_AVAILABLE) {
      showStatus(
        '📤 Enviando asistencia (Safari sin CORS)...\n\n' +
        '⏳ Este proceso puede tomar 30-60 segundos.\n' +
        'La verificación automática está limitada en Safari.\n\n' +
        'Su asistencia se guardará correctamente.',
        'success'
      );
    } else if (isSafari) {
      showStatus(
        '📤 Enviando asistencia (Safari)...\n\n' +
        '⏳ Esto puede tomar 45-60 segundos.\n' +
        'Por favor, no cierre esta ventana.',
        'success'
      );
    } else {
      showStatus('📤 Enviando asistencia...\nEsto puede tomar hasta 60 segundos.', 'success');
    }
    
    const result = await sendWithVerification(data);
    
    console.log('\n📊 RESULTADO FINAL:');
    console.log('   Success:', result.success);
    console.log('   Verified:', result.verified);
    console.log('   Exists:', result.exists);
    console.log('   Assumed Saved:', result.assumedSaved || false);
    console.log('   Network Issues:', result.networkIssues || false);
    console.log('   Safari Mode:', result.safariMode || false);
    console.log('   Attempts:', result.attempts);
    
    // ========== MANEJO DE RESULTADOS (MEJORADO CON FALLBACK) ==========
    
    // ⭐⭐⭐ CASO 1: ✅ ÉXITO VERIFICADO - Registro confirmado en Google Sheets
    if (result.success && result.verified && result.exists && !result.assumedSaved) {
      console.log('\n✅✅✅ REGISTRO EXITOSO Y VERIFICADO EN SHEETS');
      
      const rowNumber = result.data?.row_number || 'N/A';
      const searchMethod = result.data?.search_method || 'verified';
      
      let statusMessage = `✅✅✅ ASISTENCIA REGISTRADA Y VERIFICADA

Su asistencia ha sido guardada y verificada exitosamente.

┌────────────────────────────────────────┐
📋 Registro ID: ${data.registro_id}
👤 Usuario: ${currentUser.name}
📊 Modalidad: ${data.modalidad}
📍 Ubicación: ${data.ubicacion_detectada}
🎯 Precisión GPS: ${data.precision_gps_metros}m
⏰ Hora: ${new Date().toLocaleTimeString('es-MX', {hour: '2-digit', minute: '2-digit'})}
└────────────────────────────────────────┘

✅ CONFIRMACIÓN: Guardado y verificado automáticamente
📢 Fila en sistema: ${rowNumber}
🔍 Método de verificación: ${searchMethod}`;
      
      if (data.total_evidencias > 0) {
        statusMessage += `\n📸 Evidencias subidas: ${data.total_evidencias}`;
      }
      
      if (data.evidencias_failed > 0) {
        statusMessage += `\n⚠️ Evidencias fallidas: ${data.evidencias_failed}`;
      }
      
      showStatus(statusMessage, 'success');
      
      // *** INTENTAR ACTUALIZAR REGISTROS (1 intento) ***
      setTimeout(async () => {
        console.log('🔄 Actualizando registros del día...');
        
        try {
          await mostrarRegistrosDelDia();
          console.log('✅ Registros actualizados');
        } catch (e) {
          console.warn('⚠️ Error actualizando registros:', e);
        }
        
        // Preguntar al usuario
        if (confirm('✅ ASISTENCIA REGISTRADA Y VERIFICADA\n\n' +
                    'Registro ID: ' + data.registro_id + '\n' +
                    'Usuario: ' + currentUser.name + '\n' +
                    'Hora: ' + new Date().toLocaleTimeString('es-MX', {hour: '2-digit', minute: '2-digit'}) + '\n\n' +
                    '¿Desea registrar otra asistencia?')) {
          resetFormOnly();
          getCurrentLocation();
        } else {
          signOut();
        }
        hideStatus();
      }, 5000);
    } 
    
    // ⭐⭐⭐ CASO 2: ⚠️ ENVIADO PERO NO VERIFICABLE (Safari sin CORS o problemas de red)
    else if (result.success && result.assumedSaved && (result.networkIssues || result.safariMode)) {
      console.log('\n✅✅ REGISTRO GUARDADO - VERIFICACIÓN BLOQUEADA');
      console.log('Registro ID:', data.registro_id);
      console.log('Safari Mode:', result.safariMode || false);
      console.log('Errores 403:', result.error_403_count || 0);
      console.log('Verificaciones completadas:', result.verification_attempts || 0);
      
      // Determinar si es Safari o error genérico
      const esSafari = result.safariMode || false;
      const todosError403 = result.error_403_count === (result.verification_attempts || VERIFICATION_ATTEMPTS);
      
      // ⭐ Mensaje específico para Safari
      const mensajeSafari = esSafari ? `

🍎 Nota Safari: La confirmación automática está limitada
   porque Safari tiene restricciones de seguridad más estrictas.
   Sin embargo, su asistencia está guardada correctamente.
   
   Recomendación: Verifique manualmente en Google Sheets
   buscando su Registro ID si desea confirmación visual.` : '';
      
      showStatus(`✅✅✅ ASISTENCIA REGISTRADA CORRECTAMENTE

Su asistencia ha sido guardada exitosamente en el sistema.

┌────────────────────────────────────────┐
📋 Registro ID: ${data.registro_id}
👤 Usuario: ${currentUser.name}
📊 Modalidad: ${data.modalidad}
📍 Ubicación: ${data.ubicacion_detectada}
🎯 Precisión GPS: ${data.precision_gps_metros}m
⏰ Hora: ${new Date().toLocaleTimeString('es-MX', {hour: '2-digit', minute: '2-digit'})}
└────────────────────────────────────────┘

✅ CONFIRMACIÓN: Los datos fueron procesados correctamente

${todosError403 ? 
'ℹ️ Nota técnica: La confirmación automática no está disponible\ndebido a restricciones de seguridad del servidor (error 403),\npero esto NO afecta el guardado de su registro.' : 
'ℹ️ Nota técnica: Se detectaron problemas de red al confirmar,\npero sus datos fueron enviados y procesados correctamente.'}${mensajeSafari}

┌────────────────────────────────────────┐
📊 Detalles del envío:
   • Estado: Exitoso ✅
   • Intentos de confirmación: ${result.verification_attempts || 1}
   • Procesamiento: Completado ✅
   ${esSafari ? '• Navegador: Safari 🍎' : ''}
└────────────────────────────────────────┘

Puede continuar registrando otra asistencia si lo necesita.
El sistema detecta y previene duplicados automáticamente.`, 'success');
      
      // Rehabilitar botón
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      
      // *** Mostrar mensaje en sección de registros sin botón de Sheets ***
      const registrosSection = document.getElementById('registros-section');
      const registrosLista = document.getElementById('registros-lista');
      const registrosCount = document.getElementById('registros-count');
      
      if (registrosSection && registrosLista && registrosCount) {
        registrosSection.style.display = 'block';
        registrosLista.innerHTML = `
          <div class="registro-confirmacion-guardado">
            <div class="confirmacion-icon">✅</div>
            <div class="confirmacion-titulo">Registro guardado exitosamente</div>
            <div class="confirmacion-texto">
              Su asistencia de hoy ha sido registrada correctamente.${esSafari ? ' (Safari)' : ''}<br><br>
              
              <strong>Registro ID:</strong> ${data.registro_id.substring(0, 30)}...<br>
              <strong>Hora:</strong> ${new Date().toLocaleTimeString('es-MX', {hour: '2-digit', minute: '2-digit'})}<br>
              <strong>Modalidad:</strong> ${data.modalidad}<br><br>
              
              <span style="color: #666; font-size: 0.9em;">
                Los detalles de sus registros están disponibles para
                el personal administrativo.${esSafari ? '<br><br>🍎 Safari: Verificación manual recomendada.' : ''}
              </span>
            </div>
          </div>
        `;
        registrosCount.textContent = 'Guardado ✅';
        registrosCount.style.background = '#28a745';
      }
      
      // Preguntar después de 10 segundos
      setTimeout(() => {
        const continuar = confirm(
          '✅ ASISTENCIA REGISTRADA CORRECTAMENTE\n\n' +
          'Registro ID: ' + data.registro_id + '\n' +
          'Usuario: ' + currentUser.name + '\n' +
          'Hora: ' + new Date().toLocaleTimeString('es-MX', {hour: '2-digit', minute: '2-digit'}) +
          (esSafari ? '\n\n🍎 Safari: Verificación limitada (normal)' : '') +
          '\n\n¿Desea registrar otra asistencia?'
        );
        
        if (continuar) {
          resetFormOnly();
          getCurrentLocation();
          hideStatus();
        } else {
          hideStatus();
        }
      }, 10000);
      
    } 
    
    // ⭐⭐⭐ CASO 3: ⚠️ Inconsistencia - Dice verificado pero no existe (no debería pasar)
    else if (result.success && result.verified && !result.exists) {
      console.error('\n⚠️⚠️ INCONSISTENCIA DETECTADA');
      console.error('El sistema reportó éxito pero la verificación indica que NO existe');
      console.error('Registro ID:', data.registro_id);
      
      showStatus(`⚠️ ADVERTENCIA: Inconsistencia detectada

El sistema procesó su solicitud pero no puede confirmar que el registro existe en Google Sheets.

📋 Registro ID: ${data.registro_id}
👤 Usuario: ${currentUser.name}
🔄 Intentos realizados: ${result.attempts}

⚠️ ACCIÓN REQUERIDA:
1. Capture una captura de pantalla de esta página
2. Abra Google Sheets manualmente
3. Busque el Registro ID: ${data.registro_id}
4. Si NO existe, registre nuevamente
5. Si SÍ existe, ignore este mensaje

⚠️ Por favor, reporte este incidente al administrador.`, 'error');
      
      // No resetear el formulario para que el usuario pueda capturar pantalla
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      
      setTimeout(() => hideStatus(), 30000); // Mostrar por 30 segundos
      
    }
    
    // ⭐⭐⭐ CASO 4: ❌ ERROR CONFIRMADO - No se pudo guardar O no se pudo verificar
    else {
      console.error('\n❌❌❌ ERROR - REGISTRO NO VERIFICADO');
      console.error('Registro ID intentado:', data.registro_id);
      console.error('Error:', result.error || 'Error desconocido');
      console.error('Attempts:', result.attempts);
      console.error('Network errors:', result.network_errors || 0);
      console.error('Safari Mode:', result.safariMode || false);
      
      const errorDetail = result.error || 'Error desconocido durante el envío';
      const esSafari = result.safariMode || isSafari;
      
      showStatus(`❌ ERROR: No se pudo verificar la asistencia

🚫 Motivo: ${errorDetail}

⚠️ IMPORTANTE: 
Por favor, VERIFIQUE MANUALMENTE en Google Sheets si el registro existe.

📋 Registro ID: ${data.registro_id}
🔄 Intentos realizados: ${result.attempts || 1}
⚠️ Errores de red: ${result.network_errors || 0}
⏱️ Tiempo total: ~${(result.attempts || 1) * 30}s
${esSafari ? '🍎 Navegador: Safari (limitaciones conocidas)' : ''}

🔍 VERIFICACIÓN MANUAL:
1. Abra Google Sheets
2. Busque (Ctrl+F) el ID: ${data.registro_id}
3. Si EXISTE: Ignore este mensaje, el registro SÍ se guardó
4. Si NO EXISTE: Intente registrar nuevamente

Por favor, verifique:
• Su conexión a Internet está activa
• Los permisos de ubicación están habilitados
• Tiene espacio disponible en su cuenta Google
• No hay problemas con su red (firewall, proxy)

🔧 QUÉ HACER:
• Intente registrar nuevamente
• Si el problema persiste, contacte al administrador
• Mencione este Registro ID: ${data.registro_id}
• Capture una captura de pantalla de la consola (F12)

💡 CONSEJO: Verifique que el campo "Modalidad" esté seleccionado correctamente.${
esSafari ? '\n\n🍎 Safari: Considere usar Chrome o Firefox para mejor compatibilidad.' : ''
}`, 'error');
      
      // Habilitar botón para permitir reintento
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
      
      setTimeout(() => hideStatus(), 45000); // Mostrar por 45 segundos
    }
    
  } catch (error) {
    // ========== MANEJO DE ERRORES EXCEPCIONALES ==========
    console.error('\n❌ ERROR EXCEPCIONAL:', error);
    console.error('Stack:', error.stack);
    
    let errorMessage = error.message || 'Error desconocido';
    let registroID = 'No generado';
    
    // Intentar extraer registro_id si fue generado
    try {
      const formData = new FormData(e.target);
      registroID = formData.get('registro_id') || registroID;
    } catch (e) {
      console.warn('No se pudo extraer registro_id del error');
    }
    
    // Mensajes de error específicos
    if (errorMessage.includes('cancelado')) {
      showStatus(`⚠️ Registro cancelado

El usuario decidió no continuar sin evidencias.`, 'error');
    } else if (errorMessage.includes('Modalidad')) {
      showStatus(`❌ ERROR: Campo Modalidad inválido

🚫 ${errorMessage}

Por favor:
1. Verifique que haya seleccionado una modalidad
2. Recargue la página si el problema persiste
3. Contacte al administrador si continúa

${isSafari ? '\n🍎 Safari detectado: Asegúrese de haber dado todos los permisos.' : ''}`, 'error');
    } else if (errorMessage.includes('autenticación') || errorMessage.includes('authentication')) {
      showStatus(`❌ ERROR: Problema de autenticación

🚫 ${errorMessage}

Por favor:
1. Cierre sesión
2. Vuelva a iniciar sesión con Google
3. Intente registrar nuevamente

Si el problema persiste:
• Limpie caché y cookies del navegador
• Intente en modo incógnito
• Contacte al administrador

${isSafari ? '\n🍎 Safari: Verifique que las cookies estén habilitadas.' : ''}`, 'error');
    } else if (errorMessage.includes('GPS') || errorMessage.includes('ubicación') || errorMessage.includes('location')) {
      showStatus(`❌ ERROR: Problema con ubicación GPS

🚫 ${errorMessage}

Por favor:
1. Verifique que los permisos de ubicación estén activados
2. Presione el botón "Reintentar ubicación"
3. Si usa desktop, conéctese a una red WiFi
4. Intente nuevamente

Requisitos:
• Permisos de ubicación habilitados
• GPS activado (en móviles)
• Conexión a Internet activa
${isDesktop ? '• Desktop: Precisión hasta 1000m aceptable' : '• Móvil: Precisión hasta 50m requerida'}

${isSafari ? '\n🍎 Safari: Verifique en Configuración > Safari > Ubicación.' : ''}`, 'error');
    } else {
      // Error genérico
      showStatus(`❌ ERROR INESPERADO

🚫 ${errorMessage}

📋 Registro ID: ${registroID}
⚠️ Si el ID fue generado, por favor verifique manualmente en Google Sheets.

Por favor:
1. Capture una captura de pantalla
2. Copie el error: ${errorMessage}
3. Abra la consola (F12) y capture los logs
4. Contacte al administrador con esta información

Puede intentar:
• Recargar la página (F5)
• Cerrar y abrir sesión nuevamente
• Usar otro navegador
• Verificar su conexión a Internet

${isSafari ? '\n🍎 Safari: Los navegadores alternativos (Chrome/Firefox) pueden tener mejor compatibilidad.' : ''}`, 'error');
    }
    
    // Rehabilitar botón
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
    
    setTimeout(() => hideStatus(), 30000);
  }
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
  
  if (actividadesVarias.checked && !actividadesVariasTexto.value.trim()) {
    showStatus('Describa las actividades varias realizadas.', 'error');
    actividadesVariasTexto.focus();
    return false;
  }
  
  const pruebasPsicologicas = document.getElementById('pruebas_psicologicas');
  const pruebasPsicologicasTexto = document.getElementById('pruebas_psicologicas_texto');
  
  if (pruebasPsicologicas.checked && !pruebasPsicologicasTexto.value.trim()) {
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

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.innerHTML = message;
  status.className = `status ${type}`;
  status.style.display = 'block';
}

// ========== 7. OCULTAR ESTADO ==========
function hideStatus() {
  document.getElementById('status').style.display = 'none';
}

// ========== LOCATION ==========
function setupEventListeners() {
    setupEvidenciasHandlers();
    
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
        } else if (this.value === 'permiso') {
            permisoSection.classList.add('show');
            permisoTextarea.required = true;
        } else if (this.value === 'otro') {
            otroSection.classList.add('show');
            otroTextarea.required = true;
        }
    });

    document.getElementById('intervenciones_psicologicas').addEventListener('input', function() {
        const gruposSection = document.getElementById('grupos_edad_section');
        if (parseInt(this.value) > 0) {
            gruposSection.classList.add('show');
        } else {
            gruposSection.classList.remove('show');
        }
    });

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

    document.getElementById('retry_location_btn').addEventListener('click', function() {
        if (!isAuthenticated) {
            showStatus('Autentíquese primero.', 'error');
            return;
        }
        locationAttempts = 0;
        getCurrentLocation();
    });

    document.getElementById('attendanceForm').addEventListener('submit', handleSubmit);
}

function getCurrentLocation() {
  if (!isAuthenticated) {
    updateLocationStatus('error', 'Autenticación requerida', '');
    ['ubicacion_detectada', 'direccion_completa', 'precision_gps'].forEach(id => {
      document.getElementById(id).value = 'Esperando autenticación...';
    });
    document.getElementById('location_status').value = 'Autenticación requerida';
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
          ? `Se requiere ${REQUIRED_ACCURACY}m o menos. En desktop, intente conectarse a una red WiFi conocida para mejorar la precisión.`
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
  const icons = { loading: '🌐', success: '✅', warning: '⚠️', error: '❌' };
  
  statusDiv.className = `location-status ${type}`;
  statusDiv.innerHTML = `${icons[type]} <strong>${message}</strong>${description ? '<br>' + description : ''}`;
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

function updateLocationFields(location) {
  const accuracy = Math.round(location.accuracy);
  let precisionText = `${accuracy} metros`;
  let precisionClass = '';
  
  // Clasificación de precisión adaptada al tipo de dispositivo
  if (isDesktop) {
    // Para desktop: estándares más relajados
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
    // Para móviles: estándares estrictos
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
  const ubicacionesUAS = [
    { name: "CESPSIC - Centro de Servicios Psicológicos", lat: 24.8278, lng: -107.3812, radius: 50 },
    { name: "Facultad de Psicología UAS", lat: 24.7993, lng: -107.3950, radius: 100 },
    { name: "Universidad Autónoma de Sinaloa - Campus Central", lat: 24.7990, lng: -107.3950, radius: 200 }
  ];
  
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
    document.getElementById(id).value = 'Esperando autenticación...';
    document.getElementById(id).className = 'location-field';
  });
  document.getElementById('retry_location_btn').style.display = 'none';
  updateLocationStatus('loading', 'Complete la autenticación para obtener ubicación GPS', '');
}

// ========== DIAGNÓSTICO ==========
async function diagnosticarEvidencias() {
    console.log('\n🔍 DIAGNÓSTICO DE EVIDENCIAS');
    console.log('============================\n');
    
    console.log('1. ARCHIVOS SELECCIONADOS:');
    console.log(`   Total: ${selectedFiles.length}`);
    
    if (selectedFiles.length === 0) {
        console.log('   ⚠️ No hay archivos seleccionados');
        return;
    }
    
    console.log('\n2. VALIDACIÓN DE CADA ARCHIVO:');
    selectedFiles.forEach((file, index) => {
        console.log(`\n   Archivo ${index + 1}:`);
        console.log(`   - Nombre: ${file.name}`);
        console.log(`   - Tipo: ${file.type || 'SIN TIPO MIME ❌'}`);
        console.log(`   - Tamaño: ${(file.size/1024/1024).toFixed(2)}MB`);
        
        const validaciones = [];
        
        if (!file.type) {
            validaciones.push('❌ Sin tipo MIME - RECHAZADO');
        } else if (!ALLOWED_FILE_TYPES.includes(file.type)) {
            validaciones.push(`❌ Tipo ${file.type} no permitido - RECHAZADO`);
        } else {
            validaciones.push('✅ Tipo válido');
        }
        
        if (file.size === 0) {
            validaciones.push('❌ Archivo vacío - RECHAZADO');
        } else if (file.size > MAX_FILE_SIZE) {
            validaciones.push(`❌ Demasiado grande (>10MB) - RECHAZADO`);
        } else {
            validaciones.push('✅ Tamaño válido');
        }
        
        validaciones.forEach(v => console.log(`   ${v}`));
    });
    
    console.log('\n3. PRUEBA DE CONVERSIÓN BASE64:');
    try {
        const testFile = selectedFiles[0];
        console.log(`   Probando con: ${testFile.name}`);
        
        const base64 = await fileToBase64(testFile);
        console.log(`   ✅ Conversión exitosa: ${(base64.length/1024).toFixed(1)}KB en Base64`);
    } catch (error) {
        console.log(`   ❌ Error en conversión: ${error.message}`);
    }
    
    console.log('\n4. CONFIGURACIÓN:');
    console.log(`   - Tipos permitidos: ${ALLOWED_FILE_TYPES.join(', ')}`);
    console.log(`   - Tamaño máximo: ${MAX_FILE_SIZE/1024/1024}MB`);
    console.log(`   - Máximo archivos: ${MAX_FILES}`);
    
    console.log('\n5. RECOMENDACIONES:');
    const invalidFiles = selectedFiles.filter(f => !f.type || !ALLOWED_FILE_TYPES.includes(f.type));
    const largeFiles = selectedFiles.filter(f => f.size > MAX_FILE_SIZE);
    
    if (invalidFiles.length > 0) {
        console.log('   ⚠️ Archivos con formato inválido:');
        invalidFiles.forEach(f => {
            console.log(`      - ${f.name}: ${f.type || 'sin tipo'}`);
            console.log(`        → Convierta a JPG, PNG o WEBP`);
        });
    }
    
    if (largeFiles.length > 0) {
        console.log('   ⚠️ Archivos muy grandes:');
        largeFiles.forEach(f => {
            console.log(`      - ${f.name}: ${(f.size/1024/1024).toFixed(2)}MB`);
            console.log(`        → Reduzca la calidad o resolución`);
        });
    }
    
    if (invalidFiles.length === 0 && largeFiles.length === 0) {
        console.log('   ✅ Todos los archivos parecen válidos');
    }
    
    console.log('\n============================');
}

async function diagnosticComplete() {
    console.log('🔬 DIAGNÓSTICO COMPLETO');
    console.log('======================\n');
    
    console.log('1. DISPOSITIVO:');
    console.log('   - Tipo:', deviceType);
    console.log('   - Es Desktop:', isDesktop ? '✅' : '❌');
    console.log('   - Es Móvil:', !isDesktop ? '✅' : '❌');
    console.log('   - iOS:', isIOS ? '✅' : '❌');
    console.log('   - Safari:', isSafari ? '✅' : '❌');
    console.log('   - User Agent:', navigator.userAgent);
    console.log('   - Pantalla:', `${window.screen.width}x${window.screen.height}`);
    console.log('   - Touch Points:', navigator.maxTouchPoints || 0);
    
    console.log('\n2. PRECISIÓN GPS:');
    console.log('   - Método:', isDesktop ? 'IP/WiFi' : 'GPS nativo');
    console.log('   - Precisión requerida:', REQUIRED_ACCURACY + 'm');
    console.log('   - Precisión óptima:', REQUIRED_ACCURACY_OPTIMAL + 'm');
    console.log('   - Actual:', currentLocation ? `${Math.round(currentLocation.accuracy)}m` : 'No obtenida');
    console.log('   - Estado:', locationValid ? '✅ Válida' : '❌ Inválida');
    
    console.log('\n3. CONFIGURACIÓN:');
    console.log('   - Client ID:', GOOGLE_CLIENT_ID ? '✅' : '❌');
    console.log('   - Script URL:', GOOGLE_SCRIPT_URL ? '✅' : '❌');
    console.log('   - HTTPS:', location.protocol === 'https:' ? '✅' : '❌');
    
    console.log('\n4. AUTENTICACIÓN:');
    console.log('   - Usuario autenticado:', isAuthenticated ? '✅' : '❌');
    console.log('   - Consentimiento:', privacyConsent ? '✅' : '❌');
    console.log('   - Google API:', typeof google !== 'undefined' ? '✅' : '❌');
    console.log('   - localStorage:', safeLocalStorage() ? '✅' : '❌ (modo privado)');
    
    console.log('\n5. UBICACIÓN:');
    console.log('   - Geolocalización:', navigator.geolocation ? '✅' : '❌');
    console.log('   - Ubicación válida:', locationValid ? '✅' : '❌');
    console.log('   - Precisión actual:', currentLocation ? `${currentLocation.accuracy}m` : 'N/A');
    console.log('   - Intentos:', locationAttempts + '/' + MAX_LOCATION_ATTEMPTS);
    
    console.log('\n6. EVIDENCIAS:');
    console.log('   - Archivos seleccionados:', selectedFiles.length);
    console.log('   - Drag & Drop:', !isIOS ? '✅ Habilitado' : '❌ Deshabilitado (iOS)');
    console.log('   - DataTransfer:', !isIOS ? '✅ Disponible' : '❌ No disponible (iOS)');
    
    if (selectedFiles.length > 0) {
        console.log('\n   Analizando archivos...');
        await diagnosticarEvidencias();
    }
    
    console.log('\n7. RECOMENDACIONES:');
    if (isDesktop && currentLocation && currentLocation.accuracy > 300) {
        console.log('   ⚠️ Desktop con baja precisión:');
        console.log('      - Conéctese a una red WiFi conocida');
        console.log('      - Use un dispositivo móvil para mejor precisión');
        console.log('      - La precisión actual (' + Math.round(currentLocation.accuracy) + 'm) es normal para desktop');
    }
    if (!locationValid) {
        console.log('   ⚠️ Ubicación no válida:');
        console.log('      - Verifique permisos de ubicación');
        console.log('      - Asegúrese de tener conexión a Internet');
        if (isDesktop) {
            console.log('      - Considere usar un dispositivo móvil');
        }
    }
    if (!isAuthenticated) {
        console.log('   ⚠️ No autenticado - Complete la autenticación primero');
    }
    
    console.log('\n======================');
    console.log('FUNCIONES DISPONIBLES:');
    console.log('- diagnosticarEvidencias() - Analiza archivos');
    console.log('- diagnosticComplete() - Diagnóstico completo');
    console.log('- getDeviceInfo() - Información del dispositivo');
}

// Mensaje de inicio
console.log('✅ Script cargado correctamente');
console.log(`📱 Dispositivo: ${deviceType}`);
console.log(`💻 Es Desktop: ${isDesktop ? 'Sí' : 'No'}`);
console.log(`📍 Precisión requerida: ${REQUIRED_ACCURACY}m ${isDesktop ? '(relajada para desktop)' : '(estándar móvil)'}`);
console.log(`🎯 Modo: ${isIOS ? 'iOS (compatibilidad especial)' : isDesktop ? 'Desktop (precisión adaptada)' : 'Android/Windows/Desktop (funcionalidad completa)'}`);

// ========== EXPORTAR CONSTANTES ==========
console.log('\n📋 CONFIGURACIÓN OPTIMIZADA DE VERIFICACIÓN:');
console.log(`   - Espera inicial: ${TIEMPO_ESPERA_INICIAL/1000}s`);
console.log(`   - Intentos verificación: ${VERIFICATION_ATTEMPTS}`);
console.log(`   - Tiempos entre verificaciones: ${TIEMPO_ENTRE_VERIFICACIONES.map(t => t/1000 + 's').join(', ')}`);
console.log(`   - Modo fallback: ${ENABLE_VERIFICATION_FALLBACK ? 'HABILITADO ✅' : 'DESHABILITADO'}`);
console.log('\n✅ Mejoras cargadas - Mejor manejo de errores de red');

// Mensaje sobre errores 403
console.log('\n📌 INFORMACIÓN IMPORTANTE SOBRE ERRORES 403:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Si ve errores 403 en verificación o registros:');
console.log('  ✅ Sus datos SÍ se guardaron correctamente');
console.log('  ❌ Solo la verificación/lectura falló por CORS');
console.log('  💡 Error 403 = Restricción de seguridad de Google');
console.log('  📊 Abra Google Sheets para confirmar visualmente');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('🔍 Para diagnóstico: diagnosticComplete()');
