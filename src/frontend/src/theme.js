// src/theme.js
import { createTheme } from '@mui/material/styles'

// -----------------------------------------------------------------------------
// Tema único de la aplicación (COPRODA).
//
// Antes este tema NO se aplicaba (faltaba envolver la app en <ThemeProvider>),
// así que cada pantalla usaba colores y tamaños por su cuenta. Aquí definimos
// una sola identidad visual para TODA la app interna, alineada con la marca roja
// de COPRODA y con la landing pública, para que todo se vea como un solo producto.
//
// IMPORTANTE: este archivo solo cambia la APARIENCIA. No toca ninguna lógica,
// ningún flujo ni ninguna llamada al backend.
// -----------------------------------------------------------------------------

// Paleta de marca
const ROJO_COPRODA = '#d32f2f' // rojo de marca (buen contraste con texto blanco)
const ROJO_OSCURO = '#b71c1c'
const ROJO_CLARO = '#ef5350'
const GRIS_PIZARRA = '#1f2937' // gris/azul oscuro usado también en la landing

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: ROJO_COPRODA,
      dark: ROJO_OSCURO,
      light: ROJO_CLARO,
      contrastText: '#ffffff',
    },
    secondary: {
      main: GRIS_PIZARRA,
      contrastText: '#ffffff',
    },
    success: { main: '#2e7d32', light: '#e8f5e9' },
    error: { main: '#c62828', light: '#fdecea' },
    warning: { main: '#ed6c02', light: '#fff4e5' },
    info: { main: '#0277bd', light: '#e3f2fd' },
    background: {
      default: '#f4f5f7', // fondo general claro y neutro (alta legibilidad)
      paper: '#ffffff', // tarjetas, tablas y formularios en blanco para que resalten
    },
    text: {
      primary: '#1f2937',
      secondary: '#5b6470',
    },
    divider: 'rgba(31, 41, 55, 0.12)',
  },

  shape: {
    borderRadius: 10, // esquinas redondeadas y consistentes en toda la app
  },

  typography: {
    fontFamily: '"Roboto", "Segoe UI", system-ui, -apple-system, sans-serif',
    // Texto base un poco más grande: ayuda a personas con baja alfabetización digital.
    fontSize: 14.5,
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    button: {
      // Sin MAYÚSCULAS forzadas: se lee más fácil.
      textTransform: 'none',
      fontWeight: 600,
      fontSize: '0.95rem',
    },
  },

  components: {
    // Botones cómodos y legibles (objetivos táctiles amplios).
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 10,
          paddingTop: 8,
          paddingBottom: 8,
          minHeight: 42,
        },
        sizeSmall: { minHeight: 34 },
      },
    },
    // Tarjetas y superficies con el mismo radio y sin sombras agresivas.
    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: 12 },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 12 },
      },
    },
    // Encabezados de tabla consistentes y fáciles de leer.
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          backgroundColor: '#f4f5f7',
          color: '#1f2937',
        },
      },
    },
    // Diálogos con esquinas redondeadas coherentes.
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 14 },
      },
    },
    // Campos de texto con tamaño cómodo por defecto.
    MuiTextField: {
      defaultProps: { variant: 'outlined' },
    },
    MuiTooltip: {
      defaultProps: { arrow: true },
    },
  },
})

export default theme
