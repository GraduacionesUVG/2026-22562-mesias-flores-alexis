// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { ThemeProvider, CssBaseline } from '@mui/material'
import theme from './theme.js'
import router from './router.jsx'
import '@fontsource/roboto/300.css'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import '@fontsource/roboto/700.css'
import { AuthProvider } from './context/AuthContext'
import { ConfirmProvider } from './components/ConfirmProvider'


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      {/* ThemeProvider faltaba: por eso el tema no se aplicaba en toda la app.
          Ahora toda la app comparte una sola identidad visual. */}
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {/* Provee el diálogo de confirmación reutilizable (useConfirm). */}
        <ConfirmProvider>
          <RouterProvider router={router} />
        </ConfirmProvider>
      </ThemeProvider>
    </AuthProvider>
  </React.StrictMode>
)
