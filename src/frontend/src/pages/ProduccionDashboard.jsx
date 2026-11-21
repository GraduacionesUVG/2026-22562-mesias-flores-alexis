import * as React from 'react'
import { Grid, Typography, Divider } from '@mui/material'
import AssignmentIcon from '@mui/icons-material/Assignment'
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing'
import AddBoxIcon from '@mui/icons-material/AddBox'
import ExtensionIcon from '@mui/icons-material/Extension'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import ScienceIcon from '@mui/icons-material/Science'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd'
import AssessmentIcon from '@mui/icons-material/Assessment'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import ModuleCard from '../components/ModuleCard'
import { useAuth } from '../context/AuthContext'

const modules = [
  {
    to: '/COPRODA/alertas-stock',
    permiso: 'Produccion',
    title: 'Alertas de Stock',
    icon: WarningAmberIcon,
    subtitle: 'Productos y materias primas en stock mínimo',
  },
  {
    to: '/COPRODA/ordenes',
    permiso: 'Produccion',
    altPermisos: ['Ventas'],
    title: 'Ordenes',
    icon: AssignmentIcon,
    subtitle: 'Órdenes y seguimiento de producción',
  },
  {
    to: '/COPRODA/produccion',
    permiso: 'Produccion',
    altPermisos: ['Bodega'],
    title: 'Producción',
    icon: PrecisionManufacturingIcon,
    subtitle: 'Crear y gestionar órdenes de producción',
  },
  {
    to: '/COPRODA/produccion-procesos?tipo=producto',
    permiso: 'Compras',
    altPermisos: ['Productos'],
    title: 'Agregar Producto',
    icon: AddBoxIcon,
    subtitle: 'Asignar procesos y componentes',
  },
  {
    to: '/COPRODA/produccion-procesos?tipo=componente',
    permiso: 'Compras',
    altPermisos: ['Productos'],
    title: 'Agregar Componente',
    icon: ExtensionIcon,
    subtitle: 'Asignar procesos a componentes',
  },
  {
    to: '/COPRODA/procesos/nuevo',
    permiso: 'maestro',
    title: 'Nuevo Proceso',
    icon: PlaylistAddIcon,
    subtitle: 'Crear un proceso del catálogo',
  },
  {
    to: '/COPRODA/reportes-produccion',
    permiso: 'Produccion',
    title: 'Reportes Producción',
    icon: AssessmentIcon,
    subtitle: 'Resumen de órdenes y procesos',
  },
  {
    to: '/COPRODA/stocks?tab=materias',
    permiso: 'maestro',
    altPermisos: ['Produccion'],
    title: 'Stocks Materia Prima',
    icon: ScienceIcon,
    subtitle: 'Stock de materias primas',
  },
  {
    to: '/COPRODA/materias-primas/nueva',
    permiso: 'maestro',
    title: 'Materia Prima',
    icon: AddCircleOutlineIcon,
    subtitle: 'Crear una nueva materia prima',
  },
  {
    to: '/COPRODA/stocks?tab=componentes',
    permiso: 'maestro',
    altPermisos: ['Produccion'],
    title: 'Stocks Componentes',
    icon: Inventory2Icon,
    subtitle: 'Stock de componentes y sub-ensambles',
  },
]

export default function ProduccionDashboard() {
  const { hasAnyPermiso } = useAuth()
  const visibleModules = modules.filter((m) => {
    if (!m.permiso && (!m.altPermisos || m.altPermisos.length === 0)) return true
    const permisos = m.altPermisos ? [m.permiso, ...m.altPermisos] : [m.permiso]
    return hasAnyPermiso(permisos.filter(Boolean))
  })

  return (
    <>
      <Typography variant="h5" sx={{ mb: 1, fontWeight: 600 }}>
        Producción
      </Typography>
      <Divider sx={{ mb: 3 }} />

      <Grid container spacing={2}>
        {visibleModules.map((m) => (
          <Grid key={m.to} size={{ xs: 12, sm: 6, md: 4 }}>
            <ModuleCard {...m} />
          </Grid>
        ))}
      </Grid>
    </>
  )
}
