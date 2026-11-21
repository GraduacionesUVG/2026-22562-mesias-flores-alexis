// src/utils/format.js
// Funciones de formato compartidas para que TODA la app muestre fechas y dinero
// de la misma forma. Solo dan formato a la presentación; no cambian ningún dato
// ni ninguna lógica.
import dayjs from 'dayjs'

// Fecha en formato familiar para Guatemala: DD/MM/AAAA.
// Acepta strings ISO ("2026-06-03"), fechas con hora, objetos Date o dayjs.
// Si el valor no es válido o está vacío, devuelve "—".
export function formatFecha(value, { conHora = false } = {}) {
  if (value === null || value === undefined || value === '') return '—'
  const d = dayjs(value)
  if (!d.isValid()) return '—'
  return d.format(conHora ? 'DD/MM/YYYY HH:mm' : 'DD/MM/YYYY')
}

// Dinero en quetzales: "Q 1,234.50". Siempre con 2 decimales y separador de miles.
// Si el valor no es un número válido, muestra "Q 0.00".
export function formatQuetzales(value) {
  const num = Number(value)
  const seguro = Number.isFinite(num) ? num : 0
  return `Q ${seguro.toLocaleString('es-GT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

// Número simple con separador de miles (sin símbolo de moneda).
export function formatNumero(value) {
  const num = Number(value)
  const seguro = Number.isFinite(num) ? num : 0
  return seguro.toLocaleString('es-GT')
}
