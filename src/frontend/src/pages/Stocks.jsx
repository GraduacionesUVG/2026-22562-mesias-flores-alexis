import * as React from 'react'
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  TextField,
  Button,
  MenuItem,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Chip,
  Tooltip,
} from '@mui/material'
import { useLocation } from 'react-router-dom'
import RefreshIcon from '@mui/icons-material/Refresh'
import BlockIcon from '@mui/icons-material/Block'
import { API_BASE_URL } from '../config/api'
import { useConfirm } from '../components/ConfirmProvider'

const TABS = [
  { id: 'finales', label: 'Terminados' },
  { id: 'agranel', label: 'Producto Agranel' },
  { id: 'componentes', label: 'Componentes' },
  { id: 'materias', label: 'Materias primas' },
]

const toNumber = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

// Indica si el valor mostrado en el campo NO cumple la regla de guardado
// (debe ser numérico). No cambia la validación: solo refleja el mismo
// criterio (toNumber == null) en la presentación del TextField.
const esCampoStockInvalido = (raw) => toNumber(raw) == null

export default function Stocks() {
  const location = useLocation()
  const confirm = useConfirm()
  const [tab, setTab] = React.useState('finales')
  const [productosTerminados, setProductosTerminados] = React.useState([])
  const [productosAgranel, setProductosAgranel] = React.useState([])
  const [productosComponentes, setProductosComponentes] = React.useState([])
  const [materiasPrimas, setMateriasPrimas] = React.useState([])
  const [loading, setLoading] = React.useState(false)
  // Marca si la última carga de cada listado falló, para diferenciar
  // "no hay registros" de "no se pudieron cargar". Solo afecta la presentación.
  const [errores, setErrores] = React.useState({
    finales: false,
    agranel: false,
    componentes: false,
    materias: false,
  })
  const [snack, setSnack] = React.useState({ open: false, msg: '', severity: 'success' })

  const [editProductos, setEditProductos] = React.useState({})
  const [editMaterias, setEditMaterias] = React.useState({})

  // Receta (BOM + componentes) por producto terminado, para calcular producibles.
  const [bomPorProducto, setBomPorProducto] = React.useState({})
  const [detalleProducibles, setDetalleProducibles] = React.useState({
    open: false,
    producto: null,
    calculo: null,
  })

  const [ajusteDialog, setAjusteDialog] = React.useState({
    open: false,
    materia: null,
    tipo: 'ENTRADA',
    cantidad: '',
    motivo: '',
    observaciones: '',
  })

  React.useEffect(() => {
    const params = new URLSearchParams(location.search)
    const requestedTab = params.get('tab')
    if (requestedTab && TABS.some((t) => t.id === requestedTab)) {
      setTab(requestedTab)
    }
  }, [location.search])

  const cargarProductosTerminados = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/productos?es_producto_final=true&es_terminado=true`)
      if (!res.ok) throw new Error('Error al obtener productos terminados')
      const data = await res.json()
      setProductosTerminados((data || []).filter((item) => item?.activo !== false))
      setErrores((prev) => ({ ...prev, finales: false }))
    } catch (err) {
      console.error(err)
      setErrores((prev) => ({ ...prev, finales: true }))
      setSnack({ open: true, msg: 'No se pudieron cargar productos terminados', severity: 'error' })
    }
  }

  const cargarProductosAgranel = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/productos?es_producto_final=true&es_terminado=false`)
      if (!res.ok) throw new Error('Error al obtener producto agranel')
      const data = await res.json()
      setProductosAgranel((data || []).filter((item) => item?.activo !== false))
      setErrores((prev) => ({ ...prev, agranel: false }))
    } catch (err) {
      console.error(err)
      setErrores((prev) => ({ ...prev, agranel: true }))
      setSnack({ open: true, msg: 'No se pudo cargar producto agranel', severity: 'error' })
    }
  }

  const cargarProductosComponentes = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/productos?es_producto_final=false`)
      if (!res.ok) throw new Error('Error al obtener componentes')
      const data = await res.json()
      setProductosComponentes((data || []).filter((item) => item?.activo !== false))
      setErrores((prev) => ({ ...prev, componentes: false }))
    } catch (err) {
      console.error(err)
      setErrores((prev) => ({ ...prev, componentes: true }))
      setSnack({ open: true, msg: 'No se pudieron cargar componentes', severity: 'error' })
    }
  }

  const cargarMateriasPrimas = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/materias-primas`)
      if (!res.ok) throw new Error('Error al obtener materias primas')
      const data = await res.json()
      setMateriasPrimas((data || []).filter((item) => item?.activo !== false))
      setErrores((prev) => ({ ...prev, materias: false }))
    } catch (err) {
      console.error(err)
      setErrores((prev) => ({ ...prev, materias: true }))
      setSnack({ open: true, msg: 'No se pudieron cargar materias primas', severity: 'error' })
    }
  }

  const recargarTodo = async () => {
    setLoading(true)
    await Promise.all([
      cargarProductosTerminados(),
      cargarProductosAgranel(),
      cargarProductosComponentes(),
      cargarMateriasPrimas(),
    ])
    setLoading(false)
  }

  React.useEffect(() => {
    recargarTodo()
  }, [])

  // Carga la receta de cada producto terminado (en lotes para no saturar el API).
  React.useEffect(() => {
    const pendientes = productosTerminados.filter((p) => p?.id != null)
    if (pendientes.length === 0) return undefined
    let cancelado = false
    setBomPorProducto({})

    const cargarReceta = async (producto) => {
      try {
        const [resBom, resComp] = await Promise.all([
          fetch(`${API_BASE_URL}/productos/${producto.id}/bom`),
          fetch(`${API_BASE_URL}/productos/${producto.id}/componentes`),
        ])
        if (!resBom.ok || !resComp.ok) throw new Error('Error al obtener receta del producto')
        const [bom, componentes] = await Promise.all([resBom.json(), resComp.json()])
        return { id: producto.id, bom: bom || [], componentes: componentes || [] }
      } catch (err) {
        console.error(err)
        return { id: producto.id, error: true }
      }
    }

    ;(async () => {
      for (let i = 0; i < pendientes.length; i += 6) {
        const lote = await Promise.all(pendientes.slice(i, i + 6).map(cargarReceta))
        if (cancelado) return
        setBomPorProducto((prev) => {
          const next = { ...prev }
          lote.forEach((receta) => {
            next[receta.id] = receta
          })
          return next
        })
      }
    })()

    return () => {
      cancelado = true
    }
  }, [productosTerminados])

  // Producibles por producto terminado: mínimo de floor(stock / cantidad_necesaria)
  // entre todas las materias primas y componentes de la receta.
  const producibles = React.useMemo(() => {
    const materiasPorId = new Map(materiasPrimas.map((m) => [String(m.id), m]))
    const productosPorId = new Map(
      [...productosComponentes, ...productosAgranel, ...productosTerminados].map((p) => [String(p.id), p])
    )

    const resultado = {}
    productosTerminados.forEach((producto) => {
      const receta = bomPorProducto[producto.id]
      if (!receta) {
        resultado[producto.id] = { estado: 'cargando' }
        return
      }
      if (receta.error) {
        resultado[producto.id] = { estado: 'error' }
        return
      }

      const detalle = []
      ;(receta.bom || []).forEach((item) => {
        const idMateria = item.materia_prima_id ?? item.materiaPrimaId ?? item.materia_prima?.id
        const cantidadNecesaria = toNumber(item.cantidad_necesaria ?? item.cantidad) ?? 0
        const materia = idMateria != null ? materiasPorId.get(String(idMateria)) : null
        const stock = toNumber(materia?.stock_actual) ?? 0
        detalle.push({
          tipo: 'Materia prima',
          nombre: materia?.nombre ?? item.materia_prima?.nombre ?? `Materia prima #${idMateria ?? '?'}`,
          codigo: materia?.codigo ?? '',
          cantidadNecesaria,
          stock,
          maxUnidades: cantidadNecesaria > 0 ? Math.floor(stock / cantidadNecesaria) : null,
          encontrado: Boolean(materia),
        })
      })
      ;(receta.componentes || []).forEach((item) => {
        const idComponente = item.componente_id ?? item.componenteId ?? item.componente?.id
        const cantidadNecesaria = toNumber(item.cantidad_necesaria ?? item.cantidad) ?? 0
        const componente = idComponente != null ? productosPorId.get(String(idComponente)) : null
        const stock = toNumber(componente?.stock_actual) ?? 0
        detalle.push({
          tipo: 'Componente',
          nombre: componente?.nombre ?? item.componente?.nombre ?? `Componente #${idComponente ?? '?'}`,
          codigo: componente?.codigo ?? '',
          cantidadNecesaria,
          stock,
          maxUnidades: cantidadNecesaria > 0 ? Math.floor(stock / cantidadNecesaria) : null,
          encontrado: Boolean(componente),
        })
      })

      if (detalle.length === 0) {
        resultado[producto.id] = { estado: 'sin_receta' }
        return
      }

      const limites = detalle.filter((d) => d.maxUnidades != null)
      const cantidad = limites.length === 0 ? null : Math.min(...limites.map((d) => d.maxUnidades))
      resultado[producto.id] = { estado: 'ok', cantidad, detalle }
    })
    return resultado
  }, [productosTerminados, productosAgranel, productosComponentes, materiasPrimas, bomPorProducto])

  const handleGuardarProducto = async (producto) => {
    const edits = editProductos[producto.id] || {}
    const stockActual = toNumber(edits.stock_actual ?? producto.stock_actual)
    const stockMinimo = toNumber(edits.stock_minimo ?? producto.stock_minimo)

    if (stockActual == null || stockMinimo == null) {
      setSnack({ open: true, msg: 'Stock actual y mínimo deben ser numéricos', severity: 'error' })
      return
    }

    try {
      const res = await fetch(`${API_BASE_URL}/productos/${producto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock_actual: stockActual, stock_minimo: stockMinimo }),
      })

      if (!res.ok) {
        const txt = await res.text()
        let msg = 'No se pudo actualizar el stock'
        try {
          const parsed = JSON.parse(txt)
          msg = parsed.error || msg
        } catch (_) {
          // noop
        }
        setSnack({ open: true, msg, severity: 'error' })
        return
      }

      setSnack({ open: true, msg: 'Stock actualizado', severity: 'success' })
      if (producto?.es_producto_final === true) {
        if (producto?.es_terminado === false) {
          await cargarProductosAgranel()
        } else {
          await cargarProductosTerminados()
        }
      } else if (producto?.es_producto_final === false) {
        await cargarProductosComponentes()
      } else {
        await Promise.all([
          cargarProductosTerminados(),
          cargarProductosAgranel(),
          cargarProductosComponentes(),
        ])
      }
    } catch (err) {
      console.error(err)
      setSnack({ open: true, msg: 'Error de red al actualizar stock', severity: 'error' })
    }
  }

  const handleGuardarMinimoMateria = async (materia) => {
    const edits = editMaterias[materia.id] || {}
    const stockMinimo = toNumber(edits.stock_minimo ?? materia.stock_minimo)

    if (stockMinimo == null) {
      setSnack({ open: true, msg: 'Stock mínimo debe ser numérico', severity: 'error' })
      return
    }

    try {
      const res = await fetch(`${API_BASE_URL}/materias-primas/${materia.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock_minimo: stockMinimo }),
      })

      if (!res.ok) {
        const txt = await res.text()
        let msg = 'No se pudo actualizar el stock mínimo'
        try {
          const parsed = JSON.parse(txt)
          msg = parsed.error || msg
        } catch (_) {
          // noop
        }
        setSnack({ open: true, msg, severity: 'error' })
        return
      }

      setSnack({ open: true, msg: 'Stock mínimo actualizado', severity: 'success' })
      await cargarMateriasPrimas()
    } catch (err) {
      console.error(err)
      setSnack({ open: true, msg: 'Error de red al actualizar stock mínimo', severity: 'error' })
    }
  }

  const handleDesactivarProducto = async (producto) => {
    if (!producto?.id) return
    const ok = await confirm({
      title: 'Desactivar producto',
      message: `${producto.nombre || 'Este producto'} dejará de aparecer en stocks. Podrás volver a activarlo más adelante si lo necesitas.`,
      confirmText: 'Sí, desactivar',
      cancelText: 'Cancelar',
      severity: 'error',
    })
    if (!ok) return

    try {
      const res = await fetch(`${API_BASE_URL}/productos/${producto.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...producto, activo: false }),
      })

      if (!res.ok) {
        const txt = await res.text()
        let msg = 'No se pudo desactivar el producto'
        try {
          const parsed = JSON.parse(txt)
          msg = parsed.error || parsed.message || msg
        } catch (_) {
          // noop
        }
        setSnack({ open: true, msg, severity: 'error' })
        return
      }

      setSnack({ open: true, msg: 'Producto desactivado', severity: 'success' })
      await Promise.all([
        cargarProductosTerminados(),
        cargarProductosAgranel(),
        cargarProductosComponentes(),
      ])
    } catch (err) {
      console.error(err)
      setSnack({ open: true, msg: 'Error de red al desactivar producto', severity: 'error' })
    }
  }

  const handleDesactivarMateria = async (materia) => {
    if (!materia?.id) return
    const ok = await confirm({
      title: 'Desactivar materia prima',
      message: `${materia.nombre || 'Esta materia prima'} dejará de aparecer en stocks. Podrás volver a activarla más adelante si lo necesitas.`,
      confirmText: 'Sí, desactivar',
      cancelText: 'Cancelar',
      severity: 'error',
    })
    if (!ok) return

    try {
      const res = await fetch(`${API_BASE_URL}/materias-primas/${materia.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...materia, activo: false }),
      })

      if (!res.ok) {
        const txt = await res.text()
        let msg = 'No se pudo desactivar la materia prima'
        try {
          const parsed = JSON.parse(txt)
          msg = parsed.error || parsed.message || msg
        } catch (_) {
          // noop
        }
        setSnack({ open: true, msg, severity: 'error' })
        return
      }

      setSnack({ open: true, msg: 'Materia prima desactivada', severity: 'success' })
      await cargarMateriasPrimas()
    } catch (err) {
      console.error(err)
      setSnack({ open: true, msg: 'Error de red al desactivar materia prima', severity: 'error' })
    }
  }

  const handleOpenAjuste = (materia) => {
    setAjusteDialog({
      open: true,
      materia,
      tipo: 'ENTRADA',
      cantidad: '',
      motivo: '',
      observaciones: '',
    })
  }

  const handleCloseAjuste = () => {
    setAjusteDialog((prev) => ({ ...prev, open: false }))
  }

  const handleGuardarAjuste = async () => {
    if (!ajusteDialog?.materia?.id) return
    const cantidad = toNumber(ajusteDialog.cantidad)
    if (cantidad == null) {
      setSnack({ open: true, msg: 'Cantidad debe ser numérica', severity: 'error' })
      return
    }

    try {
      const res = await fetch(
        `${API_BASE_URL}/materias-primas/${ajusteDialog.materia.id}/ajustes-stock`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo: ajusteDialog.tipo,
            cantidad,
            motivo: ajusteDialog.motivo || null,
            observaciones: ajusteDialog.observaciones || null,
          }),
        }
      )

      if (!res.ok) {
        const txt = await res.text()
        let msg = 'No se pudo registrar el ajuste'
        try {
          const parsed = JSON.parse(txt)
          msg = parsed.error || msg
        } catch (_) {
          // noop
        }
        setSnack({ open: true, msg, severity: 'error' })
        return
      }

      setSnack({ open: true, msg: 'Ajuste registrado', severity: 'success' })
      handleCloseAjuste()
      await cargarMateriasPrimas()
    } catch (err) {
      console.error(err)
      setSnack({ open: true, msg: 'Error de red al registrar ajuste', severity: 'error' })
    }
  }

  const renderProducibles = (item) => {
    const info = producibles[item.id]
    if (!info || info.estado === 'cargando') {
      return <CircularProgress size={16} />
    }
    if (info.estado === 'error') {
      return (
        <Tooltip title="No se pudo cargar la receta del producto. Usa “Recargar” para intentarlo de nuevo.">
          <Typography variant="body2" color="error" component="span">
            —
          </Typography>
        </Tooltip>
      )
    }
    if (info.estado === 'sin_receta') {
      return (
        <Tooltip title="Este producto no tiene BOM ni componentes definidos.">
          <Typography variant="body2" color="text.secondary" component="span">
            Sin receta
          </Typography>
        </Tooltip>
      )
    }
    return (
      <Tooltip title="Ver detalle por material">
        <Chip
          size="small"
          label={info.cantidad ?? '—'}
          color={info.cantidad > 0 ? 'success' : 'error'}
          variant={info.cantidad > 0 ? 'filled' : 'outlined'}
          onClick={() => setDetalleProducibles({ open: true, producto: item, calculo: info })}
        />
      </Tooltip>
    )
  }

  const renderTablaProductos = (items, hayError = false, conProducibles = false) => {
    const totalColumnas = conProducibles ? 8 : 7
    return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Código</TableCell>
            <TableCell>Nombre</TableCell>
            <TableCell>Stock actual</TableCell>
            <TableCell>Stock reservado</TableCell>
            <TableCell>Stock mínimo</TableCell>
            {conProducibles && (
              <Tooltip title="Unidades que se podrían producir con el stock actual de materias primas y componentes, según la receta (BOM) del producto.">
                <TableCell align="center">Producibles</TableCell>
              </Tooltip>
            )}
            <TableCell>Activo</TableCell>
            <TableCell align="right">Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={totalColumnas}>
                <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center" sx={{ py: 2 }}>
                  <CircularProgress size={20} />
                  <Typography color="text.secondary">Cargando…</Typography>
                </Stack>
              </TableCell>
            </TableRow>
          ) : items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={totalColumnas}>
                <Typography variant="body2" color={hayError ? 'error' : 'text.secondary'} align="center">
                  {hayError
                    ? 'No se pudieron cargar los productos. Usa “Recargar” para intentarlo de nuevo.'
                    : 'No hay productos en esta sección.'}
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => {
              const stockActualRaw = editProductos[item.id]?.stock_actual ?? item.stock_actual ?? ''
              const stockMinimoRaw = editProductos[item.id]?.stock_minimo ?? item.stock_minimo ?? ''
              const stockActualInvalido = esCampoStockInvalido(stockActualRaw)
              const stockMinimoInvalido = esCampoStockInvalido(stockMinimoRaw)
              return (
              <TableRow key={item.id}>
                <TableCell>{item.codigo ?? '—'}</TableCell>
                <TableCell>{item.nombre ?? '—'}</TableCell>
                <TableCell sx={{ width: 160 }}>
                  <TextField
                    size="small"
                    type="number"
                    value={stockActualRaw}
                    onChange={(e) =>
                      setEditProductos((prev) => ({
                        ...prev,
                        [item.id]: { ...prev[item.id], stock_actual: e.target.value },
                      }))
                    }
                    inputProps={{ min: 0 }}
                    error={stockActualInvalido}
                    helperText={stockActualInvalido ? 'Escribe un número válido' : ' '}
                  />
                </TableCell>
                <TableCell>{item.stock_reservado ?? 0}</TableCell>
                <TableCell sx={{ width: 160 }}>
                  <TextField
                    size="small"
                    type="number"
                    value={stockMinimoRaw}
                    onChange={(e) =>
                      setEditProductos((prev) => ({
                        ...prev,
                        [item.id]: { ...prev[item.id], stock_minimo: e.target.value },
                      }))
                    }
                    inputProps={{ min: 0 }}
                    error={stockMinimoInvalido}
                    helperText={stockMinimoInvalido ? 'Escribe un número válido' : ' '}
                  />
                </TableCell>
                {conProducibles && (
                  <TableCell align="center">{renderProducibles(item)}</TableCell>
                )}
                <TableCell>{item.activo === false ? 'No' : 'Sí'}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button size="small" variant="contained" onClick={() => handleGuardarProducto(item)}>
                      Guardar
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      startIcon={<BlockIcon />}
                      onClick={() => handleDesactivarProducto(item)}
                    >
                      Desactivar
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </TableContainer>
    )
  }

  const renderTablaMaterias = () => (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Código</TableCell>
            <TableCell>Nombre</TableCell>
            <TableCell>Stock actual</TableCell>
            <TableCell>Stock reservado</TableCell>
            <TableCell>Stock mínimo</TableCell>
            <TableCell>Activo</TableCell>
            <TableCell align="right">Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={7}>
                <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center" sx={{ py: 2 }}>
                  <CircularProgress size={20} />
                  <Typography color="text.secondary">Cargando…</Typography>
                </Stack>
              </TableCell>
            </TableRow>
          ) : materiasPrimas.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7}>
                <Typography variant="body2" color={errores.materias ? 'error' : 'text.secondary'} align="center">
                  {errores.materias
                    ? 'No se pudieron cargar las materias primas. Usa “Recargar” para intentarlo de nuevo.'
                    : 'No hay materias primas.'}
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            materiasPrimas.map((item) => {
              const stockMinimoRaw = editMaterias[item.id]?.stock_minimo ?? item.stock_minimo ?? ''
              const stockMinimoInvalido = esCampoStockInvalido(stockMinimoRaw)
              return (
              <TableRow key={item.id}>
                <TableCell>{item.codigo ?? '—'}</TableCell>
                <TableCell>{item.nombre ?? '—'}</TableCell>
                <TableCell>{item.stock_actual ?? 0}</TableCell>
                <TableCell>{item.stock_reservado ?? 0}</TableCell>
                <TableCell sx={{ width: 160 }}>
                  <TextField
                    size="small"
                    type="number"
                    value={stockMinimoRaw}
                    onChange={(e) =>
                      setEditMaterias((prev) => ({
                        ...prev,
                        [item.id]: { ...prev[item.id], stock_minimo: e.target.value },
                      }))
                    }
                    inputProps={{ min: 0 }}
                    error={stockMinimoInvalido}
                    helperText={stockMinimoInvalido ? 'Escribe un número válido' : ' '}
                  />
                </TableCell>
                <TableCell>{item.activo === false ? 'No' : 'Sí'}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button size="small" variant="contained" onClick={() => handleGuardarMinimoMateria(item)}>
                      Guardar mínimo
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => handleOpenAjuste(item)}>
                      Ajustar
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      startIcon={<BlockIcon />}
                      onClick={() => handleDesactivarMateria(item)}
                    >
                      Desactivar
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </TableContainer>
  )

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', mt: 3, px: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Stocks
          </Typography>
          <Button
            size="small"
            variant="outlined"
            aria-label="Recargar listados de stock"
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
            onClick={recargarTodo}
            disabled={loading}
          >
            {loading ? 'Recargando…' : 'Recargar'}
          </Button>
        </Stack>

        <Paper sx={{ p: 2, borderRadius: 3 }}>
          <Tabs
            value={tab}
            onChange={(_, value) => setTab(value)}
            sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
          >
            {TABS.map((item) => (
              <Tab key={item.id} value={item.id} label={item.label} />
            ))}
          </Tabs>

          {tab === 'finales' && renderTablaProductos(productosTerminados, errores.finales, true)}
          {tab === 'agranel' && renderTablaProductos(productosAgranel, errores.agranel)}
          {tab === 'componentes' && renderTablaProductos(productosComponentes, errores.componentes)}
          {tab === 'materias' && renderTablaMaterias()}
        </Paper>
      </Stack>

      <Dialog open={ajusteDialog.open} onClose={handleCloseAjuste} fullWidth maxWidth="sm">
        <DialogTitle>Ajuste de stock</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Materia prima"
            value={ajusteDialog.materia?.nombre ?? ''}
            disabled
          />
          <TextField
            select
            label="Tipo"
            value={ajusteDialog.tipo}
            onChange={(e) => setAjusteDialog((prev) => ({ ...prev, tipo: e.target.value }))}
          >
            <MenuItem value="ENTRADA">Entrada</MenuItem>
            <MenuItem value="SALIDA">Salida</MenuItem>
            <MenuItem value="AJUSTE">Ajuste</MenuItem>
          </TextField>
          <TextField
            label="Cantidad"
            type="number"
            value={ajusteDialog.cantidad}
            onChange={(e) => setAjusteDialog((prev) => ({ ...prev, cantidad: e.target.value }))}
            inputProps={{ min: 0 }}
          />
          <TextField
            label="Motivo (opcional)"
            value={ajusteDialog.motivo}
            onChange={(e) => setAjusteDialog((prev) => ({ ...prev, motivo: e.target.value }))}
          />
          <TextField
            label="Observaciones (opcional)"
            value={ajusteDialog.observaciones}
            onChange={(e) => setAjusteDialog((prev) => ({ ...prev, observaciones: e.target.value }))}
            multiline
            minRows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAjuste}>Cancelar</Button>
          <Button variant="contained" onClick={handleGuardarAjuste}>
            Guardar ajuste
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={detalleProducibles.open}
        onClose={() => setDetalleProducibles((prev) => ({ ...prev, open: false }))}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          Producción posible — {detalleProducibles.producto?.nombre ?? ''}
        </DialogTitle>
        <DialogContent>
          {detalleProducibles.calculo?.cantidad != null ? (
            <Alert
              severity={detalleProducibles.calculo.cantidad > 0 ? 'success' : 'warning'}
              sx={{ mb: 2 }}
            >
              Con el stock actual se pueden producir{' '}
              <strong>{detalleProducibles.calculo.cantidad}</strong>{' '}
              {detalleProducibles.calculo.cantidad === 1 ? 'unidad' : 'unidades'}.
            </Alert>
          ) : (
            <Alert severity="info" sx={{ mb: 2 }}>
              La receta no tiene cantidades válidas para calcular la producción posible.
            </Alert>
          )}
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Material</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell align="right">Necesario por unidad</TableCell>
                  <TableCell align="right">Stock actual</TableCell>
                  <TableCell align="right">Alcanza para</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(detalleProducibles.calculo?.detalle ?? []).map((d, idx) => {
                  const esLimitante =
                    d.maxUnidades != null && d.maxUnidades === detalleProducibles.calculo?.cantidad
                  return (
                    <TableRow key={idx}>
                      <TableCell>
                        {d.codigo ? `${d.codigo} — ` : ''}
                        {d.nombre}
                        {!d.encontrado && (
                          <Typography variant="caption" color="error" display="block">
                            No se encontró en los listados activos; se asume stock 0.
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{d.tipo}</TableCell>
                      <TableCell align="right">{d.cantidadNecesaria}</TableCell>
                      <TableCell align="right">{d.stock}</TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          component="span"
                          color={esLimitante ? 'error' : 'text.primary'}
                          sx={{ fontWeight: esLimitante ? 700 : 400 }}
                        >
                          {d.maxUnidades ?? '—'}
                        </Typography>
                        {esLimitante && (
                          <Chip size="small" color="warning" label="Limitante" sx={{ ml: 1 }} />
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetalleProducibles((prev) => ({ ...prev, open: false }))}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  )
}
