import * as React from 'react'
import {
  Box,
  Paper,
  Typography,
  Stack,
  TextField,
  Button,
  MenuItem,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Divider,
  IconButton,
} from '@mui/material'
import CircularProgress from '@mui/material/CircularProgress'
import DeleteIcon from '@mui/icons-material/Delete'
import { API_BASE_URL } from '../config/api'
import { useConfirm } from '../components/ConfirmProvider'
import PaginacionTabla, { usePaginacion } from '../components/PaginacionTabla'
import { formatFecha } from '../utils/format'

const BANCOS_GUATEMALA = [
  'Banco Industrial',
  'Banrural',
  'G&T Continental',
  'BAC Credomatic',
  'Banco Agromercantil (BAM)',
  'Banco Internacional',
  'Banco Promerica',
  'Banco de Antigua',
  'Banco Ficohsa',
  'Bantrab',
  'Banco Azteca',
  'Banco Inmobiliario',
  'Efectivo'
]

export default function Bancos() {
  const confirm = useConfirm()
  const [pagos, setPagos] = React.useState([])
  const [cargando, setCargando] = React.useState(true)
  const [filtroAsignado, setFiltroAsignado] = React.useState('todos')
  const [filtroFecha, setFiltroFecha] = React.useState('')
  const [form, setForm] = React.useState({
    fecha: new Date().toISOString().slice(0, 10),
    referencia: '',
    banco: '',
    monto: '',
    nota: '',
  })
  const [saving, setSaving] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState(null)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    const cargarPagos = async () => {
      setCargando(true)
      try {
        const res = await fetch(`${API_BASE_URL}/bancos`)
        if (!res.ok) throw new Error('Error al obtener pagos')
        const data = await res.json()
        setPagos(data || [])
      } catch (err) {
        console.error(err)
      } finally {
        setCargando(false)
      }
    }

    cargarPagos()
  }, [])

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const handleAddPago = async () => {
    if (!form.referencia.trim() || !form.monto || !form.banco.trim()) return
    if (saving) return
    try {
      setSaving(true)
      setError('')
      const payload = {
        fecha: form.fecha || new Date().toISOString().slice(0, 10),
        referencia: form.referencia.trim(),
        banco: form.banco.trim(),
        monto: Number(form.monto) || 0,
        nota: form.nota.trim() || null,
        asignado: false,
      }
      const res = await fetch(`${API_BASE_URL}/bancos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const txt = await res.text()
        let msg = 'No se pudo crear el pago'
        try {
          const parsed = JSON.parse(txt)
          msg = parsed.error || msg
        } catch (_) {
          // noop
        }
        setError(msg)
        return
      }
      const created = await res.json()
      setPagos((prev) => [created, ...prev])
      setForm((prev) => ({
        ...prev,
        referencia: '',
        banco: '',
        monto: '',
        nota: '',
      }))
    } catch (err) {
      console.error(err)
      setError('Error de red al crear el pago')
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePago = async (pago) => {
    if (!pago?.id) return
    const confirmed = await confirm({
      title: 'Eliminar pago',
      message: '¿Seguro que quieres eliminar este pago? Esta acción no se puede deshacer.',
      confirmText: 'Sí, eliminar',
      cancelText: 'Cancelar',
      severity: 'error',
    })
    if (!confirmed) return
    try {
      setDeletingId(pago.id)
      const res = await fetch(`${API_BASE_URL}/bancos/${pago.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('No se pudo eliminar el pago')
      setPagos((prev) => prev.filter((p) => p.id !== pago.id))
    } catch (err) {
      console.error(err)
      setError('No se pudo eliminar el pago')
    } finally {
      setDeletingId(null)
    }
  }

  const pagosFiltrados = React.useMemo(() => {
    let lista = pagos
    if (filtroAsignado === 'asignado') {
      lista = lista.filter((p) => p.asignado)
    } else if (filtroAsignado === 'no-asignado') {
      lista = lista.filter((p) => !p.asignado)
    }
    if (filtroFecha) {
      lista = lista.filter((p) => String(p.fecha || '').slice(0, 10) === filtroFecha)
    }
    // De más nuevo a más viejo; a igual fecha, el registro más reciente primero.
    return lista.slice().sort((a, b) => {
      const fa = String(a.fecha || '')
      const fb = String(b.fecha || '')
      if (fa !== fb) return fb.localeCompare(fa)
      return (b.id || 0) - (a.id || 0)
    })
  }, [pagos, filtroAsignado, filtroFecha])

  const {
    itemsPagina: pagosPagina,
    paginacion: paginacionPagos,
    reset: resetPaginacionPagos,
  } = usePaginacion(pagosFiltrados)

  // Al cambiar los filtros volvemos a la primera página
  React.useEffect(() => {
    resetPaginacionPagos()
  }, [filtroAsignado, filtroFecha, resetPaginacionPagos])

  const total = pagosFiltrados.reduce((s, p) => s + (Number(p.monto) || 0), 0)

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', mt: 3 }}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
        Bancos — Pagos
      </Typography>

      <Paper sx={{ p: 2, borderRadius: 3, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          Registrar pago
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} useFlexGap flexWrap="wrap">
          <TextField
            label="Fecha"
            type="date"
            value={form.fecha}
            onChange={handleChange('fecha')}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 180 }}
          />
          <TextField
            label="Referencia"
            value={form.referencia}
            onChange={handleChange('referencia')}
            sx={{ minWidth: 180 }}
            required
          />
          <TextField
            select
            label="Banco"
            value={form.banco}
            onChange={handleChange('banco')}
            sx={{ minWidth: 160 }}
          >
            {BANCOS_GUATEMALA.map((banco) => (
              <MenuItem key={banco} value={banco}>
                {banco}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Monto (Q)"
            type="number"
            value={form.monto}
            onChange={handleChange('monto')}
            sx={{ minWidth: 140 }}
            inputProps={{ min: 0, step: '0.01' }}
            required
          />
          <TextField
            label="Nota"
            value={form.nota}
            onChange={handleChange('nota')}
            fullWidth
          />
          <Button
            variant="contained"
            onClick={handleAddPago}
            disabled={!form.referencia.trim() || !form.monto || !form.banco.trim() || saving}
          >
            Guardar pago
          </Button>
        </Stack>
        {error && (
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
      </Paper>

      <Paper sx={{ p: 2, borderRadius: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Todos los pagos
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              type="date"
              label="Día"
              value={filtroFecha}
              onChange={(e) => setFiltroFecha(e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 170 }}
            />
            {filtroFecha && (
              <Button size="small" onClick={() => setFiltroFecha('')}>
                Limpiar
              </Button>
            )}
            <TextField
              select
              label="Filtro"
              value={filtroAsignado}
              onChange={(e) => setFiltroAsignado(e.target.value)}
              size="small"
              sx={{ minWidth: 170 }}
            >
              <MenuItem value="todos">Todos</MenuItem>
              <MenuItem value="asignado">Asignado</MenuItem>
              <MenuItem value="no-asignado">No asignado</MenuItem>
            </TextField>
            <Typography variant="subtitle2" color="text.secondary">
              Total: Q {total.toFixed(2)}
            </Typography>
          </Stack>
        </Stack>
        <Divider sx={{ mb: 1 }} />
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Fecha</TableCell>
              <TableCell>Referencia</TableCell>
              <TableCell>Banco</TableCell>
              <TableCell>Nota</TableCell>
              <TableCell>Asignado</TableCell>
              <TableCell align="right">Monto (Q)</TableCell>
              <TableCell align="center">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cargando && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center" sx={{ py: 1 }}>
                    <CircularProgress size={20} />
                    <Typography color="text.secondary">Cargando pagos…</Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            )}
            {!cargando && pagosPagina.map((p) => (
              <TableRow
                key={p.id}
                sx={{
                  backgroundColor: p.asignado ? 'success.light' : 'error.light',
                  color: 'text.primary',
                }}
              >
                <TableCell>{formatFecha(p.fecha)}</TableCell>
                <TableCell>{p.referencia}</TableCell>
                <TableCell>{p.banco || '—'}</TableCell>
                <TableCell>{p.nota || '—'}</TableCell>
                <TableCell
                  sx={{
                    color: p.asignado ? 'success.main' : 'error.main',
                    fontWeight: 600,
                  }}
                >
                  {p.asignado ? 'Sí' : 'No'}
                </TableCell>
                <TableCell align="right">Q {(Number(p.monto) || 0).toFixed(2)}</TableCell>
                <TableCell align="center">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDeletePago(p)}
                    disabled={deletingId === p.id}
                    aria-label="Eliminar pago"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {!cargando && pagosFiltrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography align="center" color="text.secondary">
                    No hay pagos registrados.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <PaginacionTabla {...paginacionPagos} />
      </Paper>
    </Box>
  )
}
