// ========================================================================================================
// 📊 SISTEMA DE LOGS Y AUDITORÍA PARA FIREBASE - CESPSIC
// ========================================================================================================
// Este archivo replica la funcionalidad de intentos fallidos, duplicados y auditoría que existía
// en el sistema anterior de Google Sheets, pero ahora usando Firebase Firestore
//
// Colecciones que maneja:
// - intentos_recibidos: Todos los intentos que llegan
// - intentos_fallidos: Intentos que fallaron por algún error
// - intentos_duplicados: Intentos de registros duplicados
// - auditoria: Log completo de todas las operaciones

import { 
  db, 
  collection, 
  addDoc,
  setDoc,      
  doc,          
  getDocs,
  query, 
  where,
  serverTimestamp 
} from './firebase-config.js';

// ========================================================================================================
// 🔍 FUNCIÓN: Verificar Duplicados
// ========================================================================================================
export async function verificarDuplicado(registroID, email) {
  try {
    console.log('🔍 Verificando duplicados para:', registroID);
    
    const q = query(
      collection(db, 'asistencias'),
      where('registro_id', '==', registroID)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const registroExistente = querySnapshot.docs[0].data();
      console.warn('⚠️ Registro duplicado encontrado:', registroID);
      console.warn('   Fecha original:', registroExistente.fecha_creacion);
      
      return {
        esDuplicado: true,
        registroExistente: registroExistente
      };
    }
    
    console.log('✅ No hay duplicados');
    return { esDuplicado: false };
    
  } catch (error) {
    console.error('❌ Error verificando duplicados:', error);
    // No lanzar error, continuar con el guardado
    return { esDuplicado: false };
  }
}

// ========================================================================================================
// 📝 FUNCIÓN: Registrar Intento Recibido
// ========================================================================================================
export async function registrarIntentoRecibido(datos) {
  try {
    console.log('📝 Registrando intento recibido...');
    
    const intento = {
      timestamp: serverTimestamp(),
      registro_id: datos.registro_id || 'no_generado',
      email: datos.email || 'sin_email',
      nombre: datos.nombre_completo || 'sin_nombre',
      modalidad: datos.modalidad || 'sin_modalidad',
      tiene_coordenadas: datos.ubicacion ? true : false,
      tiene_user_id: datos.google_user_id ? true : false,
      device_type: datos.device_type || 'Unknown',
      total_campos: Object.keys(datos).length,
      estado: 'RECIBIDO',
      fecha_creacion: new Date().toISOString()
    };
    
    await addDoc(collection(db, 'intentos_recibidos'), intento);
    console.log('✅ Intento recibido registrado en Firebase');
    
  } catch (error) {
    console.error('❌ Error registrando intento recibido:', error);
    // No lanzar error para no interrumpir el flujo principal
  }
}

// ========================================================================================================
// ❌ FUNCIÓN: Registrar Intento Fallido
// ========================================================================================================
export async function registrarIntentoFallido(datos, error) {
  try {
    console.log('❌ Registrando intento fallido...');
    
    const intentoFallido = {
      timestamp: serverTimestamp(),
      registro_id: datos.registro_id || 'no_generado',
      email: datos.email || 'SIN_EMAIL',
      nombre: datos.nombre_completo || 'sin_nombre',
      modalidad: datos.modalidad || 'VACÍO',
      tipo_registro: datos.tipo_registro || 'sin_tipo',
      
      // Detalles del error
      error_mensaje: error.message || error.toString(),
      error_tipo: error.name || 'Error General',
      error_stack: error.stack ? error.stack.substring(0, 500) : '', // Limitar tamaño
      
      // Datos adicionales
      ubicacion: datos.ubicacion?.lugar || 'sin_ubicacion',
      precision_metros: datos.ubicacion?.precision_metros || 0,
      device_type: datos.device_type || 'Unknown',
      total_campos: Object.keys(datos).length,
      
      fecha_creacion: new Date().toISOString()
    };
    
    await addDoc(collection(db, 'intentos_fallidos'), intentoFallido);
    console.log('✅ Intento fallido registrado en Firebase');
    
  } catch (logError) {
    console.error('❌ Error registrando intento fallido:', logError);
    // No lanzar error para no interrumpir el flujo
  }
}

// ========================================================================================================
// 🔄 FUNCIÓN: Registrar Intento Duplicado
// ========================================================================================================
export async function registrarIntentoDuplicado(datos, registroOriginal) {
  try {
    console.log('🔄 Registrando intento duplicado...');
    
    const duplicado = {
      timestamp: serverTimestamp(),
      registro_id: datos.registro_id || 'no_generado',
      email: datos.email || 'sin_email',
      tipo_registro: datos.tipo_registro || 'sin_tipo',
      device_type: datos.device_type || 'Unknown',
      
      // Información del registro original
      registro_original_id: registroOriginal.registro_id || 'desconocido',
      registro_original_fecha: registroOriginal.fecha_creacion || 'desconocida',
      
      nota: 'Intento de registro duplicado detectado y rechazado',
      fecha_creacion: new Date().toISOString()
    };
    
    await addDoc(collection(db, 'intentos_duplicados'), duplicado);
    console.log('✅ Intento duplicado registrado en Firebase');
    
  } catch (error) {
    console.error('❌ Error registrando duplicado:', error);
    // No lanzar error
  }
}

// ========================================================================================================
// 📋 FUNCIÓN: Registrar Auditoría
// ========================================================================================================
export async function registrarAuditoria(datos, exitoso) {
  try {
    console.log('📋 Registrando auditoría...');
    
    const auditoria = {
      timestamp: serverTimestamp(),
      registro_id: datos.registro_id || 'no_generado',
      email: datos.email || 'sin_email',
      nombre: datos.nombre_completo || 'sin_nombre',
      tipo_registro: datos.tipo_registro || 'sin_tipo',
      modalidad: datos.modalidad || 'sin_modalidad',
      ubicacion: datos.ubicacion?.lugar || 'sin_ubicacion',
      precision_metros: datos.ubicacion?.precision_metros || 0,
      device_type: datos.device_type || 'Unknown',
      exitoso: exitoso,
      version_html: datos.version || '2.0',
      fecha_creacion: new Date().toISOString()
    };
    
    await addDoc(collection(db, 'auditoria'), auditoria);
    console.log(`✅ Auditoría registrada: ${exitoso ? 'EXITOSO' : 'FALLIDO'}`);
    
  } catch (error) {
    console.error('❌ Error registrando auditoría:', error);
    // No lanzar error
  }
}

// ========================================================================================================
// 🎯 FUNCIÓN PRINCIPAL: Guardar con Validaciones y Logs Completos
// ========================================================================================================
export async function guardarAsistenciaConLogs(asistenciaData) {
  let registradoExitosamente = false;
  
  try {
    console.log('\n' + '='.repeat(70));
    console.log('📊 GUARDANDO CON SISTEMA DE LOGS COMPLETO');
    console.log('='.repeat(70));
    console.log('📋 Registro ID:', asistenciaData.registro_id);
    console.log('👤 Usuario:', asistenciaData.email);
    console.log('📍 Ubicación:', asistenciaData.ubicacion?.lugar);
    
    // 1️⃣ REGISTRAR INTENTO RECIBIDO
    console.log('\n1️⃣ Registrando intento recibido...');
    await registrarIntentoRecibido(asistenciaData);
    
    // 2️⃣ VERIFICAR DUPLICADOS
    console.log('\n2️⃣ Verificando duplicados...');
    const resultadoDuplicado = await verificarDuplicado(
      asistenciaData.registro_id, 
      asistenciaData.email
    );
    
    if (resultadoDuplicado.esDuplicado) {
      console.warn('\n⚠️⚠️⚠️ REGISTRO DUPLICADO DETECTADO');
      
      // Registrar el intento duplicado
      await registrarIntentoDuplicado(asistenciaData, resultadoDuplicado.registroExistente);
      
      // Registrar auditoría fallida
      await registrarAuditoria(asistenciaData, false);
      
      // Lanzar error para mostrar al usuario
      throw new Error(
        `❌ REGISTRO DUPLICADO\n\n` +
        `Este registro ya existe en el sistema:\n\n` +
        `• Registro ID: ${asistenciaData.registro_id}\n` +
        `• Fecha original: ${new Date(resultadoDuplicado.registroExistente.fecha_creacion).toLocaleString('es-MX')}\n` +
        `• Usuario: ${resultadoDuplicado.registroExistente.email}\n\n` +
        `No se puede duplicar el mismo registro.\n` +
        `Si cree que esto es un error, contacte al administrador.`
      );
    }
    
    // 3️⃣ GUARDAR EN FIRESTORE
    console.log('\n3️⃣ Guardando asistencia en Firestore...');
    const docRef = doc(db, 'asistencias', asistenciaData.registro_id);
    await setDoc(docRef, asistenciaData);
    console.log('✅ Asistencia guardada exitosamente');
    console.log('🆔 Firestore Document ID:', asistenciaData.registro_id);
    
    registradoExitosamente = true;
    
    // 4️⃣ REGISTRAR AUDITORÍA EXITOSA
    console.log('\n4️⃣ Registrando auditoría exitosa...');
    await registrarAuditoria(asistenciaData, true);
    
    console.log('\n' + '='.repeat(70));
    console.log('✅✅✅ PROCESO COMPLETADO EXITOSAMENTE');
    console.log('='.repeat(70));
    
    return {
      success: true,
      docId: asistenciaData.registro_id,
      registroId: asistenciaData.registro_id,
      message: 'Asistencia guardada correctamente con logs completos'
    };
    
  } catch (error) {
    console.error('\n' + '='.repeat(70));
    console.error('❌❌❌ ERROR EN PROCESO DE GUARDADO');
    console.error('='.repeat(70));
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    // 5️⃣ REGISTRAR INTENTO FALLIDO (solo si no fue por duplicado)
    if (!registradoExitosamente && !error.message.includes('DUPLICADO')) {
      console.log('\n5️⃣ Registrando intento fallido...');
      await registrarIntentoFallido(asistenciaData, error);
      await registrarAuditoria(asistenciaData, false);
    }
    
    console.error('='.repeat(70));
    
    // Re-lanzar el error para que lo maneje handleSubmit
    throw error;
  }
}

// ========================================================================================================
// 📊 FUNCIÓN AUXILIAR: Obtener Estadísticas de Logs
// ========================================================================================================
export async function obtenerEstadisticasLogs(email, fechaInicio, fechaFin) {
  try {
    console.log('📊 Obteniendo estadísticas de logs...');
    
    const estadisticas = {
      asistencias: 0,
      intentos_recibidos: 0,
      intentos_fallidos: 0,
      intentos_duplicados: 0,
      tasa_exito: 0
    };
    
    // Contar registros en cada colección
    const colecciones = [
      'asistencias',
      'intentos_recibidos', 
      'intentos_fallidos',
      'intentos_duplicados'
    ];
    
    for (const coleccion of colecciones) {
      const q = query(
        collection(db, coleccion),
        where('email', '==', email)
      );
      
      const snapshot = await getDocs(q);
      estadisticas[coleccion] = snapshot.size;
    }
    
    // Calcular tasa de éxito
    if (estadisticas.intentos_recibidos > 0) {
      estadisticas.tasa_exito = (
        (estadisticas.asistencias / estadisticas.intentos_recibidos) * 100
      ).toFixed(2);
    }
    
    console.log('✅ Estadísticas obtenidas:', estadisticas);
    return estadisticas;
    
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    return null;
  }
}

// ========================================================================================================
// 🔍 FUNCIÓN AUXILIAR: Buscar Registro por ID
// ========================================================================================================
export async function buscarRegistroPorID(registroID) {
  try {
    const q = query(
      collection(db, 'asistencias'),
      where('registro_id', '==', registroID)
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null;
    }
    
    return {
      id: snapshot.docs[0].id,
      data: snapshot.docs[0].data()
    };
    
  } catch (error) {
    console.error('❌ Error buscando registro:', error);
    return null;
  }
}

// ========================================================================================================
// 📝 LOG FINAL
// ========================================================================================================
console.log('✅ firebase-logger.js cargado correctamente');
console.log('📊 Sistema de logs y auditoría Firebase: ACTIVO');
console.log('🔍 Funciones disponibles:');
console.log('   - verificarDuplicado()');
console.log('   - registrarIntentoRecibido()');
console.log('   - registrarIntentoFallido()');
console.log('   - registrarIntentoDuplicado()');
console.log('   - registrarAuditoria()');
console.log('   - guardarAsistenciaConLogs() ← PRINCIPAL');
console.log('   - obtenerEstadisticasLogs()');
console.log('   - buscarRegistroPorID()');
