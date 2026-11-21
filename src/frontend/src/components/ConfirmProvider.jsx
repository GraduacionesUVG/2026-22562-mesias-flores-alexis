// src/components/ConfirmProvider.jsx
// Diálogo de confirmación reutilizable para toda la app.
//
// Reemplaza a los `window.confirm(...)` nativos (cuadros grises del navegador,
// inconsistentes y poco claros) por un diálogo de Material UI con el estilo de
// la app, texto claro y botones explícitos ("Cancelar" / acción).
//
// Se usa como una promesa, para que el código existente cambie lo mínimo:
//
//   const confirm = useConfirm()
//   ...
//   const ok = await confirm({
//     title: 'Eliminar pago',
//     message: '¿Seguro que quieres eliminar este pago? No se puede deshacer.',
//     confirmText: 'Sí, eliminar',
//     severity: 'error',
//   })
//   if (!ok) return
//
// No cambia ninguna lógica de negocio: solo presenta la confirmación.
import * as React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'

const ConfirmContext = React.createContext(null)

export function ConfirmProvider({ children }) {
  const [state, setState] = React.useState({ open: false, options: {} })
  const resolverRef = React.useRef(null)

  const confirm = React.useCallback((options = {}) => {
    setState({ open: true, options })
    return new Promise((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const cerrar = (resultado) => {
    setState((prev) => ({ ...prev, open: false }))
    if (resolverRef.current) {
      resolverRef.current(resultado)
      resolverRef.current = null
    }
  }

  const {
    title = '¿Confirmar acción?',
    message = '',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    severity = 'primary', // 'error' para acciones destructivas
  } = state.options

  const colorBoton = severity === 'error' ? 'error' : 'primary'

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={state.open}
        onClose={() => cerrar(false)}
        maxWidth="xs"
        fullWidth
        aria-labelledby="confirm-dialog-title"
      >
        <DialogTitle
          id="confirm-dialog-title"
          sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}
        >
          {severity === 'error' && (
            <WarningAmberRoundedIcon color="error" />
          )}
          {title}
        </DialogTitle>
        {message && (
          <DialogContent>
            <DialogContentText sx={{ color: 'text.primary' }}>
              {message}
            </DialogContentText>
          </DialogContent>
        )}
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => cerrar(false)} variant="outlined" color="inherit">
            {cancelText}
          </Button>
          <Button onClick={() => cerrar(true)} variant="contained" color={colorBoton} autoFocus>
            {confirmText}
          </Button>
        </DialogActions>
      </Dialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = React.useContext(ConfirmContext)
  if (!ctx) {
    throw new Error('useConfirm debe usarse dentro de <ConfirmProvider>')
  }
  return ctx
}
