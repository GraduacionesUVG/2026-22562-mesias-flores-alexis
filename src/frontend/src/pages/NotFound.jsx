// src/pages/NotFound.jsx
import * as React from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Box, Button, Typography, Paper } from '@mui/material'
import SearchOffRoundedIcon from '@mui/icons-material/SearchOffRounded'
import HomeRoundedIcon from '@mui/icons-material/HomeRounded'

// Página que se muestra cuando la dirección no existe.
// Antes era un <h1> suelto con "404" (jerga) y sin forma de volver.
// Ahora explica en lenguaje claro qué pasó y ofrece un botón para regresar.
export default function NotFound() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        bgcolor: 'background.default',
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: { xs: 3, sm: 5 },
          maxWidth: 480,
          width: '100%',
          textAlign: 'center',
        }}
      >
        <SearchOffRoundedIcon sx={{ fontSize: 64, color: 'primary.main', mb: 1 }} />
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          No encontramos esta página
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          La página que buscas no existe o fue movida. No te preocupes, puedes
          volver al inicio y seguir trabajando.
        </Typography>
        <Button
          component={RouterLink}
          to="/COPRODA"
          variant="contained"
          size="large"
          startIcon={<HomeRoundedIcon />}
        >
          Volver al inicio
        </Button>
      </Paper>
    </Box>
  )
}
