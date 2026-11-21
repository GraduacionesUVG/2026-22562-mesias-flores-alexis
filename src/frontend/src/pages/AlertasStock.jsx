import * as React from 'react'
import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import RefreshIcon from '@mui/icons-material/Refresh'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { API_BASE_URL } from '../config/api'

// Margen sobre el mínimo para avisar "se está acercando" (20%)
const MARGEN_CERCANIA = 1.2

const clasificarTipo = (producto) => {
  if (producto?.es_producto_final === false) return 'Componente'
  if (producto?.es_terminado === false) return 'A granel'
  return 'Terminado'
}

// Devuelve la alerta de stock de un item o null si no aplica.
// Solo se vigilan items con stock_minimo > 0 definido.
const evaluarAlerta = (item) => {
  const minimo = Number(item?.stock_minimo)
  if (!Number.isFinite(minimo) || minimo <= 0) return null
  const actual = Number(item?.stock_actual)
  const stock = Number.isFinite(actual) ? actual : 0
  if (stock <= minimo) return { nivel: 'minimo', stock, minimo }
  if (stock <= minimo * MARGEN_CERCANIA) return { nivel: 'cerca', stock, minimo }
  return null
}

const ordenarPorUrgencia = (a, b) => {
  if (a.nivel !== b.nivel) return a.nivel === 'minimo' ? -1 : 1
  return a.stock / a.minimo - b.stock / b.minimo
}

const ChipNivel = ({ nivel }) =>
  nivel === 'minimo' ? (
    <Chip size="small" color="error" label="En mínimo" />
  ) : (
    <Chip size="small" color="warning" label="Cerca del mínimo" />
  )

export default function AlertasStock() {
  const [productos, setProductos] = React.useState([])
  const [materiasPrimas, setMateriasPrimas] = React.useState([])
  const [cargando, setCargando] = React.useState(true)
  const [error, setError] = React.useState(false)

  const cargarStocks = React.useCallback(async () => {
    try {
      setCargando(true)
      setError(false)
      const [resProductos, resMaterias] = await Promise.all([
        fetch(`${API_BASE_URL}/productos`),
        fetch(`${API_BASE_URL}/materias-primas`),
      ])
      if (!resProductos.ok || !resMaterias.ok) throw new Error('Error al cargar stocks')
      const [dataProductos, dataMaterias] = await Promise.all([
        resProductos.json(),
        resMaterias.json(),
      ])
      setProductos((dataProductos || []).filter((item) => item?.activo !== false))
      setMateriasPrimas((dataMaterias || []).filter((item) => item?.activo !== false))
    } catch (err) {
      console.error(err)
      setError(true)
    } finally {
      setCargando(false)
    }
  }, [])

  React.useEffect(() => {
    cargarStocks()
  }, [cargarStocks])

  const alertasProductos = React.useMemo(
    () =>
      productos
        .map((producto) => {
          const alerta = evaluarAlerta(producto)
          return alerta ? { ...alerta, producto } : null
        })
        .filter(Boolean)
        .sort(ordenarPorUrgencia),
    [productos]
  )

  const alertasMaterias = React.useMemo(
    () =>
      materiasPrimas
        .map((materia) => {
          const alerta = evaluarAlerta(materia)
          return alerta ? { ...alerta, materia } : null
        })
        .filter(Boolean)
        .sort(ordenarPorUrgencia),
    [materiasPrimas]
  )

  const totalEnMinimo =
    alertasProductos.filter((a) => a.nivel === 'minimo').length +
    alertasMaterias.filter((a) => a.nivel === 'minimo').length
  const totalCerca = alertasProductos.length + alertasMaterias.length - totalEnMinimo

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', mt: 3, px: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <WarningAmberIcon color={totalEnMinimo > 0 ? 'error' : 'action'} />
          <Typography variant="h5" sx={{ fontWeight: 600, flexGrow: 1 }}>
            Alertas de stock mínimo
          </Typography>
          {totalEnMinimo > 0 && (
            <Chip size="small" color="error" label={`${totalEnMinimo} en mínimo`} />
          )}
          {totalCerca > 0 && <Chip size="small" color="warning" label={`${totalCerca} cerca`} />}
          <Button
            size="small"
            variant="outlined"
            startIcon={cargando ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
            onClick={cargarStocks}
            disabled={cargando}
          >
            {cargando ? 'Revisando…' : 'Recargar'}
          </Button>
        </Stack>

        <Typography variant="body2" color="text.secondary">
          Se vigilan los productos y materias primas con stock mínimo definido en la página de
          Stocks. "Cerca del mínimo" avisa cuando el stock está hasta un 20% arriba del mínimo.
        </Typography>

        {cargando ? (
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center">
              <CircularProgress size={20} />
              <Typography color="text.secondary">Revisando stocks…</Typography>
            </Stack>
          </Paper>
        ) : error ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={cargarStocks}>
                Reintentar
              </Button>
            }
          >
            No se pudieron revisar los stocks.
          </Alert>
        ) : alertasProductos.length === 0 && alertasMaterias.length === 0 ? (
          <Alert severity="success">
            Todo en orden: ningún producto ni materia prima está bajo su stock mínimo. Define los
            mínimos en la página de Stocks para vigilar más artículos.
          </Alert>
        ) : (
          <Stack spacing={3}>
            <Paper sx={{ p: 2, borderRadius: 3 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Hay que producir
                </Typography>
                <Chip size="small" label={`${alertasProductos.length} producto(s)`} />
              </Stack>
              {alertasProductos.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Ningún producto bajo su stock mínimo.
                </Typography>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Producto</TableCell>
                        <TableCell>Tipo</TableCell>
                        <TableCell align="right">Stock actual</TableCell>
                        <TableCell align="right">Stock mínimo</TableCell>
                        <TableCell>Estado</TableCell>
                        <TableCell align="right">Acción</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {alertasProductos.map(({ producto, nivel, stock, minimo }) => (
                        <TableRow key={producto.id} hover>
                          <TableCell>
                            {producto.codigo ? `${producto.codigo} — ` : ''}
                            {producto.nombre}
                          </TableCell>
                          <TableCell>{clasificarTipo(producto)}</TableCell>
                          <TableCell align="right">{stock}</TableCell>
                          <TableCell align="right">{minimo}</TableCell>
                          <TableCell>
                            <ChipNivel nivel={nivel} />
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              variant="contained"
                              component={RouterLink}
                              to={`/COPRODA/produccion?crear=${producto.id}`}
                            >
                              Crear orden
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>

            <Paper sx={{ p: 2, borderRadius: 3 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Hay que comprar (materias primas)
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip size="small" label={`${alertasMaterias.length} materia(s)`} />
                  <Button size="small" component={RouterLink} to="/COPRODA/stocks?tab=materias">
                    Ver stocks
                  </Button>
                </Stack>
              </Stack>
              {alertasMaterias.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Ninguna materia prima bajo su stock mínimo.
                </Typography>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Materia prima</TableCell>
                        <TableCell align="right">Stock actual</TableCell>
                        <TableCell align="right">Stock mínimo</TableCell>
                        <TableCell>Estado</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {alertasMaterias.map(({ materia, nivel, stock, minimo }) => (
                        <TableRow key={materia.id} hover>
                          <TableCell>
                            {materia.codigo ? `${materia.codigo} — ` : ''}
                            {materia.nombre}
                          </TableCell>
                          <TableCell align="right">{stock}</TableCell>
                          <TableCell align="right">{minimo}</TableCell>
                          <TableCell>
                            <ChipNivel nivel={nivel} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Stack>
        )}
      </Stack>
    </Box>
  )
}
