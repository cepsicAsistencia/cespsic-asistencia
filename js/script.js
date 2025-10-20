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

//PRODUCCION
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyllBO0vTORygvLlbTeRWfNXz1_Dt1khrM2z_BUxbNM6jWqEGYDqaLnd7LJs9Fl9Q9X/exec';
const GOOGLE_CLIENT_ID = '799841037062-kal4vump3frc2f8d33bnp4clc9amdnng.apps.googleusercontent.com';
//PRUEBAS
//const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw10UgiYsuGYi16MisVfk7fx-wlGU-gUmCKTz2bZmyqys_2ku1ghZ9zzv71UncZ_sXlDg/exec';
//const GOOGLE_CLIENT_ID = '154864030871-ck4l5krb7qm68kmp6a7rcq7h072ldm6g.apps.googleusercontent.com';

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

// Inicializar aplicación
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
    if (!currentUser) {
        console.warn('⚠️ Usuario no autenticado al registrar privacidad');
        throw new Error('Usuario no autenticado');
    }
    
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
    
    console.log('📤 Datos de privacidad a enviar:', privacyData);
    
    try {
        const response = await sendDataWithFallback(privacyData);
        console.log('✅ Respuesta del servidor (privacidad):', response);
        return response;
    } catch (error) {
        console.error('❌ Error enviando datos de privacidad:', error);
        throw error;
    }
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
            cancel_on_tap_outside: true
        });
        
        google.accounts.id.disableAutoSelect();
        google.accounts.id.cancel();
        
        console.log('✅ Google Sign-In inicializado correctamente');
    } catch (error) {
        console.error('❌ Error inicializando Google Sign-In:', error);
        showStatus('Error cargando sistema de autenticación: ' + error.message, 'error');
    }
}

function proceedWithGoogleSignIn() {
    console.log('🔐 Iniciando proceso de autenticación...');
    
    try {
        // ✅ MÉTODO DIRECTO: Solo mostrar botón en modal
        showGoogleButtonInModal();
        
    } catch (error) {
        console.error('❌ Error en autenticación:', error);
        showStatus('Error al iniciar autenticación: ' + error.message, 'error');
    }
}

function showGoogleButtonInModal() {
    // Remover modal existente si hay
    const existingModal = document.getElementById('google-auth-modal');
    if (existingModal) existingModal.remove();
    
    // Crear modal
    const modal = document.createElement('div');
    modal.id = 'google-auth-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease-out;
    `;
    
    const container = document.createElement('div');
    container.style.cssText = `
        background: white;
        padding: 40px;
        border-radius: 15px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        text-align: center;
        max-width: 400px;
        width: 90%;
        animation: slideUp 0.3s ease-out;
    `;
    
    container.innerHTML = `
        <div style="margin-bottom: 20px;">
            <svg width="48" height="48" viewBox="0 0 48 48" style="margin-bottom: 15px;">
                <path fill="#4285F4" d="M24 9.5c3.9 0 6.9 1.7 8.5 3.1l6.3-6.3C34.7 2.3 29.8 0 24 0 14.6 0 6.7 5.7 3.1 13.9l7.4 5.7C12.2 13.3 17.6 9.5 24 9.5z"/>
                <path fill="#34A853" d="M46.1 24.5c0-1.5-.1-3-.4-4.5H24v9h12.7c-.6 3.1-2.3 5.7-4.9 7.5l7.4 5.7c4.3-4 6.9-9.9 6.9-17.7z"/>
                <path fill="#FBBC05" d="M10.5 28.5c-.6-1.7-.9-3.5-.9-5.5s.3-3.8.9-5.5L3.1 11.8C1.1 15.7 0 20.2 0 25s1.1 9.3 3.1 13.2l7.4-5.7z"/>
                <path fill="#EA4335" d="M24 48c5.8 0 10.7-1.9 14.3-5.2l-7.4-5.7c-1.9 1.3-4.4 2.1-6.9 2.1-6.4 0-11.8-4.3-13.7-10.1l-7.4 5.7C6.7 42.3 14.6 48 24 48z"/>
            </svg>
            <h3 style="margin: 0 0 10px 0; color: #333; font-size: 20px;">Iniciar Sesión</h3>
            <p style="margin: 0 0 20px 0; color: #666; font-size: 14px;">
                Autentíquese con su cuenta de Google para continuar
            </p>
        </div>
        <div id="google-signin-button" style="display: flex; justify-content: center; margin-bottom: 20px;"></div>
        <button id="cancel-auth-btn" style="
            padding: 10px 20px;
            background: #f5f5f5;
            border: 1px solid #ddd;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            color: #666;
        ">Cancelar</button>
    `;
    
    modal.appendChild(container);
    document.body.appendChild(modal);
    
    // Renderizar botón de Google
    setTimeout(() => {
        const buttonDiv = document.getElementById('google-signin-button');
        if (buttonDiv) {
            try {
                google.accounts.id.renderButton(buttonDiv, {
                    theme: 'filled_blue',
                    size: 'large',
                    text: 'signin_with',
                    shape: 'rectangular',
                    width: 280
                });
                console.log('✅ Botón de Google renderizado');
            } catch (renderError) {
                console.error('❌ Error renderizando botón:', renderError);
                buttonDiv.innerHTML = '<p style="color: #dc3545;">Error al cargar botón de Google. Recargue la página.</p>';
            }
        }
    }, 100);
    
    // Botón cancelar
    document.getElementById('cancel-auth-btn').onclick = () => {
        closeAuthModal();
        if (privacyConsent && !isAuthenticated) {
            privacyConsent = false;
            updatePrivacyUI();
            showStatus('Debe completar la autenticación para continuar.', 'error');
            setTimeout(() => hideStatus(), 5000);
        }
    };
    
    // Cerrar con Escape
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeAuthModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
    
    // Cerrar al hacer clic fuera
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeAuthModal();
        }
    };
}

function triggerGoogleSignIn() {
    try {
        google.accounts.id.prompt();
    } catch (error) {
        console.error('Error activando Google Sign-In:', error);
        alert('No se pudo iniciar la autenticación. Por favor, recargue la página.');
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
        console.log('🔐 Credencial recibida de Google');
        closeAuthModal();
        
        if (!response || !response.credential) {
            throw new Error('Credencial inválida recibida de Google');
        }
        
        const userInfo = parseJwt(response.credential);
        
        if (!userInfo) {
            throw new Error('No se pudo decodificar la credencial');
        }
        
        console.log('✅ Usuario decodificado:', userInfo.email);
        
        currentUser = {
            id: userInfo.sub,
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture,
            email_verified: userInfo.email_verified
        };

        if (!currentUser.email_verified) {
            showStatus('Su cuenta de Gmail no está verificada. Por favor verifique su correo.', 'error');
            return;
        }

        if (authenticationPurpose === 'revoke') {
            await handleRevocationFlow();
        } else {
            await handleLoginFlow();
        }
    } catch (error) {
        console.error('❌ Error procesando credenciales:', error);
        showStatus('Error en la autenticación: ' + error.message, 'error');
        closeAuthModal();
        
        // Si era para login, revertir consentimiento
        if (authenticationPurpose === 'login' && privacyConsent && !isAuthenticated) {
            privacyConsent = false;
            updatePrivacyUI();
        }
    }
}

function closeAuthModal() {
    const modal = document.getElementById('google-auth-modal');
    if (modal) {
        modal.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => modal.remove(), 300);
    }
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
        
        // ✅ REGISTRAR ACCIÓN DE PRIVACIDAD CON MEJOR MANEJO DE ERRORES
        try {
            console.log('📤 Enviando acción de privacidad al servidor...');
            const privacyResponse = await recordPrivacyAction('PRIVACY_ACCEPTED');
            console.log('✅ Respuesta de privacidad:', privacyResponse);
        } catch (privacyError) {
            console.warn('⚠️ No se pudo registrar la acción de privacidad en el servidor:', privacyError);
            // ⚠️ NO detener el flujo, solo advertir
        }
        
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

function processResponse(responseText) {
    let responseData;
    try {
        responseData = JSON.parse(responseText);
        
        // ✅ VALIDAR RESPUESTA EXPLÍCITAMENTE
        if (responseData.success === true) {
            console.log('✅ Respuesta exitosa del servidor');
            responseReceived = true;
            cleanup();
            resolve(responseData);
        } else {
            // ❌ Error explícito del servidor
            console.error('❌ Error del servidor:', responseData.message);
            cleanup();
            reject(new Error(responseData.message || 'Error desconocido del servidor'));
        }
        
    } catch (parseError) {
        console.error('❌ Error parseando respuesta JSON:', parseError);
        console.log('Respuesta recibida:', responseText.substring(0, 200));
        
        // ✅ Si no es JSON válido pero hay texto, asumir éxito parcial
        if (responseText.length > 10) {
            console.warn('⚠️ Respuesta no es JSON válido, pero hay contenido');
            responseReceived = true;
            cleanup();
            resolve({
                success: true,
                message: 'Datos enviados (formato de respuesta no estándar)',
                row_number: 'Verificar en Google Sheets',
                sheet_verified: false,
                raw_response: responseText.substring(0, 100)
            });
        } else {
            cleanup();
            reject(new Error('Formato de respuesta inválido del servidor'));
        }
    }
}

async function sendDataWithFallback(data) {
    console.log('📤 Enviando datos al servidor...');
    
    return new Promise((resolve, reject) => {
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
        
        let responseReceived = false;
        let timeoutId;
        
        iframe.onload = function() {
            try {
                setTimeout(() => {
                    try {
                        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                        let responseText = '';
                        
                        if (iframeDoc && iframeDoc.body) {
                            responseText = iframeDoc.body.textContent || iframeDoc.body.innerText || '';
                        }
                        
                        console.log('📥 Respuesta del servidor:', responseText);
                        
                        // ✅ MEJORADO: Permitir respuestas vacías para ciertas acciones
                        if (!responseText || responseText.trim() === '') {
                            console.warn('⚠️ Respuesta vacía del servidor');
                            
                            // Para acciones de privacidad, aceptar respuesta vacía como éxito
                            if (data.action === 'record_privacy_action') {
                                console.log('ℹ️ Acción de privacidad - asumiendo éxito');
                                responseReceived = true;
                                cleanup();
                                resolve({
                                    success: true,
                                    message: 'Acción registrada',
                                    local_only: true
                                });
                                return;
                            }
                            
                            // Para registros de asistencia, esperar un poco más
                            console.log('⏳ Esperando 3 segundos adicionales para respuesta de asistencia...');
                            setTimeout(() => {
                                try {
                                    const retryDoc = iframe.contentDocument || iframe.contentWindow.document;
                                    const retryText = retryDoc?.body?.textContent || retryDoc?.body?.innerText || '';
                                    
                                    if (retryText && retryText.trim() !== '') {
                                        console.log('✅ Respuesta obtenida en segundo intento:', retryText);
                                        processResponse(retryText);
                                    } else {
                                        console.warn('⚠️ Sin respuesta después de espera adicional');
                                        // ✅ CAMBIO CRÍTICO: Asumir éxito si los datos se enviaron
                                        responseReceived = true;
                                        cleanup();
                                        resolve({
                                            success: true,
                                            message: 'Asistencia registrada (verificación del servidor pendiente)',
                                            row_number: 'Verificar en Google Sheets',
                                            sheet_verified: false,
                                            warning: 'El servidor no confirmó, pero los datos fueron enviados'
                                        });
                                    }
                                } catch (retryError) {
                                    console.error('Error en reintento:', retryError);
                                    cleanup();
                                    reject(new Error('No se pudo obtener confirmación del servidor'));
                                }
                            }, 3000);
                            return;
                        }
                        
                        processResponse(responseText);
                        
                    } catch (error) {
                        console.error('❌ Error procesando respuesta del iframe:', error);
                        cleanup();
                        reject(new Error('No se pudo procesar la respuesta del servidor: ' + error.message));
                    }
                }, 2000);
                
            } catch (error) {
                console.error('❌ Error en onload del iframe:', error);
                cleanup();
                reject(new Error('Error de comunicación con el servidor: ' + error.message));
            }
        };
        
        iframe.onerror = function(error) {
            console.error('❌ Error en iframe:', error);
            cleanup();
            reject(new Error('Error de red al conectar con el servidor. Verifique su conexión a Internet.'));
        };
        
        timeoutId = setTimeout(() => {
            if (!responseReceived) {
                console.error('⏱️ Timeout: El servidor no respondió en 15 segundos');
                cleanup();
                reject(new Error('El servidor tardó demasiado en responder (>15s). Intente nuevamente.'));
            }
        }, 15000);
        
        function cleanup() {
            try {
                clearTimeout(timeoutId);
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
                if (document.body.contains(form)) {
                    document.body.removeChild(form);
                }
            } catch (e) {
                console.log('Error en cleanup:', e);
            }
        }
        
        document.body.appendChild(iframe);
        document.body.appendChild(form);
        
        console.log('🚀 Enviando formulario...');
        form.submit();
    });
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

// ========== FORM SUBMISSION ==========
async function handleSubmit(e) {
    e.preventDefault();
    
    if (!isAuthenticated || !currentUser) {
        showStatus('❌ Debe autenticarse con Google primero.', 'error');
        return;
    }
    
    if (!locationValid || !currentLocation) {
        showStatus('❌ Ubicación GPS requerida. Complete la autenticación.', 'error');
        return;
    }
    
    if (currentLocation.accuracy > REQUIRED_ACCURACY) {
        const deviceTypeText = isDesktop ? 'Desktop/Laptop' : 'Móvil';
        showStatus(`❌ Precisión GPS insuficiente: ${Math.round(currentLocation.accuracy)}m > ${REQUIRED_ACCURACY}m (${deviceTypeText})`, 'error');
        return;
    }
    
    document.getElementById('timestamp').value = new Date().toISOString();
    
    if (!validateConditionalFields()) {
        return;
    }
    
    showStatus('💾 Guardando asistencia...', 'success');
    const submitBtn = document.querySelector('.submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Guardando...';
    
    try {
        console.log('\n🚀 INICIANDO ENVÍO DE FORMULARIO');
        console.log(`📱 Tipo dispositivo: ${deviceType}`);
        console.log(`💻 Es Desktop: ${isDesktop}`);
        console.log(`📍 Precisión GPS: ${Math.round(currentLocation.accuracy)}m`);
        console.log(`📁 Archivos seleccionados: ${selectedFiles.length}`);
        
        // FASE 1: SUBIR EVIDENCIAS
        let evidenciasUrls = [];
        if (selectedFiles.length > 0) {
            console.log('\n📤 FASE 1: SUBIENDO EVIDENCIAS...');
            showStatus('📤 Subiendo evidencias...', 'success');
            
            try {
                evidenciasUrls = await uploadEvidencias();
                
                const successUploads = evidenciasUrls.filter(e => e.uploadStatus === 'SUCCESS');
                const failedUploads = evidenciasUrls.filter(e => e.uploadStatus === 'FAILED');
                
                console.log(`📊 Resultado: ${successUploads.length} éxito, ${failedUploads.length} fallos`);
                
                if (selectedFiles.length > 0 && successUploads.length === 0) {
                    const errorDetails = failedUploads.map(e => `• ${e.originalName}: ${e.error}`).join('\n');
                    
                    console.error('\n❌ TODAS LAS EVIDENCIAS FALLARON:');
                    console.error(errorDetails);
                    
                    const userDecision = confirm(
                        `⚠️ NO se pudo subir ninguna evidencia:\n\n${errorDetails}\n\n` +
                        `¿Desea continuar registrando la asistencia SIN evidencias?\n\n` +
                        `• Clic en "Aceptar" = Continuar sin evidencias\n` +
                        `• Clic en "Cancelar" = Reintentar o corregir archivos`
                    );
                    
                    if (!userDecision) {
                        throw new Error('Registro cancelado por el usuario. Revise los archivos e intente nuevamente.');
                    }
                    
                    console.log('⚠️ Usuario decidió continuar sin evidencias');
                } else if (failedUploads.length > 0) {
                    console.warn(`⚠️ ${failedUploads.length} evidencia(s) no se subieron`);
                }
            } catch (uploadError) {
                console.error('❌ Error crítico subiendo evidencias:', uploadError);
                throw new Error('Error al subir evidencias: ' + uploadError.message);
            }
        }
        
        console.log('\n📝 FASE 2: PREPARANDO DATOS DEL FORMULARIO...');
        
        const formData = new FormData(e.target);
        const data = {};
        
        for (let [key, value] of formData.entries()) {
            if (key === 'evidencias') continue;
            
            if (key.endsWith('[]')) {
                const cleanKey = key.replace('[]', '');
                if (!data[cleanKey]) {
                    data[cleanKey] = [];
                }
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
        
        const successUploads = evidenciasUrls.filter(e => e.uploadStatus === 'SUCCESS');
        
        data.evidencias_urls = evidenciasUrls;
        data.total_evidencias = successUploads.length;
        data.evidencias_failed = evidenciasUrls.length - successUploads.length;
        
        const evidenciasNombres = successUploads
            .map(e => e.fileName)
            .join(', ');
        
        data.evidencias_nombres = evidenciasNombres;
        data.carpeta_evidencias = generateStudentFolderName();
        
        data.modalidad = document.getElementById('modalidad').value;
        data.ubicacion_detectada = document.getElementById('ubicacion_detectada').value;
        data.direccion_completa = document.getElementById('direccion_completa').value;
        data.precision_gps = document.getElementById('precision_gps').value;
        data.precision_gps_metros = Math.round(currentLocation.accuracy);
        data.location_validation = 'passed';
        data.authenticated_user_name = currentUser.name;
        data.authentication_timestamp = new Date().toISOString();
        
        // DATOS DE DISPOSITIVO
        data.device_type = deviceType;
        data.is_desktop = isDesktop;
        data.is_mobile = !isDesktop;
        data.gps_method = isDesktop ? 'IP/WiFi' : 'GPS';
        data.required_accuracy = REQUIRED_ACCURACY;
        data.device_info = JSON.stringify(getDeviceInfo());
        
        if (!data.modalidad || data.modalidad === '') {
            throw new Error('El campo Modalidad es requerido');
        }
        
        console.log('\n📤 FASE 3: ENVIANDO FORMULARIO PRINCIPAL...');
        console.log(`   Usuario: ${currentUser.name}`);
        console.log(`   Dispositivo: ${deviceType}`);
        console.log(`   Modalidad: ${data.modalidad}`);
        console.log(`   Método GPS: ${data.gps_method}`);
        console.log(`   Precisión: ${data.precision_gps_metros}m`);
        console.log(`   Evidencias exitosas: ${data.total_evidencias}`);
        
        showStatus('⏳ Enviando al servidor...', 'success');
        
        // ENVÍO CON MANEJO DE ERRORES ROBUSTO
        let responseData;
        try {
            console.log('🔄 Llamando a sendDataWithFallback...');
            responseData = await sendDataWithFallback(data);
            console.log('✅ RESPUESTA DEL SERVIDOR:', responseData);
            console.log('   - success:', responseData?.success);
            console.log('   - row_number:', responseData?.row_number);
            console.log('   - message:', responseData?.message);
        } catch (sendError) {
            console.error('❌ ERROR EN ENVÍO:', sendError);
            console.error('   - Nombre:', sendError.name);
            console.error('   - Mensaje:', sendError.message);
            console.error('   - Stack:', sendError.stack);
            throw new Error('Error de conexión: ' + sendError.message);
        }
        
        // VALIDAR RESPUESTA
        if (!responseData) {
            console.error('❌ responseData es null o undefined');
            throw new Error('No se recibió respuesta del servidor. Verifique su conexión.');
        }
        
        console.log('\n🔍 VALIDANDO RESPUESTA...');
        console.log('   - Tipo de responseData:', typeof responseData);
        console.log('   - success:', responseData.success);
        console.log('   - row_number:', responseData.row_number);
        console.log('   - sheet_verified:', responseData.sheet_verified);
        
        // Aceptar success: true O row_number presente O warning presente (envío exitoso pero sin confirmación)
        if (responseData.success === true || responseData.row_number || responseData.warning) {
            console.log('✅ REGISTRO ACEPTADO COMO EXITOSO');
            
            const rowNumber = responseData.row_number || 'Verificar manualmente en Google Sheets';
            const sheetVerified = responseData.sheet_verified === true;
            
            const evidenciasInfo = data.total_evidencias > 0 
                ? `\n✅ Evidencias: ${data.total_evidencias} imagen(es)${data.evidencias_failed > 0 ? ` (${data.evidencias_failed} no se pudieron subir)` : ''}`
                : selectedFiles.length > 0 
                    ? `\n⚠️ Evidencias: No se pudo subir ninguna (registrado sin evidencias)`
                    : '';
            
            const verificationWarning = !sheetVerified || responseData.warning
                ? '\n⚠️ El servidor no confirmó el número de fila. Por favor, verifique manualmente en Google Sheets.' 
                : '';
            
            showStatus(`✅ ¡Asistencia registrada exitosamente!
            Usuario: ${currentUser.name}
            Dispositivo: ${deviceType}
            Modalidad: ${data.modalidad}
            Ubicación: ${data.ubicacion_detectada}
            Precisión: ${data.precision_gps_metros}m
            📋 Fila en Google Sheets: ${rowNumber}${evidenciasInfo}${verificationWarning}`, 'success');
            
            setTimeout(() => {
                if (confirm('¿Desea registrar otra asistencia?')) {
                    resetFormOnly();
                    getCurrentLocation();
                } else {
                    signOut();
                }
                hideStatus();
            }, 8000);
            
        } else {
            // Respuesta indica fallo explícito
            const errorMsg = responseData.message || 'Error desconocido del servidor';
            console.error('❌ REGISTRO FALLIDO:', errorMsg);
            throw new Error(errorMsg);
        }
        
    } catch (error) {
        console.error('\n❌ ERROR EN ENVÍO DE FORMULARIO:', error);
        console.error('   - Tipo:', error.name);
        console.error('   - Mensaje:', error.message);
        console.error('   - Stack:', error.stack);
        
        // MOSTRAR ERROR DETALLADO AL USUARIO
        let userMessage = '❌ Error al guardar la asistencia:\n\n';
        
        if (error.message.includes('conexión') || error.message.includes('red') || error.message.includes('Internet')) {
            userMessage += '🌐 Problema de conexión a Internet.\n';
            userMessage += 'Verifique su conexión y vuelva a intentar.';
        } else if (error.message.includes('servidor') || error.message.includes('timeout') || error.message.includes('respondió')) {
            userMessage += '⏱️ El servidor no respondió correctamente.\n';
            userMessage += 'Esto puede deberse a:\n';
            userMessage += '• Conexión lenta\n';
            userMessage += '• Servidor sobrecargado\n';
            userMessage += '• Problemas temporales de Google\n\n';
            userMessage += 'IMPORTANTE: Verifique en Google Sheets si el registro se guardó antes de intentar nuevamente.';
        } else if (error.message.includes('Sheet') || error.message.includes('fila')) {
            userMessage += '📊 Error con Google Sheets.\n';
            userMessage += 'Contacte al administrador del sistema.';
        } else if (error.message.includes('evidencias')) {
            userMessage += '📷 ' + error.message;
        } else if (error.message.includes('cancelado')) {
            userMessage += '🚫 ' + error.message;
        } else {
            userMessage += error.message || 'Error desconocido';
            userMessage += '\n\nContacte al administrador si el problema persiste.';
        }
        
        showStatus(userMessage, 'error');
        
        submitBtn.disabled = false;
        submitBtn.textContent = '📋 Registrar Asistencia';
        submitBtn.style.background = 'linear-gradient(45deg, #667eea, #764ba2)';
        
        // No ocultar el error automáticamente
        setTimeout(() => {
            const shouldHide = confirm(
                'El registro NO se completó (o no se pudo confirmar).\n\n' +
                'IMPORTANTE: Antes de reintentar, verifique en Google Sheets si el registro ya existe.\n\n' +
                '¿Desea cerrar este mensaje?\n\n' +
                'Clic en "Aceptar" = Cerrar mensaje\n' +
                'Clic en "Cancelar" = Mantener mensaje visible'
            );
            if (shouldHide) {
                hideStatus();
            }
        }, 3000);
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
    const icons = { loading: '🌍', success: '✅', warning: '⚠️', error: '❌' };
    
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

// ========== ANIMACIONES CSS ==========
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
    
    @keyframes slideUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    #cancel-auth-btn:hover {
        background: #e0e0e0 !important;
        border-color: #bbb !important;
    }
`;
document.head.appendChild(style);

console.log('✅ Sistema de autenticación corregido cargado');
// Mensaje de inicio
console.log('✅ Script cargado correctamente');
console.log(`📱 Dispositivo: ${deviceType}`);
console.log(`💻 Es Desktop: ${isDesktop ? 'Sí' : 'No'}`);
console.log(`📍 Precisión requerida: ${REQUIRED_ACCURACY}m ${isDesktop ? '(relajada para desktop)' : '(estándar móvil)'}`);
console.log(`🎯 Modo: ${isIOS ? 'iOS (compatibilidad especial)' : isDesktop ? 'Desktop (precisión adaptada)' : 'Android/Windows/Desktop (funcionalidad completa)'}`);
console.log('🔍 Para diagnóstico: diagnosticComplete()');
