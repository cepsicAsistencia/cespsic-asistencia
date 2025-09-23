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
    
    // Verificaciones iniciales
    if (!isAuthenticated || !currentUser) {
        showStatus('❌ Debe autenticarse con Google antes de registrar la asistencia.', 'error');
        return;
    }
    
    if (!locationValid || !currentLocation) {
        showStatus('❌ No se puede registrar la asistencia sin una ubicación GPS válida.', 'error');
        return;
    }
    
    if (currentLocation.accuracy > REQUIRED_ACCURACY) {
        showStatus(`❌ La precisión GPS actual (${Math.round(currentLocation.accuracy)}m) supera el límite permitido de ${REQUIRED_ACCURACY}m.`, 'error');
        return;
    }
    
    // Validar campos condicionales
    if (!validateConditionalFields()) {
        return;
    }
    
    // Mostrar estado de carga
    showStatus('Guardando asistencia... ⏳', 'success');
    const submitBtn = document.querySelector('.submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando...';
    
    try {
        // Procesar evidencias primero
        let evidenciasUrls = [];
        if (selectedFiles.length > 0) {
            showStatus('Subiendo evidencias... 📤', 'success');
            evidenciasUrls = await uploadEvidencias();
            
            // Verificar si hay evidencias exitosas
            const successfulUploads = evidenciasUrls.filter(e => e.uploadStatus === 'SUCCESS');
            if (selectedFiles.length > 0 && successfulUploads.length === 0) {
                throw new Error('No se pudo subir ninguna evidencia. Verifique su conexión e intente nuevamente.');
            }
        }
        
        // Preparar datos del formulario
        const formData = new FormData(e.target);
        const data = {};
        
        // Procesar campos del formulario
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
        
        // Agregar información de evidencias
        data.evidencias_urls = evidenciasUrls;
        data.total_evidencias = evidenciasUrls.filter(e => e.uploadStatus === 'SUCCESS').length;
        data.evidencias_failed = evidenciasUrls.filter(e => e.uploadStatus === 'FAILED').length;
        
        // Crear resumen de evidencias para el sheet
        const evidenciasResumen = evidenciasUrls
            .filter(e => e.uploadStatus === 'SUCCESS')
            .map(e => `${e.fileName}: ${e.url}`)
            .join(' | ');
        
        data.evidencias_resumen = evidenciasResumen;
        
        // Forzar campos críticos
        data.modalidad = document.getElementById('modalidad').value;
        data.ubicacion_detectada = document.getElementById('ubicacion_detectada').value;
        data.direccion_completa = document.getElementById('direccion_completa').value;
        data.precision_gps = document.getElementById('precision_gps').value;
        data.precision_gps_metros = Math.round(currentLocation.accuracy);
        data.location_validation = 'passed';
        data.authenticated_user_name = currentUser.name;
        data.authentication_timestamp = new Date().toISOString();
        data.timestamp = new Date().toISOString();
        
        // Validar modalidad
        if (!data.modalidad || data.modalidad === '') {
            throw new Error('El campo Modalidad es requerido');
        }
        
        console.log('📤 Enviando datos del formulario principal...');
        console.log('Modalidad:', data.modalidad);
        console.log('Evidencias exitosas:', data.total_evidencias);
        
        // IMPORTANTE: URL de tu Google Apps Script
        const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwMFGlROijU-qQAXJyAAP-uHhsXh6XYpv7EQuC1HbZyEunGBi3KaC-DZRzttDPVUKMw/exec';
        
        // Enviar formulario principal
        const response = await fetchWithRetry(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        }, 3);
        
        if (response.ok) {
            const responseData = await response.json();
            
            if (responseData.success) {
                // Éxito completo
                const evidenciasInfo = data.total_evidencias > 0 
                    ? `\nEvidencias: ${data.total_evidencias} imagen(es) subida(s)${data.evidencias_failed > 0 ? ` (${data.evidencias_failed} errores)` : ''}`
                    : '';
                
                showStatus(`¡Asistencia registrada exitosamente! 📊✅
                Usuario: ${currentUser.name} (${currentUser.email})
                Modalidad: ${data.modalidad}
                Ubicación: ${data.ubicacion_detectada}
                Precisión GPS: ${data.precision_gps}${evidenciasInfo}`, 'success');
                
                // Auto-reset después de 4 segundos
                setTimeout(() => {
                    if (confirm('¿Desea registrar otra asistencia? Presione OK para continuar o Cancelar para cerrar sesión.')) {
                        resetFormOnly();
                        getCurrentLocation();
                    } else {
                        signOut();
                    }
                    hideStatus();
                }, 4000);
                
            } else {
                throw new Error(responseData.message || 'Error desconocido del servidor');
            }
        } else {
            const errorText = await response.text();
            throw new Error(`Error HTTP ${response.status}: ${errorText}`);
        }
        
    } catch (error) {
        console.error('❌ Error en envío:', error);
        
        let errorMessage = 'Error al guardar en Google Sheets. ';
        if (error.message.includes('CORS')) {
            errorMessage += 'Error de configuración CORS. Contacte al administrador.';
        } else if (error.message.includes('Failed to fetch') || error.message.includes('fetch')) {
            errorMessage += 'Verifique su conexión a internet e intente nuevamente.';
        } else if (error.message.includes('evidencia')) {
            errorMessage = error.message; // Usar mensaje específico de evidencias
        } else {
            errorMessage += error.message;
        }
        
        showStatus(errorMessage, 'error');
        
        // Restaurar botón después de 5 segundos
        setTimeout(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            hideStatus();
        }, 5000);
    }
}

// Función auxiliar para validar URLs de evidencias
function validateEvidenciasUrls(evidenciasUrls) {
    const validUrls = evidenciasUrls.filter(evidencia => {
        return evidencia.url && 
               evidencia.url !== 'ERROR_AL_SUBIR' && 
               evidencia.url.includes('drive.google.com') &&
               !evidencia.url.includes('UPLOADED_FILE_ID');
    });
    
    console.log(`URLs validadas: ${validUrls.length}/${evidenciasUrls.length}`);
    return validUrls;
}
async function testConnectivity() {
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwMFGlROijU-qQAXJyAAP-uHhsXh6XYpv7EQuC1HbZyEunGBi3KaC-DZRzttDPVUKMw/exec';
    
    try {
        console.log('🔍 Probando conectividad con Google Apps Script...');
        
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'GET'
        });
        
        if (response.ok) {
            const text = await response.text();
            console.log('✅ Conectividad exitosa');
            console.log('Respuesta del servidor:', text);
            return { success: true, response: text };
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
    } catch (error) {
        console.error('❌ Error de conectividad:', error);
        return { success: false, error: error.message };
    }
}
// Función para mostrar información detallada de evidencias en la UI
function showEvidenciasDetails(evidenciasUrls) {
    if (evidenciasUrls.length === 0) return;
    
    const preview = document.getElementById('evidencias-preview');
    const statusDiv = document.getElementById('evidencias-status');
    
    // Agregar información de URLs a cada preview
    evidenciasUrls.forEach((evidencia, index) => {
        const previewItem = preview.children[index];
        if (previewItem && evidencia.uploadStatus === 'SUCCESS') {
            const infoDiv = previewItem.querySelector('.evidencia-info');
            if (infoDiv) {
                infoDiv.innerHTML += `<br><small>✅ Subido correctamente</small>`;
                
                // Agregar enlace para ver la evidencia
                const viewLink = document.createElement('a');
                viewLink.href = evidencia.url;
                viewLink.target = '_blank';
                viewLink.textContent = '👁️ Ver';
                viewLink.style.fontSize = '12px';
                viewLink.style.color = '#4285f4';
                viewLink.style.textDecoration = 'none';
                viewLink.style.marginLeft = '5px';
                
                infoDiv.appendChild(document.createElement('br'));
                infoDiv.appendChild(viewLink);
            }
        }
    });
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
    
    // IMPORTANTE: URL de tu Google Apps Script (actualizar si es necesario)
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwMFGlROijU-qQAXJyAAP-uHhsXh6XYpv7EQuC1HbZyEunGBi3KaC-DZRzttDPVUKMw/exec';
    
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
            
            console.log(`Subiendo archivo ${i + 1}:`, fullFileName);
            
            // Realizar petición con timeout y retry
            const response = await fetchWithRetry(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(uploadData)
            }, 3); // 3 intentos
            
            if (response.ok) {
                const responseData = await response.json();
                
                if (responseData.success) {
                    // URLs reales del backend
                    evidenciasUrls.push({
                        fileName: fullFileName,
                        originalName: file.name,
                        url: responseData.file_url,
                        file_id: responseData.file_id,
                        download_url: responseData.download_url,
                        preview_url: responseData.preview_url,
                        embed_url: responseData.embed_url,
                        size: file.size,
                        uploadTime: responseData.upload_timestamp,
                        uploadStatus: 'SUCCESS'
                    });
                    
                    console.log(`✅ Archivo ${fullFileName} subido exitosamente`);
                    console.log(`URL generada: ${responseData.file_url}`);
                    
                } else {
                    throw new Error(responseData.message || 'Error desconocido en el servidor');
                }
            } else {
                const errorText = await response.text();
                throw new Error(`Error HTTP ${response.status}: ${errorText}`);
            }
            
        } catch (error) {
            console.error(`❌ Error subiendo archivo ${file.name}:`, error);
            
            // Agregar entrada de error
            evidenciasUrls.push({
                fileName: fullFileName,
                originalName: file.name,
                url: 'ERROR_AL_SUBIR',
                error: error.message,
                size: file.size,
                uploadTime: new Date().toISOString(),
                uploadStatus: 'FAILED'
            });
            
            // Mostrar error específico
            showEvidenciasStatus(`⚠️ Error subiendo ${file.name}: ${error.message}`, 'warning');
        }
        
        // Pausa entre subidas para evitar rate limiting
        if (i < selectedFiles.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    async function fetchWithRetry(url, options, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Intento ${attempt}/${maxRetries} para: ${url}`);
            
            // Agregar timeout a la petición
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos timeout
            
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            return response;
            
        } catch (error) {
            lastError = error;
            console.error(`Intento ${attempt} falló:`, error.message);
            
            if (attempt < maxRetries) {
                // Esperar antes del siguiente intento (backoff exponencial)
                const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
                console.log(`Esperando ${delay}ms antes del siguiente intento...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError;
}
    // Mostrar resumen final
    const successCount = evidenciasUrls.filter(e => e.uploadStatus === 'SUCCESS').length;
    const failCount = evidenciasUrls.filter(e => e.uploadStatus === 'FAILED').length;
    
    console.log(`📊 Resumen subida: ${successCount} exitosas, ${failCount} fallidas`);
    
    if (successCount > 0) {
        showEvidenciasStatus(
            `✅ ${successCount} evidencia(s) subida(s) correctamente${failCount > 0 ? ` (${failCount} errores)` : ''}`, 
            failCount > 0 ? 'warning' : 'success'
        );
    } else if (failCount > 0) {
        showEvidenciasStatus(`❌ Error: No se pudo subir ninguna evidencia`, 'error');
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
}// Variables globales
let currentLocation = null;
let userEmail = null;
let isAuthenticated = false;
let locationValid = false;
let locationAttempts = 0;
let currentUser = null;
let selectedFiles = [];
let authenticationPurpose = 'login'; // 'login' | 'revoke'
let privacyConsent = false;

const MAX_LOCATION_ATTEMPTS = 3;
const REQUIRED_ACCURACY = 50; // metros
const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PRIVACY_VERSION = '1.0';

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
    initializeForm();
    setupEventListeners();
    loadGoogleSignInScript();
    updateCurrentTime();
    checkPrivacyConsent();
    
    // Actualizar hora cada segundo
    setInterval(updateCurrentTime, 1000);
});

// ========== PRIVACY MANAGEMENT FUNCTIONS ==========

function checkPrivacyConsent() {
    try {
        const storedConsent = localStorage.getItem('cespsic_privacy_accepted');
        
        if (storedConsent) {
            const consentData = JSON.parse(storedConsent);
            
            // Verificar versión del aviso
            if (consentData.version === PRIVACY_VERSION && consentData.accepted) {
                privacyConsent = true;
                updatePrivacyUI();
                enableAuthentication();
                console.log('Permisos de privacidad encontrados y válidos');
                return;
            } else {
                // Versión desactualizada, limpiar
                localStorage.removeItem('cespsic_privacy_accepted');
            }
        }
        
        // No hay consentimiento válido
        privacyConsent = false;
        updatePrivacyUI();
        disableAuthentication();
        console.log('Sin permisos de privacidad válidos');
        
    } catch (error) {
        console.error('Error verificando consentimiento:', error);
        privacyConsent = false;
        updatePrivacyUI();
        disableAuthentication();
    }
}

function updatePrivacyUI() {
    const revokeSection = document.getElementById('revoke-section');
    const signinBtn = document.getElementById('main-signin-btn');
    const signinBtnText = document.getElementById('signin-btn-text');
    
    if (privacyConsent) {
        revokeSection.style.display = 'block';
        signinBtn.disabled = false;
        signinBtn.classList.remove('disabled');
        signinBtnText.textContent = 'Iniciar Sesión con Google';
        signinBtn.style.background = '#4285f4';
        signinBtn.style.cursor = 'pointer';
    } else {
        revokeSection.style.display = 'none';
        signinBtn.disabled = false; // CAMBIO IMPORTANTE: Permitir click para mostrar modal
        signinBtn.classList.remove('disabled');
        signinBtnText.textContent = 'Iniciar Sesión con Google';
        signinBtn.style.background = '#4285f4';
        signinBtn.style.cursor = 'pointer';
    }
}

function checkPrivacyConsent() {
    try {
        const storedConsent = localStorage.getItem('cespsic_privacy_accepted');
        
        if (storedConsent) {
            const consentData = JSON.parse(storedConsent);
            
            // Verificar versión del aviso Y que tenga usuario autenticado
            if (consentData.version === PRIVACY_VERSION && 
                consentData.accepted && 
                consentData.authenticated_user) {
                privacyConsent = true;
                updatePrivacyUI();
                console.log('Permisos de privacidad encontrados y válidos para:', consentData.authenticated_user);
                return;
            } else {
                // Versión desactualizada o sin usuario autenticado, limpiar
                localStorage.removeItem('cespsic_privacy_accepted');
                console.log('Consentimiento inválido o incompleto - limpiado');
            }
        }
        
        // No hay consentimiento válido
        privacyConsent = false;
        updatePrivacyUI();
        console.log('Sin permisos de privacidad válidos');
        
    } catch (error) {
        console.error('Error verificando consentimiento:', error);
        // En caso de error, limpiar localStorage por seguridad
        localStorage.removeItem('cespsic_privacy_accepted');
        privacyConsent = false;
        updatePrivacyUI();
    }
}

function updatePrivacyUI() {
    const revokeSection = document.getElementById('revoke-section');
    const signinBtn = document.getElementById('main-signin-btn');
    const signinBtnText = document.getElementById('signin-btn-text');
    
    if (privacyConsent) {
        // Usuario ya aceptó términos
        revokeSection.style.display = 'block';
        signinBtn.disabled = false;
        signinBtn.classList.remove('privacy-required');
        signinBtnText.textContent = 'Iniciar Sesión con Google';
        signinBtn.style.background = '#4285f4';
        signinBtn.style.cursor = 'pointer';
    } else {
        // Usuario necesita aceptar términos
        revokeSection.style.display = 'none';
        signinBtn.disabled = false; // IMPORTANTE: No deshabilitar
        signinBtn.classList.add('privacy-required'); // Clase para override CSS
        signinBtnText.textContent = 'Iniciar Sesión con Google';
        signinBtn.style.background = '#4285f4 !important';
        signinBtn.style.cursor = 'pointer !important';
    }
    
    console.log('UI actualizada - privacyConsent:', privacyConsent, 'botón disabled:', signinBtn.disabled);
}

function requestAuthentication() {
    console.log('Solicitud de autenticación, privacyConsent:', privacyConsent);
    
    if (!privacyConsent) {
        console.log('Mostrando modal de privacidad');
        showPrivacyModal();
    } else {
        console.log('Procediendo con autenticación Google');
        authenticationPurpose = 'login';
        proceedWithGoogleSignIn();
    }
}

function showPrivacyModal() {
    const modal = document.getElementById('privacy-modal');
    console.log('Intentando mostrar modal de privacidad');
    console.log('Modal encontrado:', modal ? 'SI' : 'NO');
    
    if (modal) {
        modal.style.display = 'flex';
        console.log('Modal mostrado, display:', modal.style.display);
        
        // Manejar escape key
        document.addEventListener('keydown', handlePrivacyModalEscape);
    } else {
        console.error('No se encontró el modal de privacidad');
        alert('Modal de privacidad no encontrado. Revise la consola para más detalles.');
    }
}

function hidePrivacyModal() {
    const modal = document.getElementById('privacy-modal');
    modal.style.display = 'none';
    document.removeEventListener('keydown', handlePrivacyModalEscape);
}

function handlePrivacyModalEscape(e) {
    if (e.key === 'Escape') {
        rejectPrivacy();
    }
}

function acceptPrivacy() {
    try {
        // NO guardar en localStorage todavía - solo marcar temporalmente
        privacyConsent = true; // Solo en memoria
        updatePrivacyUI();
        hidePrivacyModal();
        
        // Proceder con autenticación - solo si se completa exitosamente se guardará
        authenticationPurpose = 'login';
        proceedWithGoogleSignIn();
        
        console.log('Aviso de privacidad aceptado temporalmente - pendiente autenticación');
        
    } catch (error) {
        console.error('Error guardando consentimiento:', error);
        showStatus('Error al procesar aceptación. Intente nuevamente.', 'error');
    }
}

function rejectPrivacy() {
    hidePrivacyModal();
    showStatus('Debe aceptar el aviso de privacidad para usar la aplicación.', 'error');
    setTimeout(() => hideStatus(), 5000);
}

function requestRevocation() {
    showRevokeModal();
}

function showRevokeModal() {
    const modal = document.getElementById('revoke-modal');
    modal.style.display = 'flex';
    
    // Manejar escape key
    document.addEventListener('keydown', handleRevokeModalEscape);
}

function hideRevokeModal() {
    const modal = document.getElementById('revoke-modal');
    modal.style.display = 'none';
    document.removeEventListener('keydown', handleRevokeModalEscape);
}

function handleRevokeModalEscape(e) {
    if (e.key === 'Escape') {
        cancelRevocation();
    }
}

function cancelRevocation() {
    hideRevokeModal();
}

function authenticateToRevoke() {
    hideRevokeModal();
    authenticationPurpose = 'revoke';
    proceedWithGoogleSignIn();
}

async function revokePrivacyConsent() {
    try {
        // Registrar revocación en backend
        await recordPrivacyAction('PRIVACY_REVOKED');
        
        // Eliminar consentimiento local
        localStorage.removeItem('cespsic_privacy_accepted');
        
        // Actualizar estados
        privacyConsent = false;
        isAuthenticated = false;
        currentUser = null;
        userEmail = null;
        locationValid = false;
        currentLocation = null;
        selectedFiles = [];
        
        // Actualizar UI
        updatePrivacyUI();
        updateAuthenticationUI();
        disableForm();
        resetLocationFields();
        resetEvidenciasSection();
        
        showStatus('Permisos de privacidad revocados exitosamente. Se ha cerrado su sesión.', 'success');
        
        setTimeout(() => {
            hideStatus();
            // Reinicializar Google Sign-In
            initializeGoogleSignIn();
        }, 3000);
        
        console.log('Consentimiento de privacidad revocado');
        
    } catch (error) {
        console.error('Error revocando consentimiento:', error);
        showStatus('Error al revocar permisos. Intente nuevamente.', 'error');
    }
}

async function recordPrivacyAction(action) {
    if (!currentUser) {
        throw new Error('Usuario no autenticado para registrar acción de privacidad');
    }
    
    try {
        const privacyData = {
            action: 'record_privacy_action',
            timestamp: new Date().toISOString(),
            email: currentUser.email,
            google_user_id: currentUser.id,
            authenticated_user_name: currentUser.name,
            privacy_action: action,
            privacy_version: PRIVACY_VERSION,
            device_info: navigator.userAgent,
            authentication_purpose: authenticationPurpose
        };
        
        const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwMFGlROijU-qQAXJyAAP-uHhsXh6XYpv7EQuC1HbZyEunGBi3KaC-DZRzttDPVUKMw/exec';
        
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(privacyData)
        });
        
        console.log('Acción de privacidad registrada:', action);
        
    } catch (error) {
        console.error('Error registrando acción de privacidad:', error);
        throw error;
    }
}

// ========== GOOGLE SIGN-IN FUNCTIONS (MODIFICADAS) ==========

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

function loadGoogleSignInScript() {
    // El script ya se carga en el HTML, solo inicializamos cuando esté listo
    if (typeof google !== 'undefined' && google.accounts) {
        initializeGoogleSignIn();
        
        // PREVENIR completamente cualquier prompt automático
        blockGooglePrompts();
    } else {
        // Esperar a que se cargue el script
        setTimeout(loadGoogleSignInScript, 100);
    }
}

function blockGooglePrompts() {
    try {
        // Deshabilitar y cancelar cualquier prompt
        google.accounts.id.disableAutoSelect();
        google.accounts.id.cancel();
        
        // Interceptar y bloquear futuros prompts
        const originalPrompt = google.accounts.id.prompt;
        google.accounts.id.prompt = function(callback) {
            console.log('PROMPT BLOQUEADO - redirigiendo a botón manual');
            if (callback) {
                callback({
                    isNotDisplayed: () => true,
                    isSkippedMoment: () => true,
                    getNotDisplayedReason: () => 'BLOCKED_BY_APP'
                });
            }
        };
        
        console.log('Google prompts completamente bloqueados');
        
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

        // FORZAR deshabilitación de One Tap en todos los dispositivos
        google.accounts.id.disableAutoSelect();
        
        // Prevenir cualquier prompt automático
        google.accounts.id.cancel();

        console.log('Google Sign-In inicializado - One Tap completamente deshabilitado');

    } catch (error) {
        console.error('Error inicializando Google Sign-In:', error);
        showStatus('Error cargando sistema de autenticación. Verifique su conexión.', 'error');
    }
}

function proceedWithGoogleSignIn() {
    try {
        console.log('Iniciando autenticación Google - saltando prompt');
        
        // SALTAR completamente el prompt y ir directo al botón visible
        showVisibleGoogleButton();
        
    } catch (error) {
        console.error('Error en sign-in:', error);
        showStatus('Error al intentar iniciar sesión con Google.', 'error');
    }
}

function showVisibleGoogleButton() {
    console.log('Mostrando botón de Google - método directo');
    
    // Remover cualquier overlay previo
    const existingOverlay = document.getElementById('google-auth-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }
    
    // Crear overlay simple con atributos adicionales para identificación
    const overlay = document.createElement('div');
    overlay.id = 'google-auth-overlay';
    overlay.className = 'google-auth-modal';
    overlay.setAttribute('data-modal-type', 'google-auth');
    overlay.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        background: rgba(0,0,0,0.7) !important;
        z-index: 10000 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
    `;
    
    const container = document.createElement('div');
    container.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 15px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        text-align: center;
        max-width: 400px;
        width: 90%;
    `;
    
    container.innerHTML = `
        <h3 style="margin-bottom: 20px; color: #333;">Autenticación con Google</h3>
        <p style="margin-bottom: 20px; color: #666;">Haga clic en el botón azul para continuar:</p>
        <div id="google-button-container" style="margin-bottom: 20px;"></div>
    `;
    
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.style.cssText = `
        padding: 10px 20px;
        background: #f5f5f5;
        border: 1px solid #ddd;
        border-radius: 5px;
        cursor: pointer;
        margin-top: 10px;
    `;
    cancelBtn.onclick = () => closeAuthModal();
    
    // Cerrar modal al hacer clic fuera del contenedor
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            closeAuthModal();
        }
    };
    
    container.appendChild(cancelBtn);
    overlay.appendChild(container);
    document.body.appendChild(overlay);
    
    // Renderizar botón de Google DESPUÉS de añadir al DOM
    setTimeout(() => {
        const buttonContainer = document.getElementById('google-button-container');
        if (buttonContainer) {
            google.accounts.id.renderButton(buttonContainer, {
                theme: "filled_blue",
                size: "large",
                text: "signin_with",
                shape: "rectangular"
            });
        }
    }, 100);
    
    // Auto-cleanup después de 5 minutos
    setTimeout(() => {
        closeAuthModal();
    }, 300000);
}

async function handleCredentialResponse(response) {
    try {
        console.log('Credenciales recibidas, iniciando cierre del modal');
        
        // MÉTODO 1: Cerrar inmediatamente el modal de Google
        closeAuthModal();
        
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

        // Manejar según el propósito de autenticación
        if (authenticationPurpose === 'revoke') {
            await handleRevocationFlow();
        } else {
            await handleLoginFlow();
        }

    } catch (error) {
        console.error('Error procesando credenciales:', error);
        showStatus('Error en la autenticación. Intente nuevamente.', 'error');
        
        // Cerrar modal en caso de error también
        closeAuthModal();
    }
}

function closeAuthModal() {
    console.log('Cerrando modal de autenticación...');
    
    // Si se cierra el modal sin completar autenticación, revertir consentimiento temporal
    if (privacyConsent && !isAuthenticated) {
        console.log('Autenticación cancelada - revirtiendo consentimiento temporal');
        privacyConsent = false;
        updatePrivacyUI();
        showStatus('Debe completar la autenticación para continuar usando la aplicación.', 'error');
        setTimeout(() => hideStatus(), 5000);
    }
    
    // Método 1: Por ID
    const authOverlay = document.getElementById('google-auth-overlay');
    if (authOverlay) {
        authOverlay.remove();
        console.log('Modal cerrado por ID');
        return;
    }
    
    // Método 2: Por clase/atributos
    const overlays = document.querySelectorAll('[id*="google"], [class*="google"], [style*="position: fixed"]');
    overlays.forEach(overlay => {
        if (overlay.style.zIndex === '10000' || overlay.style.zIndex > 1000) {
            overlay.remove();
            console.log('Modal cerrado por selector');
        }
    });
    
    // Método 3: Buscar por contenido específico
    const allDivs = document.querySelectorAll('div');
    allDivs.forEach(div => {
        if (div.textContent && div.textContent.includes('Autenticación con Google')) {
            const parent = div.closest('div[style*="position: fixed"]');
            if (parent) {
                parent.remove();
                console.log('Modal cerrado por contenido');
            }
        }
    });
    
    // Método 4: Timeout como último recurso
    setTimeout(() => {
        const remainingOverlays = document.querySelectorAll('div[style*="position: fixed"][style*="z-index"]');
        remainingOverlays.forEach(overlay => {
            if (overlay.style.zIndex >= 10000) {
                overlay.remove();
                console.log('Modal cerrado por timeout');
            }
        });
    }, 500);
}

async function handleLoginFlow() {
    try {
        // IMPORTANTE: Solo AHORA guardar la aceptación de privacidad en localStorage
        // porque la autenticación fue exitosa
        const consentData = {
            accepted: true,
            timestamp: new Date().toISOString(),
            version: PRIVACY_VERSION,
            userAgent: navigator.userAgent,
            authenticated_user: currentUser.email,
            authentication_timestamp: new Date().toISOString()
        };
        
        localStorage.setItem('cespsic_privacy_accepted', JSON.stringify(consentData));
        console.log('Consentimiento guardado en localStorage después de autenticación exitosa');
        
        // Registrar aceptación de privacidad en backend
        await recordPrivacyAction('PRIVACY_ACCEPTED');
        
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
        console.error('Error en flujo de login:', error);
        
        // Si hay error, revertir el consentimiento temporal
        privacyConsent = false;
        updatePrivacyUI();
        
        showStatus('Error registrando la autenticación. Intente nuevamente.', 'error');
    }
}

async function handleRevocationFlow() {
    try {
        // Ejecutar revocación
        await revokePrivacyConsent();
        
    } catch (error) {
        console.error('Error en flujo de revocación:', error);
        showStatus('Error durante la revocación. Intente nuevamente.', 'error');
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
        
        // Resetear variables (manteniendo privacyConsent)
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

        // Reinicializar Google Sign-In
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
            evidenciasSection.style.display = 'block';
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
// FUNCIÓN PARA PROBAR CORS DESDE LA CONSOLA DEL NAVEGADOR
async function testCorsConnection() {
    // IMPORTANTE: Reemplaza con tu URL actual de Google Apps Script
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwuqoqDJBYrHFJqh4sLkHkd1582PdCB535XqQDYcakJfFqR_N0KgPnRxl2qUatfUuWC/exec';
    
    console.log('🔍 Probando CORS con Google Apps Script...');
    console.log('URL:', GOOGLE_SCRIPT_URL);
    
    try {
        // Test 1: GET request (sin preflight)
        console.log('\n--- TEST 1: GET Request ---');
        const getResponse = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'GET'
        });
        
        console.log('GET Status:', getResponse.status);
        console.log('GET Headers:', [...getResponse.headers.entries()]);
        
        if (getResponse.ok) {
            const getText = await getResponse.text();
            console.log('GET Response:', getText);
            console.log('✅ GET request exitoso');
        } else {
            console.log('❌ GET request falló');
        }
        
        // Test 2: POST request (con preflight)
        console.log('\n--- TEST 2: POST Request (Preflight) ---');
        const postResponse = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'test_cors',
                timestamp: new Date().toISOString()
            })
        });
        
        console.log('POST Status:', postResponse.status);
        console.log('POST Headers:', [...postResponse.headers.entries()]);
        
        if (postResponse.ok) {
            const postText = await postResponse.text();
            console.log('POST Response:', postText);
            console.log('✅ POST request exitoso');
            
            // Intentar parsear como JSON
            try {
                const postJson = JSON.parse(postText);
                console.log('JSON parsed:', postJson);
            } catch (e) {
                console.log('Response no es JSON válido');
            }
        } else {
            console.log('❌ POST request falló');
        }
        
        // Test 3: OPTIONS request (preflight manual)
        console.log('\n--- TEST 3: OPTIONS Request (Manual Preflight) ---');
        try {
            const optionsResponse = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'OPTIONS',
                headers: {
                    'Access-Control-Request-Method': 'POST',
                    'Access-Control-Request-Headers': 'Content-Type'
                }
            });
            
            console.log('OPTIONS Status:', optionsResponse.status);
            console.log('OPTIONS Headers:', [...optionsResponse.headers.entries()]);
            
            // Verificar headers CORS específicos
            const corsOrigin = optionsResponse.headers.get('Access-Control-Allow-Origin');
            const corsMethods = optionsResponse.headers.get('Access-Control-Allow-Methods');
            const corsHeaders = optionsResponse.headers.get('Access-Control-Allow-Headers');
            
            console.log('CORS Allow-Origin:', corsOrigin);
            console.log('CORS Allow-Methods:', corsMethods);
            console.log('CORS Allow-Headers:', corsHeaders);
            
            if (corsOrigin === '*' && corsMethods && corsHeaders) {
                console.log('✅ CORS headers correctos');
            } else {
                console.log('❌ CORS headers incorrectos o faltantes');
            }
            
        } catch (optionsError) {
            console.log('❌ OPTIONS request falló:', optionsError);
        }
        
        console.log('\n=== RESUMEN ===');
        console.log('Si ves ✅ en GET y POST, CORS está funcionando');
        console.log('Si ves ❌, revisa la configuración del Google Apps Script');
        
        return {
            success: true,
            message: 'Tests de CORS completados'
        };
        
    } catch (error) {
        console.error('❌ Error en test de CORS:', error);
        
        if (error.message.includes('CORS')) {
            console.log('\n🔧 DIAGNÓSTICO DEL ERROR CORS:');
            console.log('1. Verifica que Google Apps Script tenga la función doOptions()');
            console.log('2. Verifica que doPost() incluya headers CORS');
            console.log('3. Verifica que el script esté republicado');
            console.log('4. Verifica que la URL sea correcta');
        }
        
        return {
            success: false,
            error: error.message
        };
    }
}

// FUNCIÓN SIMPLIFICADA PARA PROBAR SUBIDA DE EVIDENCIA
async function testEvidenciaUploadSimple() {
    // IMPORTANTE: Reemplaza con tu URL actual
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwuqoqDJBYrHFJqh4sLkHkd1582PdCB535XqQDYcakJfFqR_N0KgPnRxl2qUatfUuWC/exec';
    
    console.log('🔍 Probando subida de evidencia simple...');
    
    // Crear imagen de prueba muy pequeña (1x1 pixel rojo en base64)
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    
    const testData = {
        action: 'upload_evidencia',
        fileName: 'test_image.png',
        fileData: testImageBase64,
        mimeType: 'image/png',
        studentFolder: 'Test_Student',
        userEmail: 'test@example.com',
        timestamp: new Date().toISOString()
    };
    
    try {
        console.log('Enviando datos de prueba:', testData);
        
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testData)
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', [...response.headers.entries()]);
        
        if (response.ok) {
            const responseText = await response.text();
            console.log('Response text:', responseText);
            
            try {
                const responseJson = JSON.parse(responseText);
                console.log('Response JSON:', responseJson);
                
                if (responseJson.success) {
                    console.log('✅ Subida de evidencia exitosa!');
                    console.log('File ID:', responseJson.file_id);
                    console.log('URL:', responseJson.file_url);
                    return responseJson;
                } else {
                    console.log('❌ Error en la respuesta:', responseJson.message);
                    return responseJson;
                }
            } catch (parseError) {
                console.log('❌ Error parseando JSON:', parseError);
                return { success: false, error: 'Response not valid JSON' };
            }
        } else {
            console.log('❌ HTTP Error:', response.status, response.statusText);
            const errorText = await response.text();
            console.log('Error text:', errorText);
            return { success: false, error: `HTTP ${response.status}: ${errorText}` };
        }
        
    } catch (error) {
        console.error('❌ Error en test de evidencia:', error);
        return { success: false, error: error.message };
    }
}

// FUNCIÓN PARA VERIFICAR QUE LA URL DEL SCRIPT ES CORRECTA
function checkScriptUrl() {
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwuqoqDJBYrHFJqh4sLkHkd1582PdCB535XqQDYcakJfFqR_N0KgPnRxl2qUatfUuWC/exec';
    
    console.log('🔍 Verificando URL del script...');
    console.log('URL actual:', GOOGLE_SCRIPT_URL);
    
    // Verificar formato básico
    if (GOOGLE_SCRIPT_URL.includes('script.google.com/macros/s/') && GOOGLE_SCRIPT_URL.endsWith('/exec')) {
        console.log('✅ Formato de URL correcto');
    } else {
        console.log('❌ Formato de URL incorrecto');
        console.log('Debería ser: https://script.google.com/macros/s/[ID]/exec');
    }
    
    // Extraer ID del script
    const urlParts = GOOGLE_SCRIPT_URL.split('/');
    const scriptId = urlParts[urlParts.length - 2];
    console.log('Script ID extraído:', scriptId);
    
    if (scriptId && scriptId.length > 20) {
        console.log('✅ ID del script parece válido');
    } else {
        console.log('❌ ID del script parece inválido');
    }
}
async function runAllTests() {
    console.log('🚀 Ejecutando todos los tests...\n');
    
    checkScriptUrl();
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const corsResult = await testCorsConnection();
    
    if (corsResult.success) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const evidenciaResult = await testEvidenciaUploadSimple();
        return { cors: corsResult, evidencia: evidenciaResult };
    } else {
        return { cors: corsResult, evidencia: { success: false, error: 'CORS failed' } };
    }
}
