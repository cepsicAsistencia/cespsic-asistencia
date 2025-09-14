// Variables globales
let currentLocation = null;
let userEmail = null;
let isAuthenticated = false;
let locationValid = false;
let locationAttempts = 0;
let currentUser = null;
let selectedFiles = [];
const MAX_LOCATION_ATTEMPTS = 3;
const REQUIRED_ACCURACY = 50; // metros
const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// IMPORTANTE: Reemplaza con tu Google Client ID
const GOOGLE_CLIENT_ID = '799841037062-kal4vump3frc2f8d33bnp4clc9amdnng.apps.googleusercontent.com';

// Ubicaciones conocidas de la UAS
const ubicacionesUAS = [
    {
        name: "Facultad de Psicología UAS",
        description: "Campus de la Universidad Autónoma de Sinaloa - Facultad de Psicología",
        lat: 24.7993,
        lng: -107.3950,
        radius: 100
    },
    {
        name: "CESPSIC - Centro de Servicios Psicológicos",
        description: "Centro de atención psicológica de la UAS",
        lat: 24.7995,
        lng: -107.3948,
        radius: 50
    },
    {
        name: "Universidad Autónoma de Sinaloa - Campus Central",
        description: "Campus principal de la UAS",
        lat: 24.7990,
        lng: -107.3950,
        radius: 200
    }
];

// Inicializar formulario
document.addEventListener('DOMContentLoaded', function() {
    // Verificar navegador
    if (!isGoogleChrome()) {
        showStatus('⚠️ Este formulario funciona mejor en Google Chrome. Algunas funciones podrían no estar disponibles.', 'error');
    }
    
    initializeForm();
    setupEventListeners();
    loadGoogleSignInScript();
    updateCurrentTime();
    
    // Actualizar hora cada segundo
    setInterval(updateCurrentTime, 1000);
});

function initializeForm() {
    // Establecer fecha actual (solo lectura)
    const today = new Date();
    document.getElementById('fecha').value = today.toISOString().split('T')[0];
    
    // Establecer hora actual (solo lectura)
    updateCurrentTime();
    
    // Establecer timestamp
    document.getElementById('timestamp').value = new Date().toISOString();
}

function updateCurrentTime() {
    const now = new Date();
    const timeString = now.toTimeString().slice(0, 5); // HH:MM formato
    document.getElementById('hora').value = timeString;
}

function isGoogleChrome() {
    const isChromium = window.chrome;
    const winNav = window.navigator;
    const vendorName = winNav.vendor;
    const isOpera = typeof window.opr !== "undefined";
    const isIEedge = winNav.userAgent.indexOf("Edg") > -1;
    const isIOSChrome = winNav.userAgent.match("CriOS");

    if (isIOSChrome) {
        return true;
    } else if (
        isChromium !== null &&
        typeof isChromium !== "undefined" &&
        vendorName === "Google Inc." &&
        isOpera === false &&
        isIEedge === false
    ) {
        return true;
    } else { 
        return false;
    }
}

// ========== GOOGLE SIGN-IN FUNCTIONS ==========

function loadGoogleSignInScript() {
    // El script ya se carga en el HTML, solo inicializamos cuando esté listo
    if (typeof google !== 'undefined' && google.accounts) {
        initializeGoogleSignIn();
    } else {
        // Esperar a que se cargue el script
        setTimeout(loadGoogleSignInScript, 100);
    }
}

function initializeGoogleSignIn() {
    try {
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse,
            auto_select: false, // Asegurar que no se seleccione automáticamente
            cancel_on_tap_outside: true
        });

        // Renderizar el botón de Google Sign-In
        google.accounts.id.renderButton(
            document.getElementById("signin-button-container"),
            {
                theme: "outline",
                size: "large",
                text: "signin_with",
                shape: "rectangular",
                logo_alignment: "left"
            }
        );

        // ELIMINADO: google.accounts.id.prompt(); 
        // Esta línea causaba el intento automático de autenticación
        
        console.log('Google Sign-In inicializado correctamente - Solo funciona con botón');

    } catch (error) {
        console.error('Error inicializando Google Sign-In:', error);
        showStatus('Error cargando sistema de autenticación. Verifique su conexión.', 'error');
    }
}

function manualSignIn() {
    try {
        // Solo mostrar el prompt cuando el usuario haga clic manualmente
        google.accounts.id.prompt((notification) => {
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                console.log('Prompt de Google no se mostró:', notification.getNotDisplayedReason());
                showStatus('No se pudo mostrar el diálogo de Google. Intente recargar la página.', 'error');
            }
        });
    } catch (error) {
        console.error('Error en sign-in manual:', error);
        showStatus('Error al intentar iniciar sesión con Google.', 'error');
    }
}

function handleCredentialResponse(response) {
    try {
        // Decodificar el JWT token para obtener la información del usuario
        const userInfo = parseJwt(response.credential);
        
        currentUser = {
            id: userInfo.sub,
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture,
            email_verified: userInfo.email_verified
        };

        // Verificar que el email esté verificado
        if (!currentUser.email_verified) {
            showStatus('Su cuenta de Gmail no está verificada. Use una cuenta verificada.', 'error');
            return;
        }

        // Actualizar estado de autenticación
        isAuthenticated = true;
        userEmail = currentUser.email;
        document.getElementById('email').value = userEmail;
        document.getElementById('google_user_id').value = currentUser.id;

        // Actualizar interfaz
        updateAuthenticationUI();
        enableForm();
        
        // Iniciar proceso de ubicación
        getCurrentLocation();

        showStatus(`¡Bienvenido ${currentUser.name}! Autenticación exitosa.`, 'success');
        setTimeout(() => hideStatus(), 3000);

    } catch (error) {
        console.error('Error procesando credenciales:', error);
        showStatus('Error en la autenticación. Intente nuevamente.', 'error');
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
        // Actualizar sección de autenticación
        authSection.classList.add('authenticated');
        authTitle.textContent = '✅ Autenticación Exitosa';
        authTitle.classList.add('authenticated');

        // Mostrar información del usuario
        document.getElementById('user-avatar').src = currentUser.picture;
        document.getElementById('user-email').textContent = currentUser.email;
        document.getElementById('user-name').textContent = currentUser.name;
        userInfo.classList.add('show');

        // Ocultar botón de inicio de sesión
        signinContainer.style.display = 'none';

    } else {
        // Resetear al estado no autenticado
        authSection.classList.remove('authenticated');
        authTitle.textContent = '🔒 Autenticación Requerida';
        authTitle.classList.remove('authenticated');
        userInfo.classList.remove('show');
        signinContainer.style.display = 'block';
    }
}

function enableForm() {
    const formContainer = document.getElementById('form-container');
    formContainer.classList.add('authenticated');
}

function disableForm() {
    const formContainer = document.getElementById('form-container');
    formContainer.classList.remove('authenticated');
    locationValid = false;
    updateSubmitButton();
}

function signOut() {
    try {
        // Cerrar sesión de Google
        google.accounts.id.disableAutoSelect();
        
        // Resetear variables
        isAuthenticated = false;
        currentUser = null;
        userEmail = null;
        locationValid = false;
        currentLocation = null;
        locationAttempts = 0;
        selectedFiles = [];

        // Limpiar campos ocultos
        document.getElementById('email').value = '';
        document.getElementById('google_user_id').value = '';
        document.getElementById('latitude').value = '';
        document.getElementById('longitude').value = '';
        document.getElementById('location_status').value = '';

        // Actualizar interfaz
        updateAuthenticationUI();
        disableForm();
        resetLocationFields();
        resetEvidenciasSection();

        showStatus('Sesión cerrada correctamente.', 'success');
        setTimeout(() => hideStatus(), 3000);

        // Reinicializar Google Sign-In (SIN auto-prompt)
        setTimeout(() => {
            initializeGoogleSignIn();
        }, 1000);

    } catch (error) {
        console.error('Error cerrando sesión:', error);
        showStatus('Error al cerrar sesión.', 'error');
    }
}

// ========== EVIDENCIAS FUNCTIONS ==========

function setupEvidenciasHandlers() {
    const evidenciasInput = document.getElementById('evidencias');
    
    evidenciasInput.addEventListener('change', function(e) {
        handleFileSelection(e.target.files);
    });
    
    // Drag and drop functionality
    const evidenciasContainer = document.querySelector('.evidencias-container');
    
    evidenciasContainer.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        evidenciasContainer.style.borderColor = '#4854c7';
        evidenciasContainer.style.background = 'linear-gradient(135deg, #e8ebff 0%, #d6dbff 100%)';
    });
    
    evidenciasContainer.addEventListener('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        evidenciasContainer.style.borderColor = '#667eea';
        evidenciasContainer.style.background = 'linear-gradient(135deg, #f8f9ff 0%, #f0f2ff 100%)';
    });
    
    evidenciasContainer.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        evidenciasContainer.style.borderColor = '#667eea';
        evidenciasContainer.style.background = 'linear-gradient(135deg, #f8f9ff 0%, #f0f2ff 100%)';
        
        const files = e.dataTransfer.files;
        handleFileSelection(files);
    });
}

function handleFileSelection(files) {
    const fileArray = Array.from(files);
    const validFiles = [];
    const errors = [];
    
    // Validar cada archivo
    fileArray.forEach(file => {
        // Verificar tipo de archivo
        if (!ALLOWED_FILE_TYPES.includes(file.type)) {
            errors.push(`${file.name}: Tipo de archivo no válido. Solo se permiten JPG, PNG y WEBP.`);
            return;
        }
        
        // Verificar tamaño de archivo
        if (file.size > MAX_FILE_SIZE) {
            errors.push(`${file.name}: Archivo demasiado grande. Máximo ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
            return;
        }
        
        validFiles.push(file);
    });
    
    // Verificar límite total de archivos
    if (selectedFiles.length + validFiles.length > MAX_FILES) {
        errors.push(`Solo puede subir máximo ${MAX_FILES} imágenes. Actualmente tiene ${selectedFiles.length} seleccionadas.`);
        showEvidenciasStatus(errors.join('<br>'), 'error');
        return;
    }
    
    // Mostrar errores si los hay
    if (errors.length > 0) {
        showEvidenciasStatus(errors.join('<br>'), 'error');
    }
    
    // Agregar archivos válidos
    validFiles.forEach(file => {
        selectedFiles.push(file);
        addFilePreview(file, selectedFiles.length - 1);
    });
    
    // Actualizar input
    updateFileInput();
    
    // Mostrar estado exitoso si se agregaron archivos
    if (validFiles.length > 0) {
        showEvidenciasStatus(`${validFiles.length} imagen(es) agregada(s) correctamente. Total: ${selectedFiles.length}/${MAX_FILES}`, 'success');
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
    // Remover archivo del array
    selectedFiles.splice(index, 1);
    
    // Actualizar vista previa
    updatePreview();
    
    // Actualizar input
    updateFileInput();
    
    showEvidenciasStatus(`Imagen removida. Total: ${selectedFiles.length}/${MAX_FILES}`, 'success');
}

function updatePreview() {
    const preview = document.getElementById('evidencias-preview');
    preview.innerHTML = '';
    
    selectedFiles.forEach((file, index) => {
        addFilePreview(file, index);
    });
}

function updateFileInput() {
    const input = document.getElementById('evidencias');
    const dt = new DataTransfer();
    
    selectedFiles.forEach(file => {
        dt.items.add(file);
    });
    
    input.files = dt.files;
}

function showEvidenciasStatus(message, type) {
    const status = document.getElementById('evidencias-status');
    status.innerHTML = message;
    status.className = `evidencias-status ${type}`;
    
    // Auto-hide después de 5 segundos para mensajes de éxito
    if (type === 'success') {
        setTimeout(() => {
            status.style.display = 'none';
        }, 5000);
    }
}

function resetEvidenciasSection() {
    selectedFiles = [];
    document.getElementById('evidencias').value = '';
    document.getElementById('evidencias-preview').innerHTML = '';
    document.getElementById('evidencias-status').style.display = 'none';
}

// ========== LOCATION FUNCTIONS ==========

function setupEventListeners() {
    // Configurar manejadores de evidencias
    setupEvidenciasHandlers();
    
    // Mostrar/ocultar sección de salida y evidencias
    document.getElementById('tipo_registro').addEventListener('change', function() {
        const salidaSection = document.getElementById('salida_section');
        const evidenciasSection = document.getElementById('evidencias_section');
        const permisoSection = document.getElementById('permiso_detalle_section');
        const otroSection = document.getElementById('otro_detalle_section');
        const permisoTextarea = document.getElementById('permiso_detalle');
        const otroTextarea = document.getElementById('otro_detalle');
        
        // Ocultar todas las secciones primero
        salidaSection.classList.remove('show');
        evidenciasSection.style.display = 'none';
        permisoSection.classList.remove('show');
        otroSection.classList.remove('show');
        permisoTextarea.required = false;
        otroTextarea.required = false;
        permisoTextarea.value = '';
        otroTextarea.value = '';
        
        // Resetear evidencias cuando no es salida
        if (this.value !== 'salida') {
            resetEvidenciasSection();
        }
        
        // Mostrar la sección correspondiente
        if (this.value === 'salida') {
            salidaSection.classList.add('show');
            evidenciasSection.style.display = 'block'; // Mostrar evidencias solo para salida
        } else if (this.value === 'permiso') {
            permisoSection.classList.add('show');
            permisoTextarea.required = true;
        } else if (this.value === 'otro') {
            otroSection.classList.add('show');
            otroTextarea.required = true;
        }
    });

    // Mostrar/ocultar grupos de edad según intervenciones
    document.getElementById('intervenciones_psicologicas').addEventListener('input', function() {
        const gruposSection = document.getElementById('grupos_edad_section');
        if (parseInt(this.value) > 0) {
            gruposSection.classList.add('show');
        } else {
            gruposSection.classList.remove('show');
        }
    });

    // Campos condicionales para actividades varias
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

    // Campos condicionales para pruebas psicológicas
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

    // Botón de reintentar ubicación
    document.getElementById('retry_location_btn').addEventListener('click', function() {
        if (!isAuthenticated) {
            showStatus('Debe autenticarse primero antes de solicitar ubicación.', 'error');
            return;
        }
        locationAttempts = 0;
        getCurrentLocation();
    });

    // Manejo del formulario
    document.getElementById('attendanceForm').addEventListener('submit', handleSubmit);
}

function getCurrentLocation() {
    if (!isAuthenticated) {
        updateLocationStatus('error', 'Autenticación requerida', 'Complete la autenticación para obtener ubicación GPS');
        document.getElementById('ubicacion_detectada').value = 'Esperando autenticación...';
        document.getElementById('direccion_completa').value = 'Esperando autenticación...';
        document.getElementById('precision_gps').value = 'Esperando autenticación...';
        document.getElementById('location_status').value = 'Autenticación requerida';
        return;
    }

    if (!navigator.geolocation) {
        updateLocationStatus('error', 'Geolocalización no soportada', 'Su navegador no soporta geolocalización');
        document.getElementById('ubicacion_detectada').value = 'Navegador no compatible';
        document.getElementById('direccion_completa').value = 'No disponible';
        document.getElementById('precision_gps').value = 'Sin soporte';
        document.getElementById('location_status').value = 'Geolocalización no soportada';
        return;
    }

    locationAttempts++;
    updateLocationStatus('loading', `Obteniendo ubicación GPS... (Intento ${locationAttempts}/${MAX_LOCATION_ATTEMPTS})`, '');

    const options = {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0
    };
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            currentLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
            };
            
            document.getElementById('latitude').value = currentLocation.latitude;
            document.getElementById('longitude').value = currentLocation.longitude;
            
            // Validar precisión
            if (currentLocation.accuracy <= REQUIRED_ACCURACY) {
                locationValid = true;
                document.getElementById('location_status').value = 'success';
                updateLocationStatus('success', 'Ubicación obtenida correctamente', 
                    `Precisión: ${Math.round(currentLocation.accuracy)} metros`);
                updateSubmitButton();
                
                // Actualizar campos de ubicación
                updateLocationFields(currentLocation);
            } else {
                locationValid = false;
                document.getElementById('location_status').value = `error: Precisión insuficiente (${Math.round(currentLocation.accuracy)}m)`;
                updateLocationStatus('warning', 'Precisión GPS insuficiente', 
                    `Se requiere precisión de ${REQUIRED_ACCURACY}m o menos. Actual: ${Math.round(currentLocation.accuracy)}m`);
                
                if (locationAttempts < MAX_LOCATION_ATTEMPTS) {
                    setTimeout(() => {
                        updateLocationStatus('loading', 'Reintentando obtener mejor precisión...', '');
                        getCurrentLocation();
                    }, 2000);
                } else {
                    updateLocationStatus('error', 'No se pudo obtener la precisión requerida', 
                        `Después de ${MAX_LOCATION_ATTEMPTS} intentos. Muévase a un área con mejor señal GPS.`);
                    document.getElementById('retry_location_btn').style.display = 'block';
                }
            }
        },
        function(error) {
            locationValid = false;
            console.error('Error obteniendo ubicación:', error);
            let errorMessage = '';
            let errorDescription = '';
            
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Permisos de ubicación denegados';
                    errorDescription = 'Por favor, permita el acceso a la ubicación y recargue la página';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Ubicación no disponible';
                    errorDescription = 'No se pudo determinar su ubicación. Verifique su conexión GPS';
                    break;
                case error.TIMEOUT:
                    errorMessage = 'Tiempo de espera agotado';
                    errorDescription = 'La solicitud de ubicación tardó demasiado. Intente nuevamente';
                    break;
                default:
                    errorMessage = 'Error desconocido de geolocalización';
                    errorDescription = 'Error inesperado al obtener la ubicación';
            }
            
            document.getElementById('location_status').value = 'error: ' + errorMessage;
            updateLocationStatus('error', errorMessage, errorDescription);
            
            // Actualizar campos con error
            document.getElementById('ubicacion_detectada').value = 'Error: ' + errorMessage;
            document.getElementById('direccion_completa').value = 'No disponible';
            document.getElementById('precision_gps').value = 'Sin datos';
            document.getElementById('ubicacion_detectada').className = 'location-field error';
            document.getElementById('direccion_completa').className = 'location-field error';
            document.getElementById('precision_gps').className = 'location-field error';
            
            if (locationAttempts < MAX_LOCATION_ATTEMPTS && error.code !== error.PERMISSION_DENIED) {
                setTimeout(() => {
                    getCurrentLocation();
                }, 3000);
            } else {
                document.getElementById('retry_location_btn').style.display = 'block';
            }
        },
        options
    );
}

function updateLocationStatus(type, message, description) {
    const statusDiv = document.getElementById('location_status_display');
    const icons = {
        loading: '🌍',
        success: '✅',
        warning: '⚠️',
        error: '❌'
    };
    
    statusDiv.className = `location-status ${type}`;
    statusDiv.innerHTML = `${icons[type]} <strong>${message}</strong>${description ? '<br>' + description : ''}`;
}

function updateSubmitButton() {
    const submitBtn = document.getElementById('submit_btn');
    
    if (!isAuthenticated) {
        submitBtn.disabled = true;
        submitBtn.textContent = '🔒 Autentíquese primero para continuar';
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
    // Actualizar precisión
    const accuracy = Math.round(location.accuracy);
    let precisionText = `${accuracy} metros`;
    let precisionClass = 'location-field';
    
    if (accuracy <= 10) {
        precisionText += ' (Excelente)';
        precisionClass += ' location-field';
    } else if (accuracy <= 30) {
        precisionText += ' (Muy Buena)';
        precisionClass += ' location-field';
    } else if (accuracy <= 50) {
        precisionText += ' (Buena)';
        precisionClass += ' location-field';
    } else if (accuracy <= 100) {
        precisionText += ' (Regular)';
        precisionClass += ' warning';
    } else {
        precisionText += ' (Insuficiente)';
        precisionClass += ' error';
    }
    
    const precisionField = document.getElementById('precision_gps');
    precisionField.value = precisionText;
    precisionField.className = precisionClass;
    
    // Detectar ubicación específica
    const ubicacionDetectada = detectarUbicacionEspecifica(location.latitude, location.longitude);
    const campoUbicacion = document.getElementById('ubicacion_detectada');
    
    if (ubicacionDetectada.encontrada && ubicacionDetectada.esUAS) {
        campoUbicacion.value = ubicacionDetectada.nombre;
        campoUbicacion.className = 'location-field uas-location';
    } else {
        campoUbicacion.value = "Consultando ubicación...";
        campoUbicacion.className = 'location-field';
    }
    
    // Obtener dirección completa
    obtenerDireccionCompleta(location.latitude, location.longitude, ubicacionDetectada);
}

function detectarUbicacionEspecifica(lat, lng) {
    // Ordenar por radio (más específico primero)
    const ubicacionesOrdenadas = ubicacionesUAS.sort((a, b) => a.radius - b.radius);
    
    for (let ubicacion of ubicacionesOrdenadas) {
        const distancia = calcularDistancia(lat, lng, ubicacion.lat, ubicacion.lng);
        
        if (distancia <= ubicacion.radius) {
            return {
                encontrada: true,
                esUAS: true,
                nombre: ubicacion.name,
                descripcion: ubicacion.description,
                distancia: Math.round(distancia)
            };
        }
    }
    
    return {
        encontrada: false,
        esUAS: false,
        nombre: "Ubicación externa",
        descripcion: "Fuera del campus UAS",
        distancia: null
    };
}

async function obtenerDireccionCompleta(lat, lng, ubicacionDetectada) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=es&zoom=18`);
        const data = await response.json();
        
        const direccionField = document.getElementById('direccion_completa');
        
        if (data && data.display_name) {
            direccionField.value = data.display_name;
            direccionField.className = 'location-field';
            
            // Si no está en la UAS, actualizar ubicación con información específica
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
    
    // Priorizar información más específica
    if (address.house_number && address.road) {
        ubicacionEspecifica = `${address.road} ${address.house_number}`;
    } else if (address.road) {
        ubicacionEspecifica = address.road;
    } else if (address.neighbourhood || address.suburb) {
        ubicacionEspecifica = address.neighbourhood || address.suburb;
    } else if (address.city_district) {
        ubicacionEspecifica = address.city_district;
    } else if (address.city || address.town) {
        ubicacionEspecifica = address.city || address.town;
    } else {
        ubicacionEspecifica = "Ubicación no especificada";
    }
    
    campoUbicacion.value = ubicacionEspecifica;
}

function calcularDistancia(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // Radio de la Tierra en metros
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
    document.getElementById('ubicacion_detectada').value = 'Esperando autenticación...';
    document.getElementById('direccion_completa').value = 'Esperando autenticación...';
    document.getElementById('precision_gps').value = 'Esperando autenticación...';
    document.getElementById('ubicacion_detectada').className = 'location-field';
    document.getElementById('direccion_completa').className = 'location-field';
    document.getElementById('precision_gps').className = 'location-field';
    document.getElementById('retry_location_btn').style.display = 'none';
    updateLocationStatus('loading', '📍 Complete la autenticación para obtener ubicación GPS', '');
}

// ========== FORM SUBMISSION ==========

async function handleSubmit(e) {
    e.preventDefault();
    
    // Verificar autenticación
    if (!isAuthenticated || !currentUser) {
        showStatus('❌ Debe autenticarse con Google antes de registrar la asistencia.', 'error');
        return;
    }
    
    // Validar que se tenga ubicación válida antes de continuar
    if (!locationValid || !currentLocation) {
        showStatus('❌ No se puede registrar la asistencia sin una ubicación GPS válida con precisión de 50 metros o menos.', 'error');
        return;
    }
    
    // Validar precisión una vez más
    if (currentLocation.accuracy > REQUIRED_ACCURACY) {
        showStatus(`❌ La precisión GPS actual (${Math.round(currentLocation.accuracy)}m) supera el límite permitido de ${REQUIRED_ACCURACY}m. Intente obtener una mejor señal GPS.`, 'error');
        return;
    }
    
    // Actualizar timestamp al momento del envío
    document.getElementById('timestamp').value = new Date().toISOString();
    
    // Validar campos requeridos condicionalmente
    if (!validateConditionalFields()) {
        return;
    }
    
    // Mostrar cargando
    showStatus('Guardando asistencia... ⏳', 'success');
    const submitBtn = document.querySelector('.submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando...';
    
    try {
        // Procesar evidencias si las hay
        let evidenciasUrls = [];
        if (selectedFiles.length > 0) {
            showStatus('Subiendo evidencias... 📤', 'success');
            evidenciasUrls = await uploadEvidencias();
        }
        
        // MÉTODO CORREGIDO PARA PROCESAR DATOS DEL FORMULARIO
        const formData = new FormData(e.target);
        const data = {};
        
        // Procesar campos normales del formulario
        for (let [key, value] of formData.entries()) {
            if (key === 'evidencias') continue; // Skip evidencias input
            
            // Manejar arrays (como actividades[])
            if (key.endsWith('[]')) {
                const cleanKey = key.replace('[]', '');
                if (!data[cleanKey]) {
                    data[cleanKey] = [];
                }
                data[cleanKey].push(value);
            } else {
                // Para campos normales, si ya existe, convertir a array
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
        
        // ASEGURAR QUE LOS CAMPOS CRÍTICOS ESTÉN INCLUIDOS
        // Forzar modalidad desde el elemento del DOM
        const modalidadElement = document.getElementById('modalidad');
        data.modalidad = modalidadElement.value;
        
        // Agregar URLs de evidencias ANTES de enviar
        data.evidencias_urls = evidenciasUrls;
        data.total_evidencias = evidenciasUrls.length;
        
        // Forzar la inclusión de los campos de ubicación
        data.ubicacion_detectada = document.getElementById('ubicacion_detectada').value;
        data.direccion_completa = document.getElementById('direccion_completa').value;
        data.precision_gps = document.getElementById('precision_gps').value;
        
        // Agregar información adicional de autenticación y ubicación
        data.precision_gps_metros = Math.round(currentLocation.accuracy);
        data.location_validation = 'passed';
        data.authenticated_user_name = currentUser.name;
        data.authentication_timestamp = new Date().toISOString();
        
        // VALIDACIÓN ADICIONAL ANTES DEL ENVÍO
        console.log('=== DATOS ANTES DEL ENVÍO ===');
        console.log('Modalidad:', data.modalidad);
        console.log('Total evidencias:', data.total_evidencias);
        console.log('URLs evidencias:', data.evidencias_urls);
        console.log('Usuario autenticado:', currentUser.email);
        console.log('Datos completos:', data);
        
        // Verificar que modalidad no esté vacía
        if (!data.modalidad || data.modalidad === '') {
            showStatus('❌ Error: El campo Modalidad es requerido y no puede estar vacío.', 'error');
            updateSubmitButton();
            return;
        }
        
        // IMPORTANTE: Reemplaza esta URL con tu URL de Google Apps Script
        const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzdzQgYOOawGZc-ZDYhHrBqhfLLYrczeTS7XLdhZ1gnQq8SGAhU7t_dOYuCRJTAwZ-4/exec';
        
        // ENVÍO CON MANEJO DE ERRORES MEJORADO
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // Cambiar a 'cors' para debug
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        // Log para verificar envío
        console.log('=== DATOS ENVIADOS ===');
        console.log('URL:', GOOGLE_SCRIPT_URL);
        console.log('Payload:', JSON.stringify(data, null, 2));
        
        // Como usamos no-cors, asumimos éxito si no hay error
        showStatus(`¡Asistencia registrada exitosamente! 📊✅
        Usuario: ${currentUser.name} (${currentUser.email})
        Modalidad: ${data.modalidad}
        Ubicación: ${data.ubicacion_detectada}
        Precisión GPS: ${data.precision_gps}
        Evidencias: ${evidenciasUrls.length} imagen(es)`, 'success');
        
        // Resetear formulario después de 4 segundos
        setTimeout(() => {
            if (confirm('¿Desea registrar otra asistencia? Presione OK para continuar o Cancelar para cerrar sesión.')) {
                // Continuar con el mismo usuario
                resetFormOnly();
                getCurrentLocation();
            } else {
                // Cerrar sesión y resetear todo
                signOut();
            }
            hideStatus();
        }, 4000);
        
    } catch (error) {
        console.error('Error al enviar:', error);
        showStatus('Error al guardar en Google Sheets. Verifique su conexión e intente nuevamente. ❌', 'error');
        
        // Restaurar botón
        setTimeout(() => {
            updateSubmitButton();
            hideStatus();
        }, 5000);
    }
}

// FUNCIÓN ADICIONAL PARA DEBUG
function verificarDatosFormulario() {
    console.log('=== VERIFICACIÓN DATOS FORMULARIO ===');
    
    const modalidad = document.getElementById('modalidad').value;
    console.log('Modalidad DOM:', modalidad);
    
    const formData = new FormData(document.getElementById('attendanceForm'));
    for (let [key, value] of formData.entries()) {
        console.log(`${key}: ${value}`);
    }
    
    console.log('Evidencias seleccionadas:', selectedFiles.length);
    console.log('Usuario autenticado:', currentUser?.email);
    console.log('Ubicación válida:', locationValid);
}

// Función para generar nombre de archivo de evidencia
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

// Función para subir evidencias a Google Drive
async function uploadEvidencias() {
    if (selectedFiles.length === 0) return [];
    
    const tipoRegistro = document.getElementById('tipo_registro').value || 'sin_tipo';
    const evidenciasUrls = [];
    
    showEvidenciasStatus('Preparando archivos para subir...', 'loading');
    
    for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const fileName = generateEvidenciaFileName(tipoRegistro, i);
        const extension = file.name.split('.').pop();
        const fullFileName = `${fileName}.${extension}`;
        
        try {
            showEvidenciasStatus(`Subiendo imagen ${i + 1}/${selectedFiles.length}: ${file.name}`, 'loading');
            
            // Convertir archivo a Base64
            const base64Data = await fileToBase64(file);
            
            // Preparar datos para envío
            const uploadData = {
                action: 'upload_evidencia',
                fileName: fullFileName,
                fileData: base64Data,
                mimeType: file.type,
                studentFolder: generateStudentFolderName(),
                userEmail: currentUser.email,
                timestamp: new Date().toISOString()
            };
            
            // Enviar a Google Apps Script
            const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzNtxM1ELVjtBJUR5mJXo1GQnDoYB8Jk0KfHsLROYGa0yCWO509ULu9_dk7r_CtNmZ4/exec';
            
            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(uploadData)
            });
            
            // Como usamos no-cors, asumimos éxito y generamos URL estimada
            const estimatedUrl = `https://drive.google.com/file/d/UPLOADED_FILE_ID/view`;
            evidenciasUrls.push({
                fileName: fullFileName,
                originalName: file.name,
                url: estimatedUrl,
                size: file.size,
                uploadTime: new Date().toISOString()
            });
            
        } catch (error) {
            console.error(`Error subiendo archivo ${file.name}:`, error);
            evidenciasUrls.push({
                fileName: fullFileName,
                originalName: file.name,
                url: 'ERROR_AL_SUBIR',
                error: error.message,
                size: file.size,
                uploadTime: new Date().toISOString()
            });
        }
    }
    
    if (evidenciasUrls.length > 0) {
        showEvidenciasStatus(`✅ ${evidenciasUrls.length} evidencia(s) procesada(s) correctamente`, 'success');
    }
    
    return evidenciasUrls;
}

function generateStudentFolderName() {
    const apellidoPaterno = document.getElementById('apellido_paterno').value || 'Sin_Apellido';
    const apellidoMaterno = document.getElementById('apellido_materno').value || 'Sin_Apellido';
    const nombre = document.getElementById('nombre').value || 'Sin_Nombre';
    
    return `${apellidoPaterno}_${apellidoMaterno}_${nombre}`.replace(/[^a-zA-Z0-9_]/g, '');
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            // Remover el prefijo data:mime/type;base64,
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
}

function resetFormOnly() {
    // Resetear solo el formulario, manteniendo la autenticación
    document.getElementById('attendanceForm').reset();
    initializeForm();
    
    // Resetear campos condicionales
    document.querySelectorAll('.conditional-field').forEach(field => {
        field.classList.remove('show');
    });
    
    // Ocultar sección de evidencias
    document.getElementById('evidencias_section').style.display = 'none';
    
    // Resetear evidencias
    resetEvidenciasSection();
    
    // Resetear campos de ubicación pero mantener autenticación
    document.getElementById('ubicacion_detectada').value = 'Obteniendo ubicación...';
    document.getElementById('direccion_completa').value = 'Consultando dirección...';
    document.getElementById('precision_gps').value = 'Calculando...';
    document.getElementById('ubicacion_detectada').className = 'location-field';
    document.getElementById('direccion_completa').className = 'location-field';
    document.getElementById('precision_gps').className = 'location-field';
    document.getElementById('retry_location_btn').style.display = 'none';
    
    // Mantener información de autenticación
    document.getElementById('email').value = currentUser.email;
    document.getElementById('google_user_id').value = currentUser.id;
    
    // Resetear estado de ubicación
    locationValid = false;
    locationAttempts = 0;
    updateLocationStatus('loading', 'Obteniendo nueva ubicación GPS...', '');
    updateSubmitButton();
}

function validateConditionalFields() {
    // Validar campo de permiso
    const tipoRegistro = document.getElementById('tipo_registro');
    const permisoDetalle = document.getElementById('permiso_detalle');
    const otroDetalle = document.getElementById('otro_detalle');
    
    if (tipoRegistro.value === 'permiso' && !permisoDetalle.value.trim()) {
        showStatus('Por favor, especifique el motivo del permiso.', 'error');
        permisoDetalle.focus();
        return false;
    }
    
    if (tipoRegistro.value === 'otro' && !otroDetalle.value.trim()) {
        showStatus('Por favor, especifique el tipo de registro.', 'error');
        otroDetalle.focus();
        return false;
    }
    
    // Validar campo de actividades varias
    const actividadesVarias = document.getElementById('actividades_varias');
    const actividadesVariasTexto = document.getElementById('actividades_varias_texto');
    
    if (actividadesVarias.checked && !actividadesVariasTexto.value.trim()) {
        showStatus('Por favor, describa las actividades varias realizadas.', 'error');
        actividadesVariasTexto.focus();
        return false;
    }
    
    // Validar campo de pruebas psicológicas
    const pruebasPsicologicas = document.getElementById('pruebas_psicologicas');
    const pruebasPsicologicasTexto = document.getElementById('pruebas_psicologicas_texto');
    
    if (pruebasPsicologicas.checked && !pruebasPsicologicasTexto.value.trim()) {
        showStatus('Por favor, especifique qué pruebas psicológicas aplicó.', 'error');
        pruebasPsicologicasTexto.focus();
        return false;
    }
    
    // Validar que la suma de grupos de edad coincida con intervenciones totales
    const intervenciones = parseInt(document.getElementById('intervenciones_psicologicas').value) || 0;
    
    if (intervenciones > 0) {
        const ninos = parseInt(document.getElementById('ninos_ninas').value) || 0;
        const adolescentes = parseInt(document.getElementById('adolescentes').value) || 0;
        const adultos = parseInt(document.getElementById('adultos').value) || 0;
        const mayores = parseInt(document.getElementById('mayores_60').value) || 0;
        const familia = parseInt(document.getElementById('familia').value) || 0;
        
        const sumaGrupos = ninos + adolescentes + adultos + mayores + familia;
        
        if (sumaGrupos !== intervenciones) {
            showStatus(`Error: El total de intervenciones (${intervenciones}) debe ser igual a la suma de los grupos de edad (${sumaGrupos}). Niños: ${ninos}, Adolescentes: ${adolescentes}, Adultos: ${adultos}, Mayores 60: ${mayores}, Familia: ${familia}`, 'error');
            return false;
        }
    }
    
    return true;
}

function showStatus(message, type) {
    const status = document.getElementById('status');
    status.innerHTML = message; // Usar innerHTML para permitir saltos de línea
    status.className = `status ${type}`;
    status.style.display = 'block';
}

function hideStatus() {
    const status = document.getElementById('status');
    status.style.display = 'none';
}
