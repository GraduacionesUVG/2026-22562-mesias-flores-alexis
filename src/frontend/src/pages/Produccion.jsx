import * as React from 'react'
import {
  Box,
  Paper,
  Typography,
  Stack,
  TextField,
  Button,
  IconButton,
  Tooltip,
  Chip,
  CircularProgress,
  MenuItem,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  Tabs,
  Tab,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import RefreshIcon from '@mui/icons-material/Refresh'
import BlockIcon from '@mui/icons-material/Block'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import SearchIcon from '@mui/icons-material/Search'
import EditIcon from '@mui/icons-material/Edit'
import { useSearchParams } from 'react-router-dom'
import { API_BASE_URL } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { useConfirm } from '../components/ConfirmProvider'
import { formatFecha, formatNumero } from '../utils/format'

// Etiquetas legibles para los estados. Se usan SOLO al mostrar en pantalla;
// la lógica sigue comparando los valores crudos ('PENDIENTE', 'COMPLETADO', etc.).
const ETIQUETA_ESTADO = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  EN_PROGRESO: 'En progreso',
  PARCIAL: 'Parcial',
  COMPLETADO: 'Completado',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
  CANCELADO: 'Cancelado',
  PLANEADA: 'Planeada',
  PLANEADO: 'Planeado',
}

// Texto legible para un estado (sin alterar el valor original).
const etiquetaEstado = (estado) => {
  if (estado == null || estado === '') return '—'
  const clave = String(estado).toUpperCase()
  return ETIQUETA_ESTADO[clave] ?? estado
}

// Color del Chip según el estado (solo presentación).
const colorEstado = (estado) => {
  switch (String(estado || '').toUpperCase()) {
    case 'COMPLETADO':
    case 'COMPLETADA':
      return 'success'
    case 'EN_PROCESO':
    case 'EN_PROGRESO':
    case 'PARCIAL':
      return 'info'
    case 'CANCELADA':
    case 'CANCELADO':
      return 'error'
    case 'PENDIENTE':
    case 'PLANEADA':
    case 'PLANEADO':
      return 'warning'
    default:
      return 'default'
  }
}

// Chip de estado reutilizable para mostrar el estado de forma clara.
const EstadoChip = ({ estado }) => {
  if (estado == null || estado === '') {
    return <Typography component="span" variant="body2" color="text.secondary">—</Typography>
  }
  return (
    <Chip
      size="small"
      label={etiquetaEstado(estado)}
      color={colorEstado(estado)}
      variant={colorEstado(estado) === 'default' ? 'outlined' : 'filled'}
    />
  )
}

const PRIORIDADES = [
  { id: 'ALTA', label: 'ALTA' },
  { id: 'MEDIA', label: 'MEDIA' },
  { id: 'BAJA', label: 'BAJA' },
]

const getProductoNombre = (orden) =>
  orden?.producto?.nombre ??
  orden?.producto_nombre ??
  orden?.productoNombre ??
  '—'

const ordenarProcesos = (procesos) =>
  procesos
    .slice()
    .sort((a, b) => (a?.orden ?? 0) - (b?.orden ?? 0))

const isOrdenCancelada = (orden) => String(orden?.estado || '').toUpperCase() === 'CANCELADA'

const getProcesoNombre = (proceso, procesosById) =>
  procesosById[String(proceso?.proceso_id ?? proceso?.procesoId ?? '')]?.nombre ??
  proceso?.proceso_nombre ??
  proceso?.proceso?.nombre ??
  proceso?.proceso_id ??
  '—'

// Identificador del proceso del catálogo, para poder sumar el mismo proceso
// entre órdenes distintas (cada orden tiene su propia fila de proceso con id propio).
const getProcesoKey = (proceso) =>
  String(proceso?.proceso_id ?? proceso?.procesoId ?? proceso?.id ?? '')

const getOrdenFecha = (orden) =>
  orden?.fecha_inicio ??
  orden?.fecha_creacion ??
  orden?.created_at ??
  orden?.fecha ??
  null

// De la más vieja a la más nueva. Si no hay fecha, se usa el id como aproximación.
const compareOrdenes = (a, b) => {
  const fechaA = getOrdenFecha(a)
  const fechaB = getOrdenFecha(b)
  const tA = fechaA ? new Date(fechaA).getTime() : NaN
  const tB = fechaB ? new Date(fechaB).getTime() : NaN
  const validA = Number.isFinite(tA)
  const validB = Number.isFinite(tB)
  if (validA && validB && tA !== tB) return tA - tB
  if (validA && !validB) return -1
  if (!validA && validB) return 1
  return (Number(a?.id) || 0) - (Number(b?.id) || 0)
}

const toNumero = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

// Entrada efectiva de un proceso: la registrada, o la planeada (primer proceso)
// o la salida del proceso anterior.
const getEntradaAuto = (orden, procesosOrdenados, idx) => {
  const proc = procesosOrdenados[idx]
  const prevProc = idx > 0 ? procesosOrdenados[idx - 1] : null
  return (
    Number(proc?.cantidad_entrada) ||
    (idx === 0
      ? Number(orden?.cantidad_planeada || 0)
      : Number(prevProc?.cantidad_salida || 0))
  )
}

// Cuánto le falta por procesar a un proceso dentro de una orden.
const getPendienteProceso = (orden, procesosOrdenados, idx) => {
  const proc = procesosOrdenados[idx]
  const entrada = getEntradaAuto(orden, procesosOrdenados, idx)
  if (!Number.isFinite(entrada) || entrada <= 0) return 0
  const pendiente = entrada - toNumero(proc?.cantidad_salida) - toNumero(proc?.cantidad_perdida)
  return pendiente > 0 ? pendiente : 0
}

// Tipos de producto que se manejan en producción. En el backend la diferencia
// es el flag `es_terminado` del producto: a granel (false) y terminado (true).
const TIPO_TODOS = 'todos'
const TIPO_AGRANEL = 'agranel'
const TIPO_TERMINADO = 'terminado'

const ETIQUETA_TIPO = {
  [TIPO_TODOS]: 'Todos',
  [TIPO_AGRANEL]: 'A granel',
  [TIPO_TERMINADO]: 'Terminado',
}

const tipoDeProducto = (producto) =>
  producto?.es_terminado ? TIPO_TERMINADO : TIPO_AGRANEL

// ¿El producto entra en la pestaña indicada? 'todos' no filtra nada.
const coincideTipo = (producto, tipo) =>
  tipo === TIPO_TODOS || tipoDeProducto(producto) === tipo

// Clave para ordenar nombres de producto de forma natural: sin tildes, sin
// mayúsculas y sin el espacio que a veces queda después del '#'. Sin esto,
// "Olla Orquidea # 16" quedaba antes que "Olla Orquídea #12".
const claveOrdenNombre = (nombre) =>
  String(nombre ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/#\s+/g, '#')
    .trim()
    .toLowerCase()

const compararNombres = (a, b) =>
  claveOrdenNombre(a).localeCompare(claveOrdenNombre(b), 'es', {
    numeric: true,
    sensitivity: 'base',
  })

// Id de la orden más nueva del grupo. Las órdenes no siempre traen fecha de
// inicio, pero el id sí es creciente, así que sirve para ordenar por reciente.
const idUltimaOrden = (grupo) =>
  (grupo?.ordenes || []).reduce((max, orden) => Math.max(max, Number(orden?.id) || 0), 0)

const ORDENAMIENTOS = [
  { id: 'nombre', label: 'Nombre' },
  { id: 'pendiente', label: 'Más pendiente' },
  { id: 'reciente', label: 'Más reciente' },
]

export default function Produccion() {
  const { hasAnyPermiso, isAdmin, permisos } = useAuth()
  const confirm = useConfirm()
  const [searchParams, setSearchParams] = useSearchParams()
  const canDeleteOrden = hasAnyPermiso(['maestro'])
  // hasAnyPermiso() responde true a cualquier permiso cuando el usuario es
  // maestro, así que el rol maestro se detecta aquí de forma explícita.
  const esMaestro =
    isAdmin ||
    (permisos || []).some((p) => String(p || '').trim().toLowerCase() === 'maestro')
  // Bodega (sin permiso de Produccion) solo trabaja producto terminado.
  // Produccion ve los dos tipos, separados en pestañas. Maestro ve todo junto.
  const rolTipo = esMaestro
    ? 'maestro'
    : hasAnyPermiso(['Produccion'])
      ? 'produccion'
      : 'bodega'
  const tiposDisponibles = React.useMemo(() => {
    if (rolTipo === 'maestro') return [TIPO_TODOS, TIPO_AGRANEL, TIPO_TERMINADO]
    if (rolTipo === 'produccion') return [TIPO_AGRANEL, TIPO_TERMINADO]
    return [TIPO_TERMINADO]
  }, [rolTipo])
  // La pestaña vive en la URL (?tipo=) para que recargar no la pierda y para
  // poder enlazarla desde otras pantallas. Si viene una inválida, se usa la
  // primera disponible según el rol.
  const tipoParam = String(searchParams.get('tipo') || '').toLowerCase()
  const tipoActivo = tiposDisponibles.includes(tipoParam)
    ? tipoParam
    : tiposDisponibles[0]
  const [ordenes, setOrdenes] = React.useState([])
  const [loadingOrdenes, setLoadingOrdenes] = React.useState(false)
  const [errorOrdenes, setErrorOrdenes] = React.useState('')
  const [productos, setProductos] = React.useState([])
  const [procesosCatalogo, setProcesosCatalogo] = React.useState([])
  const [selectedProductoId, setSelectedProductoId] = React.useState(null)
  const [busquedaProducto, setBusquedaProducto] = React.useState('')
  const [ordenarPor, setOrdenarPor] = React.useState('nombre')
  const [openCrearOrden, setOpenCrearOrden] = React.useState(false)
  // Avisos apilados: cada llamada agrega una tarjeta en lugar de sobreescribir
  // la anterior, para que errores consecutivos (p. ej. iniciar + completar)
  // se vean todos. Mantiene la firma setSnack({ open, msg, severity }).
  const [snacks, setSnacks] = React.useState([])
  const snackIdRef = React.useRef(0)
  const cerrarSnack = React.useCallback((id) => {
    setSnacks((prev) => prev.filter((s) => s.id !== id))
  }, [])
  const setSnack = React.useCallback(
    (aviso) => {
      if (typeof aviso !== 'object' || !aviso?.open) return
      const id = ++snackIdRef.current
      setSnacks((prev) => [...prev, { id, msg: aviso.msg, severity: aviso.severity || 'info' }])
      setTimeout(() => cerrarSnack(id), 6000)
    },
    [cerrarSnack]
  )

  const [form, setForm] = React.useState({
    codigo: '',
    productoId: '',
    cantidadPlaneada: '',
    prioridad: 'MEDIA',
    notas: '',
  })

  // Inputs del resumen por proceso (key = proceso del catálogo).
  const [resumenInputs, setResumenInputs] = React.useState({})
  const [aplicandoKey, setAplicandoKey] = React.useState(null)

  // Diálogo de edición correctiva de cantidades de UNA orden. Es un flujo
  // aparte del avance normal: usa el endpoint transaccional de cantidades
  // y no inicia, completa ni consume nada.
  const [editOrden, setEditOrden] = React.useState(null)
  const [editRows, setEditRows] = React.useState([])
  const [guardandoEdicion, setGuardandoEdicion] = React.useState(false)

  const productosById = React.useMemo(() => {
    return productos.reduce((acc, item) => {
      if (item?.id != null) acc[String(item.id)] = item
      return acc
    }, {})
  }, [productos])

  // Si llegamos con ?crear=<productoId> (desde las alertas de stock del
  // dashboard), abre el diálogo de nueva orden con el producto preseleccionado.
  React.useEffect(() => {
    if (productos.length === 0) return
    const crearId = searchParams.get('crear')
    if (!crearId) return
    const producto = productos.find((p) => String(p.id) === String(crearId))
    if (!producto) return
    const tipoProducto = tipoDeProducto(producto)
    const permitido =
      tiposDisponibles.includes(TIPO_TODOS) || tiposDisponibles.includes(tipoProducto)
    if (!permitido) return
    setForm((prev) => ({ ...prev, productoId: producto.id }))
    setOpenCrearOrden(true)
    // Se consume el ?crear= y, si hace falta, se cambia a la pestaña del
    // producto para que la orden recién creada quede a la vista.
    const next = new URLSearchParams(searchParams)
    next.delete('crear')
    if (!coincideTipo(producto, tipoActivo)) next.set('tipo', tipoProducto)
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, productos, tipoActivo, tiposDisponibles])

  const procesosById = React.useMemo(() => {
    return procesosCatalogo.reduce((acc, item) => {
      if (item?.id != null) acc[String(item.id)] = item
      return acc
    }, {})
  }, [procesosCatalogo])

  // Agrupa las órdenes no completadas por producto y calcula el resumen
  // de cada proceso sumando todas las órdenes activas del producto.
  const grupos = React.useMemo(() => {
    const visibles = ordenes.filter((orden) => {
      if (String(orden?.estado || '').toUpperCase() === 'COMPLETADA') return false
      const key = String(orden?.producto_id ?? orden?.productoId ?? orden?.producto?.id ?? 's/p')
      const producto = productosById[key] || orden?.producto
      return coincideTipo(producto, tipoActivo)
    })
    const porProducto = new Map()
    for (const orden of visibles) {
      const key = String(orden?.producto_id ?? orden?.productoId ?? orden?.producto?.id ?? 's/p')
      if (!porProducto.has(key)) porProducto.set(key, [])
      porProducto.get(key).push(orden)
    }

    const lista = []
    for (const [productoId, items] of porProducto.entries()) {
      const ordenadas = items.slice().sort(compareOrdenes)
      const activas = ordenadas.filter((orden) => !isOrdenCancelada(orden))
      const producto =
        ordenadas[0]?.producto || productosById[productoId] || null
      const nombre = producto?.nombre ?? getProductoNombre(ordenadas[0])

      // Ruta de procesos del producto (unión de los procesos de sus órdenes).
      const ruta = []
      const vistos = new Set()
      for (const orden of [...activas, ...ordenadas]) {
        for (const proc of ordenarProcesos(orden?.procesos || [])) {
          const key = getProcesoKey(proc)
          if (!vistos.has(key)) {
            vistos.add(key)
            ruta.push({ key, proc })
          }
        }
      }
      ruta.sort((a, b) => (a.proc?.orden ?? 0) - (b.proc?.orden ?? 0))

      // Resumen por proceso: totales de todas las órdenes activas (no canceladas).
      const resumen = {}
      for (const { key } of ruta) {
        resumen[key] = { entrada: 0, salida: 0, perdida: 0, pendiente: 0, total: 0, completados: 0 }
      }
      for (const orden of activas) {
        const procs = ordenarProcesos(orden?.procesos || [])
        procs.forEach((proc, idx) => {
          const acc = resumen[getProcesoKey(proc)]
          if (!acc) return
          const entrada = getEntradaAuto(orden, procs, idx)
          acc.entrada += entrada > 0 ? entrada : 0
          acc.salida += toNumero(proc?.cantidad_salida)
          acc.perdida += toNumero(proc?.cantidad_perdida)
          acc.pendiente += getPendienteProceso(orden, procs, idx)
          acc.total += 1
          if (String(proc?.estado || '').toUpperCase() === 'COMPLETADO') acc.completados += 1
        })
      }

      const totalPlaneado = activas.reduce((s, o) => s + toNumero(o?.cantidad_planeada), 0)
      const totalEnProduccion = ruta.reduce((s, { key }) => s + (resumen[key]?.pendiente || 0), 0)

      lista.push({
        productoId,
        producto,
        nombre,
        ordenes: ordenadas,
        activas,
        ruta,
        resumen,
        totalPlaneado,
        totalEnProduccion,
      })
    }

    lista.sort((a, b) => compararNombres(a.nombre, b.nombre))
    return lista
  }, [ordenes, productosById, tipoActivo])

  const grupoSeleccionado = React.useMemo(
    () => grupos.find((g) => g.productoId === selectedProductoId) ?? null,
    [grupos, selectedProductoId]
  )

  // Tarjetas de productos filtradas por el buscador (nombre o código del
  // producto) y ordenadas según el criterio elegido.
  const gruposFiltrados = React.useMemo(() => {
    const texto = busquedaProducto.trim().toLowerCase()
    const base = !texto
      ? grupos
      : grupos.filter((grupo) => {
          const nombre = String(grupo.nombre ?? '').toLowerCase()
          const codigo = String(grupo.producto?.codigo ?? '').toLowerCase()
          return nombre.includes(texto) || codigo.includes(texto)
        })
    const lista = base.slice()
    if (ordenarPor === 'pendiente') {
      lista.sort(
        (a, b) =>
          b.totalEnProduccion - a.totalEnProduccion || compararNombres(a.nombre, b.nombre)
      )
    } else if (ordenarPor === 'reciente') {
      lista.sort(
        (a, b) => idUltimaOrden(b) - idUltimaOrden(a) || compararNombres(a.nombre, b.nombre)
      )
    }
    return lista
  }, [grupos, busquedaProducto, ordenarPor])

  // Órdenes activas por tipo, para los contadores de las pestañas. Se cuenta
  // sobre todas las órdenes, no solo sobre las de la pestaña activa.
  const conteoPorTipo = React.useMemo(() => {
    const conteo = { [TIPO_TODOS]: 0, [TIPO_AGRANEL]: 0, [TIPO_TERMINADO]: 0 }
    for (const orden of ordenes) {
      if (String(orden?.estado || '').toUpperCase() === 'COMPLETADA') continue
      if (isOrdenCancelada(orden)) continue
      const key = String(orden?.producto_id ?? orden?.productoId ?? orden?.producto?.id ?? 's/p')
      const producto = productosById[key] || orden?.producto
      conteo[TIPO_TODOS] += 1
      conteo[tipoDeProducto(producto)] += 1
    }
    return conteo
  }, [ordenes, productosById])

  // El selector de "Crear orden" respeta la pestaña activa: en A granel solo
  // aparecen productos a granel y en Terminado solo terminados.
  const productosParaCrear = React.useMemo(
    () => productos.filter((producto) => coincideTipo(producto, tipoActivo)),
    [productos, tipoActivo]
  )

  // Al cambiar de pestaña se vuelve a la vista de tarjetas y se limpia lo que
  // haya quedado seleccionado del tipo anterior.
  const cambiarTipo = (tipo) => {
    if (!tipo || tipo === tipoActivo) return
    const next = new URLSearchParams(searchParams)
    next.set('tipo', tipo)
    next.delete('crear')
    setSearchParams(next, { replace: true })
    setSelectedProductoId(null)
    setBusquedaProducto('')
    setForm((prev) => ({ ...prev, productoId: '' }))
  }

  // Si el producto seleccionado ya no tiene órdenes activas, regresar a la vista de productos.
  React.useEffect(() => {
    if (selectedProductoId && !loadingOrdenes && !grupoSeleccionado) {
      setSelectedProductoId(null)
    }
  }, [selectedProductoId, grupoSeleccionado, loadingOrdenes])

  // Al cambiar de producto se limpian los inputs del resumen.
  React.useEffect(() => {
    setResumenInputs({})
  }, [selectedProductoId])

  const cargarOrdenes = async () => {
    try {
      setLoadingOrdenes(true)
      setErrorOrdenes('')
      const res = await fetch(`${API_BASE_URL}/ordenes-produccion`)
      if (!res.ok) throw new Error('Error al obtener órdenes de producción')
      const data = await res.json()
      const ordenesBase = Array.isArray(data) ? data : []
      const ordenesConProcesos = await Promise.all(
        ordenesBase.map(async (orden) => {
          if (!orden?.id) return { ...orden, procesos: [] }
          try {
            const resProcesos = await fetch(
              `${API_BASE_URL}/ordenes-produccion/${orden.id}/procesos`
            )
            if (!resProcesos.ok) throw new Error('Error al obtener procesos')
            const procesos = await resProcesos.json()
            return { ...orden, procesos: procesos || [] }
          } catch (err) {
            console.error(err)
            return { ...orden, procesos: [] }
          }
        })
      )
      setOrdenes(ordenesConProcesos)
    } catch (err) {
      console.error(err)
      setErrorOrdenes('No se pudieron cargar las órdenes')
    } finally {
      setLoadingOrdenes(false)
    }
  }

  const cargarProductos = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/productos`)
      if (!res.ok) throw new Error('Error al obtener productos')
      const data = await res.json()
      setProductos(data || [])
    } catch (err) {
      console.error(err)
    }
  }

  const cargarProcesosCatalogo = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/procesos`)
      if (!res.ok) throw new Error('Error al obtener procesos')
      const data = await res.json()
      setProcesosCatalogo(data || [])
    } catch (err) {
      console.error(err)
    }
  }

  React.useEffect(() => {
    cargarOrdenes()
    cargarProductos()
    cargarProcesosCatalogo()
  }, [])

  const handleOpenCrearOrden = () => {
    setOpenCrearOrden(true)
  }

  const handleCloseCrearOrden = () => {
    setOpenCrearOrden(false)
  }

  const handleEliminarOrden = async (ordenId) => {
    if (!ordenId) return
    const ok = await confirm({
      title: 'Eliminar orden de producción',
      message: '¿Seguro que quieres eliminar esta orden de producción? Esta acción no se puede deshacer.',
      confirmText: 'Sí, eliminar',
      cancelText: 'No, volver',
      severity: 'error',
    })
    if (!ok) return
    try {
      const res = await fetch(`${API_BASE_URL}/ordenes-produccion/${ordenId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const txt = await res.text()
        let msg = 'No se pudo eliminar la orden'
        try {
          const parsed = JSON.parse(txt)
          msg = parsed.error || msg
        } catch (_) {
          // noop
        }
        setSnack({ open: true, msg, severity: 'error' })
        return
      }
      setSnack({ open: true, msg: 'Orden eliminada', severity: 'success' })
      await cargarOrdenes()
    } catch (err) {
      console.error(err)
      setSnack({
        open: true,
        msg: 'Error de red al eliminar orden',
        severity: 'error',
      })
    }
  }

  const handleCancelarOrden = async (ordenId) => {
    if (!ordenId) return
    const ok = await confirm({
      title: 'Cancelar orden de producción',
      message: '¿Seguro que quieres cancelar esta orden de producción? Quedará bloqueada y solo se podrá eliminar.',
      confirmText: 'Sí, cancelar orden',
      cancelText: 'No, volver',
      severity: 'error',
    })
    if (!ok) return

    try {
      const res = await fetch(`${API_BASE_URL}/ordenes-produccion/${ordenId}/cancelar`, {
        method: 'POST',
      })

      if (!res.ok) {
        const txt = await res.text()
        let msg = 'No se pudo cancelar la orden'
        try {
          const parsed = JSON.parse(txt)
          msg = parsed.error || parsed.message || msg
        } catch (_) {
          // noop
        }
        setSnack({ open: true, msg, severity: 'error' })
        return
      }

      setSnack({ open: true, msg: 'Orden cancelada', severity: 'success' })
      await cargarOrdenes()
    } catch (err) {
      console.error(err)
      setSnack({
        open: true,
        msg: 'Error de red al cancelar orden',
        severity: 'error',
      })
    }
  }

  // Llama al backend para una acción de proceso ('iniciar' / 'completar').
  // Devuelve true/false; muestra snack solo si hay error.
  const ejecutarAccionProceso = async (ordenId, procesoOrdenId, accion, payload) => {
    if (!ordenId || !procesoOrdenId) return false
    try {
      const res = await fetch(
        `${API_BASE_URL}/ordenes-produccion/${ordenId}/procesos/${procesoOrdenId}/${accion}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload ? JSON.stringify(payload) : null,
        }
      )

      if (!res.ok) {
        const txt = await res.text()
        let msg = 'No se pudo actualizar el proceso'
        try {
          const parsed = JSON.parse(txt)
          msg = parsed.error || msg
        } catch (_) {
          // noop
        }
        setSnack({ open: true, msg, severity: 'error' })
        return false
      }
      return true
    } catch (err) {
      console.error(err)
      setSnack({
        open: true,
        msg: 'Error de red al actualizar proceso',
        severity: 'error',
      })
      return false
    }
  }

  // Registra salida/pérdida en el proceso idx de una orden y propaga la salida
  // como entrada del siguiente proceso (misma lógica que la edición por orden anterior).
  const aplicarMovimientoProceso = async (orden, procesosOrdenados, idx, salidaDelta, perdidaDelta) => {
    const proc = procesosOrdenados[idx]
    if (!orden?.id || !proc?.id) return false
    const prevProc = idx > 0 ? procesosOrdenados[idx - 1] : null
    const entrada = getEntradaAuto(orden, procesosOrdenados, idx)
    const salidaTotal = toNumero(proc?.cantidad_salida) + salidaDelta
    const perdidaTotal = toNumero(proc?.cantidad_perdida) + perdidaDelta

    let completar = salidaTotal >= entrada - perdidaTotal
    if (
      completar &&
      prevProc &&
      String(prevProc?.estado || '').toUpperCase() !== 'COMPLETADO'
    ) {
      completar = false
    }

    if (String(proc?.estado || '').toUpperCase() === 'PENDIENTE') {
      await ejecutarAccionProceso(orden.id, proc.id, 'iniciar')
    }

    const payload = {
      cantidad_entrada: entrada,
      cantidad_salida: salidaTotal,
      ...(perdidaDelta > 0 ? { cantidad_perdida: perdidaTotal } : {}),
      ...(completar ? {} : { parcial: true }),
    }

    const ok = await ejecutarAccionProceso(orden.id, proc.id, 'completar', payload)
    if (!ok) return false

    if (idx < procesosOrdenados.length - 1 && salidaDelta > 0) {
      const nextProc = procesosOrdenados[idx + 1]
      if (nextProc?.id) {
        const nuevaEntrada = toNumero(nextProc?.cantidad_entrada) + salidaDelta
        let siguienteIniciado = String(nextProc?.estado || '').toUpperCase() !== 'PENDIENTE'
        if (!siguienteIniciado) {
          siguienteIniciado = await ejecutarAccionProceso(orden.id, nextProc.id, 'iniciar')
        }
        if (siguienteIniciado) {
          await ejecutarAccionProceso(orden.id, nextProc.id, 'completar', {
            cantidad_entrada: nuevaEntrada,
            cantidad_salida: toNumero(nextProc?.cantidad_salida),
            parcial: true,
          })
        }
      }
    }
    return true
  }

  // Aplica lo escrito en el resumen de un proceso, repartiéndolo entre las
  // órdenes activas del producto, de la más antigua a la más reciente.
  const handleAplicarResumen = async (grupo, key) => {
    const inputs = resumenInputs[key] || {}
    const salidaDeseada = Math.max(toNumero(inputs.salida), 0)
    const perdidaDeseada = Math.max(toNumero(inputs.perdida), 0)

    if (salidaDeseada <= 0 && perdidaDeseada <= 0) {
      setSnack({ open: true, msg: 'Ingresa una cantidad de salida o pérdida', severity: 'error' })
      return
    }

    setAplicandoKey(key)
    let salidaRestante = salidaDeseada
    let perdidaRestante = perdidaDeseada
    let ordenesActualizadas = 0
    let huboError = false

    try {
      for (const orden of grupo.activas) {
        if (salidaRestante <= 0 && perdidaRestante <= 0) break
        const procs = ordenarProcesos(orden?.procesos || [])
        const idx = procs.findIndex((p) => getProcesoKey(p) === key)
        if (idx < 0) continue
        const proc = procs[idx]
        if (String(proc?.estado || '').toUpperCase() === 'COMPLETADO') continue

        const entrada = getEntradaAuto(orden, procs, idx)
        if (!Number.isFinite(entrada) || entrada <= 0) continue

        let capacidad = entrada - toNumero(proc?.cantidad_salida) - toNumero(proc?.cantidad_perdida)
        if (capacidad <= 0) continue

        const salidaAplicar = Math.min(salidaRestante, capacidad)
        capacidad -= salidaAplicar
        const perdidaAplicar = Math.min(perdidaRestante, capacidad)
        if (salidaAplicar <= 0 && perdidaAplicar <= 0) continue

        const ok = await aplicarMovimientoProceso(orden, procs, idx, salidaAplicar, perdidaAplicar)
        if (!ok) {
          huboError = true
          break
        }
        ordenesActualizadas += 1
        salidaRestante -= salidaAplicar
        perdidaRestante -= perdidaAplicar
      }
    } finally {
      setAplicandoKey(null)
    }

    setResumenInputs((prev) => ({ ...prev, [key]: { salida: '', perdida: '' } }))
    await cargarOrdenes()

    if (huboError) return

    if (salidaRestante > 0 || perdidaRestante > 0) {
      const faltantes = []
      if (salidaRestante > 0) faltantes.push(`salida ${formatNumero(salidaRestante)}`)
      if (perdidaRestante > 0) faltantes.push(`pérdida ${formatNumero(perdidaRestante)}`)
      setSnack({
        open: true,
        msg: `Se actualizaron ${ordenesActualizadas} orden(es), pero no había suficiente cantidad pendiente. Sin aplicar: ${faltantes.join(', ')}.`,
        severity: 'warning',
      })
    } else {
      setSnack({
        open: true,
        msg: `Avance registrado en ${ordenesActualizadas} orden(es)`,
        severity: 'success',
      })
    }
  }

  const handleCrearOrden = async (event) => {
    event.preventDefault()
    const codigo = form.codigo.trim()
    const productoId = Number(form.productoId)
    const cantidadPlaneada = Number(form.cantidadPlaneada)
    const prioridad = form.prioridad
    const notas = form.notas.trim() || null

    if (!codigo || !productoId || !cantidadPlaneada) {
      setSnack({
        open: true,
        msg: 'Código, producto y cantidad planeada son requeridos',
        severity: 'error',
      })
      return
    }

    try {
      const res = await fetch(`${API_BASE_URL}/ordenes-produccion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo,
          producto_id: productoId,
          cantidad_planeada: cantidadPlaneada,
          prioridad,
          notas,
        }),
      })

      if (!res.ok) {
        const txt = await res.text()
        let msg = 'Error al crear orden de producción'
        try {
          const parsed = JSON.parse(txt)
          msg = parsed.error || msg
        } catch (_) {
          // noop
        }
        setSnack({ open: true, msg, severity: 'error' })
        return
      }

      const created = await res.json()
      setSnack({ open: true, msg: 'Orden creada exitosamente', severity: 'success' })
      setOpenCrearOrden(false)
      setForm({
        codigo: '',
        productoId: '',
        cantidadPlaneada: '',
        prioridad: 'MEDIA',
        notas: '',
      })
      if (created?.id) {
        try {
          const resProcesos = await fetch(
            `${API_BASE_URL}/ordenes-produccion/${created.id}/procesos`
          )
          if (!resProcesos.ok) throw new Error('Error al obtener procesos de orden')
          const procesos = await resProcesos.json()
          const procesosOrdenados = ordenarProcesos(procesos || [])
          const firstProc = procesosOrdenados[0]
          if (firstProc?.id) {
            await ejecutarAccionProceso(created.id, firstProc.id, 'iniciar')
          }
        } catch (err) {
          console.error(err)
        }
      }
      await cargarOrdenes()
      const nuevoProductoId = String(created?.producto_id ?? productoId)
      setSelectedProductoId(nuevoProductoId)
    } catch (err) {
      console.error(err)
      setSnack({
        open: true,
        msg: 'Error de red al crear orden',
        severity: 'error',
      })
    }
  }

  // Estado agregado de un proceso en el resumen del producto.
  const estadoResumen = (acc) => {
    if (!acc || acc.total === 0) return null
    if (acc.completados === acc.total) return 'COMPLETADO'
    if (acc.salida + acc.perdida > 0) return 'EN_PROCESO'
    return 'PENDIENTE'
  }

  const abrirEditarOrden = (orden) => {
    const procesosOrdenados = ordenarProcesos(orden?.procesos || [])
    setEditRows(
      procesosOrdenados.map((proc) => ({
        id: proc.id,
        nombre: getProcesoNombre(proc, procesosById),
        estado: proc.estado,
        editable: String(proc?.estado || '').toUpperCase() !== 'PENDIENTE',
        entradaInicial: toNumero(proc?.cantidad_entrada),
        salida: String(toNumero(proc?.cantidad_salida)),
        perdida: String(toNumero(proc?.cantidad_perdida)),
      }))
    )
    setEditOrden(orden)
  }

  // Cadena derivada en vivo para el diálogo: la entrada de cada proceso
  // editable es la salida del anterior; marca filas inválidas.
  const filasEdicion = React.useMemo(() => {
    let entradaEncadenada = null
    return editRows.map((fila) => {
      if (!fila.editable) return { ...fila, entradaFila: null, enProceso: null, invalida: false }
      const entradaFila = entradaEncadenada === null ? fila.entradaInicial : entradaEncadenada
      const salidaNum = toNumero(fila.salida)
      const perdidaNum = toNumero(fila.perdida)
      const enProceso = entradaFila - salidaNum - perdidaNum
      const invalida = salidaNum < 0 || perdidaNum < 0 || salidaNum + perdidaNum > entradaFila
      entradaEncadenada = salidaNum
      return { ...fila, entradaFila, enProceso, invalida }
    })
  }, [editRows])

  const edicionInvalida = filasEdicion.some((f) => f.invalida)

  const guardarEdicionOrden = async () => {
    if (!editOrden?.id || edicionInvalida) return
    setGuardandoEdicion(true)
    try {
      const payload = {
        procesos: filasEdicion
          .filter((f) => f.editable)
          .map((f) => ({
            proceso_orden_id: f.id,
            cantidad_salida: toNumero(f.salida),
            cantidad_perdida: toNumero(f.perdida),
          })),
      }
      const res = await fetch(
        `${API_BASE_URL}/ordenes-produccion/${editOrden.id}/procesos/cantidades`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      if (!res.ok) {
        let msg = 'No se pudo guardar la edición'
        try {
          msg = (await res.json())?.error || msg
        } catch (_) {
          // noop
        }
        setSnack({ open: true, msg, severity: 'error' })
        return
      }
      setSnack({ open: true, msg: `Orden ${editOrden.codigo ?? ''} actualizada`, severity: 'success' })
      setEditOrden(null)
      setEditRows([])
      await cargarOrdenes()
    } catch (err) {
      console.error(err)
      setSnack({ open: true, msg: 'Error de red al guardar la edición', severity: 'error' })
    } finally {
      setGuardandoEdicion(false)
    }
  }

  const renderTablaProcesosOrden = (orden) => {
    const procesosOrdenados = ordenarProcesos(orden?.procesos || [])
    if (procesosOrdenados.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary">
          Esta orden no tiene procesos.
        </Typography>
      )
    }
    return (
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell />
              {procesosOrdenados.map((proc) => (
                <TableCell key={proc.id} align="center">
                  {getProcesoNombre(proc, procesosById)}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>Estado</TableCell>
              {procesosOrdenados.map((proc) => (
                <TableCell key={proc.id} align="center">
                  <EstadoChip estado={proc.estado} />
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell>Cant. entrada</TableCell>
              {procesosOrdenados.map((proc, idx) => {
                const entradaAuto = getEntradaAuto(orden, procesosOrdenados, idx)
                return (
                  <TableCell key={proc.id} align="center">
                    {Number.isFinite(entradaAuto) && entradaAuto > 0
                      ? formatNumero(entradaAuto)
                      : '—'}
                  </TableCell>
                )
              })}
            </TableRow>
            <TableRow>
              <TableCell>Cant. salida</TableCell>
              {procesosOrdenados.map((proc) => (
                <TableCell key={proc.id} align="center">
                  {proc.cantidad_salida ?? '—'}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell>Cant. pérdida</TableCell>
              {procesosOrdenados.map((proc) => (
                <TableCell key={proc.id} align="center">
                  {proc.cantidad_perdida ?? '—'}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    )
  }

  const renderVistaProductos = () => (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', sm: 'center' }}
      >
        <TextField
          size="small"
          placeholder="Buscar producto..."
          value={busquedaProducto}
          onChange={(e) => setBusquedaProducto(e.target.value)}
          sx={{ flex: 1, maxWidth: { xs: '100%', sm: 360 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          select
          size="small"
          label="Ordenar por"
          value={ordenarPor}
          onChange={(e) => setOrdenarPor(e.target.value)}
          sx={{ minWidth: { xs: '100%', sm: 180 } }}
        >
          {ORDENAMIENTOS.map((item) => (
            <MenuItem key={item.id} value={item.id}>
              {item.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {gruposFiltrados.length === 0 ? (
        <Paper sx={{ p: 4, borderRadius: 3 }}>
          <Typography variant="body2" color="text.secondary" align="center">
            No hay productos que coincidan con “{busquedaProducto.trim()}”.
          </Typography>
        </Paper>
      ) : (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          gap: 2,
        }}
      >
      {gruposFiltrados.map((grupo) => {
        const canceladas = grupo.ordenes.length - grupo.activas.length
        return (
          <Paper
            key={grupo.productoId}
            variant="outlined"
            onClick={() => setSelectedProductoId(grupo.productoId)}
            sx={{
              p: 2.5,
              borderRadius: 3,
              cursor: 'pointer',
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              '&:hover': { borderColor: 'primary.main', boxShadow: 3 },
            }}
          >
            <Stack spacing={1.5}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                  {grupo.nombre}
                </Typography>
                <ChevronRightIcon color="action" />
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  color="info"
                  variant="outlined"
                  label={`${grupo.activas.length} ${grupo.activas.length === 1 ? 'orden activa' : 'órdenes activas'}`}
                />
                {canceladas > 0 && (
                  <Chip
                    size="small"
                    color="error"
                    variant="outlined"
                    label={`${canceladas} cancelada${canceladas === 1 ? '' : 's'}`}
                  />
                )}
              </Stack>
              <Stack spacing={0.25}>
                <Typography variant="body2" color="text.secondary">
                  Planeado total: {formatNumero(grupo.totalPlaneado)}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  En producción: {formatNumero(grupo.totalEnProduccion)}
                </Typography>
              </Stack>
            </Stack>
          </Paper>
        )
      })}
      </Box>
      )}
    </Stack>
  )

  const renderVistaProducto = (grupo) => (
    <Stack spacing={2.5}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
      >
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => setSelectedProductoId(null)}
          size="small"
        >
          Productos
        </Button>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {grupo.nombre}
        </Typography>
        <Chip
          size="small"
          color="info"
          variant="outlined"
          label={`${grupo.activas.length} ${grupo.activas.length === 1 ? 'orden activa' : 'órdenes activas'}`}
        />
        <Chip
          size="small"
          variant="outlined"
          label={`En producción: ${formatNumero(grupo.totalEnProduccion)}`}
        />
      </Stack>

      <Paper sx={{ p: 2.5, borderRadius: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Resumen de producción
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Registra aquí el avance de cada proceso. Se aplicará a las órdenes del producto,
          completando primero la más antigua.
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Proceso</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Por procesar</TableCell>
                <TableCell align="right">Entrada</TableCell>
                <TableCell align="right">Salida</TableCell>
                <TableCell align="right">Pérdida</TableCell>
                <TableCell align="center">Agregar salida</TableCell>
                <TableCell align="center">Agregar pérdida</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {grupo.ruta.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9}>
                    <Typography variant="body2" color="text.secondary">
                      Las órdenes de este producto no tienen procesos.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                grupo.ruta.map(({ key, proc }) => {
                  const acc = grupo.resumen[key]
                  const inputs = resumenInputs[key] || { salida: '', perdida: '' }
                  const estado = estadoResumen(acc)
                  const completado = estado === 'COMPLETADO'
                  const sinPendiente = !acc || acc.pendiente <= 0
                  const aplicando = aplicandoKey === key
                  return (
                    <TableRow key={key}>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {getProcesoNombre(proc, procesosById)}
                      </TableCell>
                      <TableCell>
                        <EstadoChip estado={estado} />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        {formatNumero(acc?.pendiente ?? 0)}
                      </TableCell>
                      <TableCell align="right">{formatNumero(acc?.entrada ?? 0)}</TableCell>
                      <TableCell align="right">{formatNumero(acc?.salida ?? 0)}</TableCell>
                      <TableCell align="right">{formatNumero(acc?.perdida ?? 0)}</TableCell>
                      <TableCell align="center" sx={{ width: 130 }}>
                        <TextField
                          size="small"
                          type="number"
                          value={inputs.salida}
                          onChange={(e) =>
                            setResumenInputs((prev) => ({
                              ...prev,
                              [key]: { ...inputs, salida: e.target.value },
                            }))
                          }
                          disabled={completado || sinPendiente || aplicandoKey != null}
                          inputProps={{ min: 0 }}
                        />
                      </TableCell>
                      <TableCell align="center" sx={{ width: 130 }}>
                        <TextField
                          size="small"
                          type="number"
                          value={inputs.perdida}
                          onChange={(e) =>
                            setResumenInputs((prev) => ({
                              ...prev,
                              [key]: { ...inputs, perdida: e.target.value },
                            }))
                          }
                          disabled={completado || sinPendiente || aplicandoKey != null}
                          inputProps={{ min: 0 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleAplicarResumen(grupo, key)}
                          disabled={completado || sinPendiente || aplicandoKey != null}
                          startIcon={aplicando ? <CircularProgress size={14} /> : null}
                        >
                          {aplicando ? 'Aplicando...' : 'Actualizar'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        Órdenes (de la más antigua a la más reciente)
      </Typography>

      <Stack spacing={2}>
        {grupo.ordenes.map((orden) => {
          const ordenCancelada = isOrdenCancelada(orden)
          const fecha = formatFecha(getOrdenFecha(orden))
          return (
            <Paper
              key={orden.id}
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 2,
                opacity: ordenCancelada ? 0.72 : 1,
                bgcolor: ordenCancelada ? 'action.hover' : 'background.paper',
              }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                spacing={1}
                sx={{ mb: 1 }}
              >
                <Stack spacing={0.5}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      Orden {orden.codigo ?? '—'}
                    </Typography>
                    <EstadoChip estado={orden.estado} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Fecha: {fecha} · Cantidad planeada: {formatNumero(orden?.cantidad_planeada)}
                  </Typography>
                  {ordenCancelada && (
                    <Typography variant="body2" color="error.main" sx={{ fontWeight: 600 }}>
                      Orden cancelada: bloqueada para producción
                    </Typography>
                  )}
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  {!ordenCancelada && (
                    <Tooltip title="Editar cantidades de la orden">
                      <IconButton
                        size="small"
                        color="primary"
                        aria-label={`Editar cantidades de la orden ${orden.codigo ?? ''}`.trim()}
                        onClick={() => abrirEditarOrden(orden)}
                        sx={{ border: 1, borderColor: 'primary.main' }}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  {!ordenCancelada && (
                    <Tooltip title="Cancelar la orden">
                      <IconButton
                        size="small"
                        color="error"
                        aria-label={`Cancelar la orden ${orden.codigo ?? ''}`.trim()}
                        onClick={() => handleCancelarOrden(orden.id)}
                        sx={{ border: 1, borderColor: 'error.main' }}
                      >
                        <BlockIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  {canDeleteOrden && (
                    <Tooltip title="Eliminar la orden">
                      <IconButton
                        size="small"
                        color="error"
                        aria-label={`Eliminar la orden ${orden.codigo ?? ''}`.trim()}
                        onClick={() => handleEliminarOrden(orden.id)}
                        sx={{ border: 1, borderColor: 'error.main' }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              </Stack>
              {renderTablaProcesosOrden(orden)}
            </Paper>
          )
        })}
      </Stack>
    </Stack>
  )

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', mt: 3, px: 2 }}>
      <Stack spacing={3}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Producción
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              startIcon={<RefreshIcon />}
              onClick={cargarOrdenes}
              disabled={loadingOrdenes}
            >
              Recargar
            </Button>
            <Button variant="contained" onClick={handleOpenCrearOrden}>
              Crear orden
            </Button>
          </Stack>
        </Stack>

        {tiposDisponibles.length > 1 && (
          <Tabs
            value={tipoActivo}
            onChange={(_, valor) => cambiarTipo(valor)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            {tiposDisponibles.map((tipo) => (
              <Tab
                key={tipo}
                value={tipo}
                label={`${ETIQUETA_TIPO[tipo]} (${conteoPorTipo[tipo] ?? 0})`}
              />
            ))}
          </Tabs>
        )}

        {errorOrdenes && (
          <Alert severity="error">
            {errorOrdenes}
          </Alert>
        )}

        {loadingOrdenes ? (
          <Stack alignItems="center" spacing={1.5} sx={{ py: 6 }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Cargando órdenes de producción...
            </Typography>
          </Stack>
        ) : grupos.length === 0 ? (
          <Paper sx={{ p: 4, borderRadius: 3 }}>
            <Typography variant="body2" color="text.secondary" align="center">
              {tipoActivo === TIPO_TODOS
                ? 'No hay órdenes de producción activas.'
                : `No hay órdenes de producción activas de ${ETIQUETA_TIPO[
                    tipoActivo
                  ].toLowerCase()}.`}
            </Typography>
          </Paper>
        ) : grupoSeleccionado ? (
          renderVistaProducto(grupoSeleccionado)
        ) : (
          renderVistaProductos()
        )}

        <Dialog open={openCrearOrden} onClose={handleCloseCrearOrden} fullWidth maxWidth="sm">
          <DialogTitle>
            {tipoActivo === TIPO_TODOS
              ? 'Crear orden de producción'
              : `Crear orden de producción · ${ETIQUETA_TIPO[tipoActivo]}`}
          </DialogTitle>
          <DialogContent dividers>
            <form id="crear-orden-form" onSubmit={handleCrearOrden}>
              <Stack spacing={2}>
                <TextField
                  label="Código"
                  value={form.codigo}
                  onChange={(e) => setForm((p) => ({ ...p, codigo: e.target.value }))}
                  required
                />
                <TextField
                  select
                  label="Producto"
                  value={form.productoId}
                  onChange={(e) => setForm((p) => ({ ...p, productoId: e.target.value }))}
                  required
                >
                  {productosParaCrear.map((prod) => (
                    <MenuItem key={prod.id} value={prod.id}>
                      {prod.nombre}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Cantidad planeada"
                  type="number"
                  value={form.cantidadPlaneada}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, cantidadPlaneada: e.target.value }))
                  }
                  required
                  inputProps={{ min: 0 }}
                />
                <TextField
                  select
                  label="Prioridad"
                  value={form.prioridad}
                  onChange={(e) => setForm((p) => ({ ...p, prioridad: e.target.value }))}
                >
                  {PRIORIDADES.map((item) => (
                    <MenuItem key={item.id} value={item.id}>
                      {item.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Notas"
                  multiline
                  minRows={2}
                  value={form.notas}
                  onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))}
                />
                <Alert severity="info">
                  El producto debe tener ruta de procesos y BOM/Componentes para crear la orden.
                </Alert>
              </Stack>
            </form>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseCrearOrden}>Cancelar</Button>
            <Button variant="contained" type="submit" form="crear-orden-form">
              Crear orden
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>

      <Dialog
        open={Boolean(editOrden)}
        onClose={() => {
          if (!guardandoEdicion) {
            setEditOrden(null)
            setEditRows([])
          }
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Editar cantidades — Orden {editOrden?.codigo ?? ''}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Corrige salida y pérdida de cada proceso. La entrada de cada proceso
            siempre es la salida del anterior, así que al bajar una salida las
            piezas “regresan” al proceso anterior. Esta edición no completa
            procesos ni consume materiales; los procesos pendientes se editan
            solo al iniciarlos por el flujo normal.
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Proceso</TableCell>
                  <TableCell align="center">Estado</TableCell>
                  <TableCell align="right">Entrada</TableCell>
                  <TableCell align="right">Salida</TableCell>
                  <TableCell align="right">Pérdida</TableCell>
                  <TableCell align="right">En proceso</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filasEdicion.map((fila, idx) => (
                  <TableRow key={fila.id} sx={{ opacity: fila.editable ? 1 : 0.55 }}>
                    <TableCell>{fila.nombre}</TableCell>
                    <TableCell align="center">
                      <EstadoChip estado={fila.estado} />
                    </TableCell>
                    <TableCell align="right">
                      {fila.editable ? formatNumero(fila.entradaFila) : '—'}
                    </TableCell>
                    <TableCell align="right">
                      {fila.editable ? (
                        <TextField
                          size="small"
                          type="number"
                          value={fila.salida}
                          error={fila.invalida}
                          onChange={(e) => {
                            const valor = e.target.value
                            setEditRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, salida: valor } : r))
                            )
                          }}
                          inputProps={{ min: 0, style: { textAlign: 'right' } }}
                          sx={{ width: 110 }}
                        />
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {fila.editable ? (
                        <TextField
                          size="small"
                          type="number"
                          value={fila.perdida}
                          error={fila.invalida}
                          onChange={(e) => {
                            const valor = e.target.value
                            setEditRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, perdida: valor } : r))
                            )
                          }}
                          inputProps={{ min: 0, style: { textAlign: 'right' } }}
                          sx={{ width: 110 }}
                        />
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {fila.editable ? formatNumero(fila.enProceso) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {edicionInvalida && (
            <Alert severity="error" sx={{ mt: 2 }}>
              Hay procesos donde salida + pérdida supera la entrada. Ajusta las
              cantidades marcadas en rojo.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setEditOrden(null)
              setEditRows([])
            }}
            disabled={guardandoEdicion}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={guardarEdicionOrden}
            disabled={edicionInvalida || guardandoEdicion}
          >
            {guardandoEdicion ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </DialogActions>
      </Dialog>

      <Box
        sx={{
          position: 'fixed',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: (t) => t.zIndex.snackbar,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
        }}
      >
        {snacks.map((s) => (
          <Alert
            key={s.id}
            severity={s.severity}
            variant="filled"
            onClose={() => cerrarSnack(s.id)}
            sx={{ minWidth: 280, maxWidth: '90vw', boxShadow: 3 }}
          >
            {s.msg}
          </Alert>
        ))}
      </Box>
    </Box>
  )
}
