// Semáforo de veredicto: capa comprensible al humano.
//
// Filosofía honesta del proyecto: la máquina NO dicta verdad. Aquí
// distinguimos dos capas:
//
//   1. `auto`   → color inferido de señales duras (match en la base pública
//                 con conclusión clara, C2PA con marca de IA). Por defecto
//                 amarillo. Nunca se convierte solo en verde/rojo salvo con
//                 evidencia técnica inequívoca.
//   2. `humano` → el usuario decide tras revisar. Es su check personal.
//                 Prevalece sobre el auto en la visualización final.
//
// Colores:
//   VERDE   = verdad (contenido auténtico verificado)
//   AMARILLO= no se puede verificar (por defecto — insuficiente evidencia)
//   ROJO    = falso o modificado (requiere descripción de qué parte)

export const STATES = {
  green:  { key: 'green',  emoji: '🟢', i18nKey: 'verdict.green'  },
  yellow: { key: 'yellow', emoji: '🟡', i18nKey: 'verdict.yellow' },
  red:    { key: 'red',    emoji: '🔴', i18nKey: 'verdict.red'    }
};

// Computa el veredicto automático a partir de las señales disponibles.
// Devuelve { state, reasonKey, reasonDetail }
export function computeAutoVerdict({ dbMatches, c2paDetails, exifPresent } = {}) {
  // 1) Coincidencia en la base pública con conclusión definitiva
  if (dbMatches && dbMatches.length > 0) {
    const conclusiones = dbMatches.map(m => m.conclusion);
    if (conclusiones.some(c => c === 'autentico_probable')) {
      return { state: 'green', reasonKey: 'verdict.reason.db_authentic', reasonDetail: null };
    }
    if (conclusiones.some(c => c === 'manipulado_ia_probable' || c === 'manipulado_edicion_probable')) {
      return { state: 'red', reasonKey: 'verdict.reason.db_manipulated', reasonDetail: null };
    }
    // otros: no_concluyente → amarillo con nota
    return { state: 'yellow', reasonKey: 'verdict.reason.db_inconclusive', reasonDetail: null };
  }

  // 2) C2PA con marca de generación por IA
  if (c2paDetails && c2paDetails.signaturesFound) {
    // La detección heurística de C2PA no distingue "generado por IA" vs
    // "cámara con credenciales"; sólo detecta que hay marcas. Por tanto
    // no podemos concluir rojo automáticamente — dejamos amarillo con nota.
    return {
      state: 'yellow',
      reasonKey: 'verdict.reason.c2pa_detected',
      reasonDetail: null
    };
  }

  // 3) Por defecto — insuficiente evidencia automática
  return { state: 'yellow', reasonKey: 'verdict.reason.default', reasonDetail: null };
}
