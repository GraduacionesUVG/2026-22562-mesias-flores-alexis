import ExcelJS from 'exceljs'
import dayjs from 'dayjs'
import { API_BASE_URL } from '../config/api'

// El consumo de materias primas y componentes es ESTIMADO según la receta:
// cantidad_necesaria × unidades que pasaron (salida + pérdida) por el proceso
// vinculado a cada línea del BOM. El sistema no registra consumo físico real.

const GRIS_ENCABEZADO = 'FFE0E0E0'

const toNum = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

const ordenarProcesos = (procesos = []) =>
  procesos.slice().sort((a, b) => (a?.orden ?? 0) - (b?.orden ?? 0))

const getProcesoId = (proc) => proc?.proceso_id ?? proc?.procesoId ?? null

const getProcesoNombre = (procesoId, procesosById) =>
  procesosById[String(procesoId ?? '')]?.nombre ?? `Proceso #${procesoId ?? '?'}`

const esProcesoEmpaque = (procesoId, procesosById) =>
  getProcesoNombre(procesoId, procesosById).toLowerCase().includes('empaque')

export const clasificarTipoProducto = (producto) => {
  if (!producto) return '—'
  if (producto.es_producto_final === false) return 'Componente'
  if (producto.es_terminado === false) return 'A granel'
  return 'Terminado'
}

const getCantidadPlaneada = (orden) =>
  toNum(orden?.cantidad_planeada ?? orden?.cantidadPlaneada ?? orden?.cantidad)

const getOrdenFecha = (orden) =>
  orden?.fecha_inicio ?? orden?.fecha_creacion ?? orden?.created_at ?? orden?.fecha ?? null

const formatFechaCorta = (raw) => (raw ? dayjs(raw).format('DD/MM/YYYY') : '—')

const formatEstadoTexto = (estadoRaw) => {
  const raw = String(estadoRaw ?? '').trim()
  if (!raw) return '—'
  const limpio = raw.replace(/_/g, ' ').toLowerCase()
  return limpio.charAt(0).toUpperCase() + limpio.slice(1)
}

// Entrada efectiva de un proceso: la almacenada, o la planeada si es el
// primero, o la salida del proceso anterior (mismo criterio que Producción).
const getEntradaAuto = (proc, idx, procesos, planeada) => {
  if (proc?.cantidad_entrada != null) return toNum(proc.cantidad_entrada)
  if (idx === 0) return planeada
  return toNum(procesos[idx - 1]?.cantidad_salida)
}

// Unidades que efectivamente pasaron por el proceso vinculado a una línea
// de receta (salida + pérdida). Si la línea no tiene proceso o el proceso
// no está en la orden, se usa el primer proceso de la orden.
const getUnidadesProcesadas = (procesoId, procesosOrden) => {
  let fila = null
  if (procesoId != null) {
    fila = procesosOrden.find((p) => String(getProcesoId(p)) === String(procesoId))
  }
  if (!fila) fila = procesosOrden[0]
  if (!fila) return 0
  return toNum(fila.cantidad_salida) + toNum(fila.cantidad_perdida)
}

const cargarJson = async (url) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Error al consultar ${url}`)
  return res.json()
}

// Carga BOM + componentes de cada producto involucrado, en lotes de 6.
const cargarRecetas = async (productoIds) => {
  const recetas = {}
  for (let i = 0; i < productoIds.length; i += 6) {
    await Promise.all(
      productoIds.slice(i, i + 6).map(async (id) => {
        try {
          const [bom, componentes] = await Promise.all([
            cargarJson(`${API_BASE_URL}/productos/${id}/bom`),
            cargarJson(`${API_BASE_URL}/productos/${id}/componentes`),
          ])
          recetas[id] = { bom: bom || [], componentes: componentes || [] }
        } catch (err) {
          console.error(err)
          recetas[id] = { bom: [], componentes: [] }
        }
      })
    )
  }
  return recetas
}

// ---- Construcción de los datos de cada hoja (sin ExcelJS, testeable) ----
export const construirDatosProduccion = ({
  ordenes,
  procesosById,
  productosById,
  materiasPrimas,
  recetasPorProducto,
}) => {
  const materiasById = new Map((materiasPrimas || []).map((m) => [String(m.id), m]))

  const filasOrdenes = []
  const filasProcesos = []
  const filasMaterias = []
  const filasComponentes = []

  for (const orden of ordenes) {
    const productoId = orden?.producto_id ?? orden?.productoId ?? orden?.producto?.id
    const producto = productosById[String(productoId ?? '')]
    const nombreProducto = producto?.nombre ?? orden?.producto_nombre ?? `Producto #${productoId ?? '?'}`
    const tipo = clasificarTipoProducto(producto)
    const planeada = getCantidadPlaneada(orden)
    const procesos = ordenarProcesos(orden?.procesos || [])
    const ultimo = procesos[procesos.length - 1]
    const producida = toNum(ultimo?.cantidad_salida)
    const perdidaTotal = procesos.reduce((sum, p) => sum + toNum(p.cantidad_perdida), 0)

    filasOrdenes.push({
      codigo: orden?.codigo ?? orden?.id ?? '—',
      fecha: formatFechaCorta(getOrdenFecha(orden)),
      producto: nombreProducto,
      codigoProducto: producto?.codigo ?? '—',
      tipo,
      estado: formatEstadoTexto(orden?.estado),
      prioridad: orden?.prioridad ?? '—',
      planeada,
      producida,
      perdida: perdidaTotal,
      avance: planeada > 0 ? producida / planeada : 0,
      notas: orden?.notas ?? '',
    })

    procesos.forEach((proc, idx) => {
      const entrada = getEntradaAuto(proc, idx, procesos, planeada)
      const salida = toNum(proc.cantidad_salida)
      const perdida = toNum(proc.cantidad_perdida)
      filasProcesos.push({
        ordenCodigo: orden?.codigo ?? orden?.id ?? '—',
        producto: nombreProducto,
        numero: proc?.orden ?? idx + 1,
        proceso: getProcesoNombre(getProcesoId(proc), procesosById),
        estado: formatEstadoTexto(proc?.estado),
        entrada,
        salida,
        perdida,
        pendiente: Math.max(0, entrada - salida - perdida),
      })
    })

    const receta = recetasPorProducto[productoId] || { bom: [], componentes: [] }

    for (const item of receta.bom) {
      const materiaId = item?.materia_prima_id ?? item?.materiaPrimaId
      const materia = materiasById.get(String(materiaId ?? ''))
      const procesoId = item?.proceso_id ?? null
      const necesaria = toNum(item?.cantidad_necesaria ?? item?.cantidad)
      const unidades = getUnidadesProcesadas(procesoId, procesos)
      const consumo = necesaria * unidades
      const costoUnitario = toNum(materia?.costo_unitario)
      filasMaterias.push({
        ordenCodigo: orden?.codigo ?? orden?.id ?? '—',
        producto: nombreProducto,
        materiaId: String(materiaId ?? ''),
        materia: materia?.nombre ?? `Materia prima #${materiaId ?? '?'}`,
        codigoMateria: materia?.codigo ?? '—',
        proceso: procesoId != null ? getProcesoNombre(procesoId, procesosById) : '—',
        empaque: esProcesoEmpaque(procesoId, procesosById) ? 'Sí' : 'No',
        necesaria,
        unidades,
        consumo,
        costoUnitario,
        costoTotal: consumo * costoUnitario,
      })
    }

    for (const item of receta.componentes) {
      const componenteId = item?.componente_id ?? item?.componenteId
      const componente = productosById[String(componenteId ?? '')]
      const procesoId = item?.proceso_id ?? null
      const necesaria = toNum(item?.cantidad_necesaria ?? item?.cantidad)
      const unidades = getUnidadesProcesadas(procesoId, procesos)
      filasComponentes.push({
        ordenCodigo: orden?.codigo ?? orden?.id ?? '—',
        producto: nombreProducto,
        componenteId: String(componenteId ?? ''),
        componente: componente?.nombre ?? `Componente #${componenteId ?? '?'}`,
        codigoComponente: componente?.codigo ?? '—',
        proceso: procesoId != null ? getProcesoNombre(procesoId, procesosById) : '—',
        empaque: esProcesoEmpaque(procesoId, procesosById) ? 'Sí' : 'No',
        necesaria,
        unidades,
        consumo: necesaria * unidades,
      })
    }
  }

  // ---- Agregados para la hoja Resumen ----
  const ordenesPorEstado = new Map()
  const porTipo = new Map()
  for (const fila of filasOrdenes) {
    ordenesPorEstado.set(fila.estado, (ordenesPorEstado.get(fila.estado) ?? 0) + 1)
    const acc = porTipo.get(fila.tipo) ?? { ordenes: 0, planeado: 0, producido: 0, perdida: 0 }
    acc.ordenes += 1
    acc.planeado += fila.planeada
    acc.producido += fila.producida
    acc.perdida += fila.perdida
    porTipo.set(fila.tipo, acc)
  }

  const consumoMaterias = new Map()
  for (const fila of filasMaterias) {
    const key = `${fila.materiaId}|${fila.empaque}`
    const acc = consumoMaterias.get(key) ?? {
      materia: fila.materia,
      codigo: fila.codigoMateria,
      empaque: fila.empaque,
      consumo: 0,
      costoTotal: 0,
    }
    acc.consumo += fila.consumo
    acc.costoTotal += fila.costoTotal
    consumoMaterias.set(key, acc)
  }

  const consumoComponentes = new Map()
  for (const fila of filasComponentes) {
    const acc = consumoComponentes.get(fila.componenteId) ?? {
      componente: fila.componente,
      codigo: fila.codigoComponente,
      consumo: 0,
    }
    acc.consumo += fila.consumo
    consumoComponentes.set(fila.componenteId, acc)
  }

  return {
    filasOrdenes,
    filasProcesos,
    filasMaterias,
    filasComponentes,
    ordenesPorEstado,
    porTipo,
    consumoMaterias: Array.from(consumoMaterias.values()).sort((a, b) => b.consumo - a.consumo),
    consumoComponentes: Array.from(consumoComponentes.values()).sort((a, b) => b.consumo - a.consumo),
  }
}

// ---- Construcción del libro de Excel ----
const FMT_CANTIDAD = '#,##0.###'
const FMT_MONEDA = '"Q" #,##0.00'

const estilizarEncabezado = (ws) => {
  const fila = ws.getRow(1)
  fila.font = { bold: true }
  fila.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS_ENCABEZADO } }
  })
  ws.views = [{ state: 'frozen', ySplit: 1 }]
}

const agregarTituloSeccion = (ws, texto) => {
  const fila = ws.addRow([texto])
  fila.font = { bold: true }
  return fila
}

const agregarEncabezadoSeccion = (ws, valores) => {
  const fila = ws.addRow(valores)
  fila.font = { bold: true }
  fila.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS_ENCABEZADO } }
  })
  return fila
}

export const construirLibroProduccion = (datos, filtros = {}) => {
  const wb = new ExcelJS.Workbook()
  wb.created = new Date()

  // ---- Hoja Resumen ----
  const wsResumen = wb.addWorksheet('Resumen')
  wsResumen.columns = [
    { width: 34 },
    { width: 16 },
    { width: 12 },
    { width: 14 },
    { width: 16 },
  ]
  const titulo = wsResumen.addRow(['Reporte de producción'])
  titulo.font = { bold: true, size: 14 }
  wsResumen.addRow([`Generado: ${dayjs().format('DD/MM/YYYY HH:mm')}`])
  const partesFiltro = []
  partesFiltro.push(`Estado: ${filtros.estado ? formatEstadoTexto(filtros.estado) : 'Todos'}`)
  partesFiltro.push(`Desde: ${filtros.desde ? formatFechaCorta(filtros.desde) : '—'}`)
  partesFiltro.push(`Hasta: ${filtros.hasta ? formatFechaCorta(filtros.hasta) : '—'}`)
  wsResumen.addRow([`Filtros — ${partesFiltro.join('  |  ')}`])
  wsResumen.addRow([])

  agregarTituloSeccion(wsResumen, 'ÓRDENES POR ESTADO')
  agregarEncabezadoSeccion(wsResumen, ['Estado', 'Órdenes'])
  for (const [estado, cantidad] of datos.ordenesPorEstado) {
    wsResumen.addRow([estado, cantidad])
  }
  wsResumen.addRow([])

  agregarTituloSeccion(wsResumen, 'PRODUCCIÓN POR TIPO DE PRODUCTO')
  agregarEncabezadoSeccion(wsResumen, ['Tipo', 'Órdenes', 'Planeado', 'Producido', 'Pérdida'])
  for (const tipo of ['Terminado', 'A granel', 'Componente']) {
    const acc = datos.porTipo.get(tipo)
    if (!acc) continue
    const fila = wsResumen.addRow([tipo, acc.ordenes, acc.planeado, acc.producido, acc.perdida])
    ;[3, 4, 5].forEach((col) => {
      fila.getCell(col).numFmt = FMT_CANTIDAD
    })
  }
  wsResumen.addRow([])

  agregarTituloSeccion(wsResumen, 'CONSUMO ESTIMADO DE MATERIAS PRIMAS')
  agregarEncabezadoSeccion(wsResumen, ['Materia prima', 'Código', 'Empaque', 'Consumo', 'Costo estimado'])
  for (const item of datos.consumoMaterias) {
    const fila = wsResumen.addRow([item.materia, item.codigo, item.empaque, item.consumo, item.costoTotal])
    fila.getCell(4).numFmt = FMT_CANTIDAD
    fila.getCell(5).numFmt = FMT_MONEDA
  }
  wsResumen.addRow([])

  agregarTituloSeccion(wsResumen, 'CONSUMO ESTIMADO DE COMPONENTES')
  agregarEncabezadoSeccion(wsResumen, ['Componente', 'Código', '', 'Consumo'])
  for (const item of datos.consumoComponentes) {
    const fila = wsResumen.addRow([item.componente, item.codigo, '', item.consumo])
    fila.getCell(4).numFmt = FMT_CANTIDAD
  }
  wsResumen.addRow([])
  wsResumen.addRow([
    'Nota: el consumo es estimado según la receta (BOM/componentes) × unidades procesadas (salida + pérdida) del proceso vinculado.',
  ]).font = { italic: true, size: 9 }

  // ---- Hoja Órdenes ----
  const wsOrdenes = wb.addWorksheet('Órdenes')
  wsOrdenes.columns = [
    { header: 'Código', key: 'codigo', width: 24 },
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Producto', key: 'producto', width: 32 },
    { header: 'Cód. producto', key: 'codigoProducto', width: 13 },
    { header: 'Tipo', key: 'tipo', width: 12 },
    { header: 'Estado', key: 'estado', width: 13 },
    { header: 'Prioridad', key: 'prioridad', width: 10 },
    { header: 'Planeada', key: 'planeada', width: 10 },
    { header: 'Producida', key: 'producida', width: 10 },
    { header: 'Pérdida', key: 'perdida', width: 10 },
    { header: '% Avance', key: 'avance', width: 10 },
    { header: 'Notas', key: 'notas', width: 32 },
  ]
  datos.filasOrdenes.forEach((f) => wsOrdenes.addRow(f))
  wsOrdenes.getColumn('planeada').numFmt = FMT_CANTIDAD
  wsOrdenes.getColumn('producida').numFmt = FMT_CANTIDAD
  wsOrdenes.getColumn('perdida').numFmt = FMT_CANTIDAD
  wsOrdenes.getColumn('avance').numFmt = '0%'
  estilizarEncabezado(wsOrdenes)

  // ---- Hoja Unidades por proceso ----
  const wsProcesos = wb.addWorksheet('Unidades por proceso')
  wsProcesos.columns = [
    { header: 'Orden', key: 'ordenCodigo', width: 24 },
    { header: 'Producto', key: 'producto', width: 32 },
    { header: '#', key: 'numero', width: 5 },
    { header: 'Proceso', key: 'proceso', width: 20 },
    { header: 'Estado', key: 'estado', width: 13 },
    { header: 'Entrada', key: 'entrada', width: 10 },
    { header: 'Salida', key: 'salida', width: 10 },
    { header: 'Pérdida', key: 'perdida', width: 10 },
    { header: 'Pendiente', key: 'pendiente', width: 10 },
  ]
  datos.filasProcesos.forEach((f) => wsProcesos.addRow(f))
  ;['entrada', 'salida', 'perdida', 'pendiente'].forEach((key) => {
    wsProcesos.getColumn(key).numFmt = FMT_CANTIDAD
  })
  estilizarEncabezado(wsProcesos)

  // ---- Hoja Consumo materias primas ----
  const wsMaterias = wb.addWorksheet('Consumo materias primas')
  wsMaterias.columns = [
    { header: 'Orden', key: 'ordenCodigo', width: 24 },
    { header: 'Producto', key: 'producto', width: 32 },
    { header: 'Materia prima', key: 'materia', width: 28 },
    { header: 'Código', key: 'codigoMateria', width: 13 },
    { header: 'Proceso', key: 'proceso', width: 18 },
    { header: 'Empaque', key: 'empaque', width: 9 },
    { header: 'Necesaria/u', key: 'necesaria', width: 11 },
    { header: 'Unidades procesadas', key: 'unidades', width: 18 },
    { header: 'Consumo estimado', key: 'consumo', width: 16 },
    { header: 'Costo unitario', key: 'costoUnitario', width: 13 },
    { header: 'Costo estimado', key: 'costoTotal', width: 14 },
  ]
  datos.filasMaterias.forEach((f) => wsMaterias.addRow(f))
  ;['necesaria', 'unidades', 'consumo'].forEach((key) => {
    wsMaterias.getColumn(key).numFmt = FMT_CANTIDAD
  })
  ;['costoUnitario', 'costoTotal'].forEach((key) => {
    wsMaterias.getColumn(key).numFmt = FMT_MONEDA
  })
  estilizarEncabezado(wsMaterias)

  // ---- Hoja Consumo componentes ----
  const wsComponentes = wb.addWorksheet('Consumo componentes')
  wsComponentes.columns = [
    { header: 'Orden', key: 'ordenCodigo', width: 24 },
    { header: 'Producto', key: 'producto', width: 32 },
    { header: 'Componente', key: 'componente', width: 28 },
    { header: 'Código', key: 'codigoComponente', width: 13 },
    { header: 'Proceso', key: 'proceso', width: 18 },
    { header: 'Empaque', key: 'empaque', width: 9 },
    { header: 'Necesaria/u', key: 'necesaria', width: 11 },
    { header: 'Unidades procesadas', key: 'unidades', width: 18 },
    { header: 'Consumo estimado', key: 'consumo', width: 16 },
  ]
  datos.filasComponentes.forEach((f) => wsComponentes.addRow(f))
  ;['necesaria', 'unidades', 'consumo'].forEach((key) => {
    wsComponentes.getColumn(key).numFmt = FMT_CANTIDAD
  })
  estilizarEncabezado(wsComponentes)

  return wb
}

// ---- Punto de entrada desde la página ----
export const exportarProduccionExcel = async ({ ordenes, procesosById, productosById, filtros }) => {
  const productoIds = Array.from(
    new Set(
      ordenes
        .map((o) => o?.producto_id ?? o?.productoId ?? o?.producto?.id)
        .filter((id) => id != null)
    )
  )

  const [materiasPrimas, recetasPorProducto] = await Promise.all([
    cargarJson(`${API_BASE_URL}/materias-primas`),
    cargarRecetas(productoIds),
  ])

  const datos = construirDatosProduccion({
    ordenes,
    procesosById,
    productosById,
    materiasPrimas,
    recetasPorProducto,
  })

  const wb = construirLibroProduccion(datos, filtros)
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = `reporte_produccion_${dayjs().format('YYYY-MM-DD')}.xlsx`
  document.body.appendChild(enlace)
  enlace.click()
  document.body.removeChild(enlace)
  URL.revokeObjectURL(url)
}
