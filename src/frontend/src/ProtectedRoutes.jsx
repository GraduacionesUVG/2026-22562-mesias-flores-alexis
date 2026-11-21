// src/ProtectedRoutes.jsx
import * as React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Box, CircularProgress, Typography } from '@mui/material'
import { useAuth } from './context/AuthContext'

// Indicador de carga mientras se verifican los permisos del usuario.
// Antes se mostraba una pantalla en blanco (parecía que la app estaba rota).
function CargandoPermisos() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        minHeight: '60vh',
      }}
    >
      <CircularProgress />
      <Typography color="text.secondary">Cargando…</Typography>
    </Box>
  )
}

// Solo requiere estar logueado
export function RequireAuth({ children }) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    // si no hay usuario -> manda a /signin
    return <Navigate to="/COPRODA/signin" state={{ from: location }} replace />
  }

  return children
}

// Requiere permisos específicos (o Maestro/admin)
export function RequirePermiso({ children, permisos = [], permiso }) {
  const { user, hasAnyPermiso, permisosReady } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/COPRODA/signin" state={{ from: location }} replace />
  }

  if (!permisosReady) {
    return <CargandoPermisos />
  }

  const required = permisos.length ? permisos : permiso ? [permiso] : []
  if (required.length > 0 && !hasAnyPermiso(required)) {
    // logueado pero sin permiso -> lo mandamos al home
    return <Navigate to="/COPRODA" replace />
  }

  return children
}
