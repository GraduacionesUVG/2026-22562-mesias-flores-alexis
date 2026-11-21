// src/ui/AppLayout.jsx
import * as React from 'react'
import { Outlet, Link as RouterLink, useNavigate } from 'react-router-dom'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'
import ListItemIcon from '@mui/material/ListItemIcon'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import { useAuth } from '../context/AuthContext'
import logoCoproda from '../assets/image.png'

export default function AppLayout() {
  const { user, logout, hasAnyPermiso } = useAuth()
  const navigate = useNavigate()

  // Estado SOLO de UI: controla la apertura del menú en pantallas chicas (xs/sm).
  // No afecta permisos, rutas ni la lógica de logout.
  const [menuAnchor, setMenuAnchor] = React.useState(null)
  const menuAbierto = Boolean(menuAnchor)
  const abrirMenu = (e) => setMenuAnchor(e.currentTarget)
  const cerrarMenu = () => setMenuAnchor(null)

  const handleLogout = () => {
    logout()                               // limpia contexto + localStorage
    navigate('/COPRODA/signin', { replace: true }) // manda al login
  }

  const canAccess = (permiso) => hasAnyPermiso([permiso])

  // Construimos UNA sola lista de enlaces a partir de las MISMAS condiciones de
  // permiso de siempre, para no duplicar la lógica entre la fila (md+) y el menú
  // colapsable (xs/sm). El resultado es idéntico al original: mismos enlaces,
  // mismas rutas y mismas condiciones (`canAccess(...)`).
  const navItems = [
    { label: 'Inicio', to: '/COPRODA', visible: true },
    {
      label: 'Productos',
      to: '/COPRODA/compras',
      visible: canAccess('Compras') || canAccess('Productos'),
    },
    { label: 'Ventas', to: '/COPRODA/ventas', visible: canAccess('Ventas') },
    { label: 'Pedidos', to: '/COPRODA/pedidos', visible: canAccess('Pedidos') },
    {
      label: 'Ordenes',
      to: '/COPRODA/ordenes',
      visible: !canAccess('maestro') && (canAccess('Produccion') || canAccess('Ventas')),
    },
    {
      label: 'Producción',
      to: '/COPRODA/produccion-dashboard',
      visible: canAccess('Produccion') || canAccess('Bodega'),
    },
    { label: 'Bodega', to: '/COPRODA/bodega', visible: canAccess('Bodega') },
    {
      label: 'Clientes',
      to: '/COPRODA/clientes',
      visible: canAccess('Clientes') || canAccess('ClientesVentas') || canAccess('ClientesFinanzas'),
    },
    { label: 'Abonos', to: '/COPRODA/abonos', visible: canAccess('Abonos') },
    { label: 'Bancos', to: '/COPRODA/bancos', visible: canAccess('Bancos') },
    { label: 'Reportes', to: '/COPRODA/reportes', visible: canAccess('Reportes') },
    {
      label: 'Stocks',
      to: '/COPRODA/stocks',
      visible: canAccess('maestro') || canAccess('Produccion'),
    },
  ]

  // Solo los enlaces que cumplen su condición (idéntico a los `? ... : null` previos).
  const enlacesVisibles = navItems.filter((item) => item.visible)

  const nombreUsuario = user?.username || user?.usuario || ''

  return (
    <>
      <AppBar
        position="sticky"
        sx={{ top: 0, backgroundColor: 'primary.main', color: 'white' }}
      >
        <Toolbar>
          {/* Logo: ahora en un <Box> (no en <Typography>), con la misma imagen,
              alt="Coproda" y altura 50. */}
          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
            <img
              src={logoCoproda}
              alt="Coproda"
              style={{ height: 50, display: 'block' }}
            />
          </Box>

          {/* Navegación solo si está logueado */}
          {user && (
            <>
              {/* Pantallas md+: fila de botones como estaba. */}
              <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center' }}>
                {enlacesVisibles.map((item) => (
                  <Button
                    key={item.to}
                    color="inherit"
                    component={RouterLink}
                    to={item.to}
                  >
                    {item.label}
                  </Button>
                ))}

                {/* Mostrar usuario + Logout */}
                <Typography
                  variant="body2"
                  sx={{ mx: 2, fontWeight: 500 }}
                >
                  {nombreUsuario}
                </Typography>

                <Button
                  color="inherit"
                  onClick={handleLogout}
                >
                  Cerrar sesión
                </Button>
              </Box>

              {/* Pantallas xs/sm: enlaces colapsados en un menú. El nombre de
                  usuario y "Cerrar sesión" también quedan accesibles dentro. */}
              <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center' }}>
                <IconButton
                  color="inherit"
                  aria-label="Abrir menú de navegación"
                  aria-controls={menuAbierto ? 'menu-navegacion-movil' : undefined}
                  aria-haspopup="true"
                  aria-expanded={menuAbierto ? 'true' : undefined}
                  onClick={abrirMenu}
                  edge="end"
                >
                  <MenuRoundedIcon />
                </IconButton>

                <Menu
                  id="menu-navegacion-movil"
                  anchorEl={menuAnchor}
                  open={menuAbierto}
                  onClose={cerrarMenu}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                  {/* Nombre de usuario visible dentro del menú en móvil. */}
                  {nombreUsuario ? (
                    <Typography
                      variant="body2"
                      sx={{ px: 2, py: 1, fontWeight: 600 }}
                    >
                      {nombreUsuario}
                    </Typography>
                  ) : null}
                  {nombreUsuario ? <Divider /> : null}

                  {/* Mismos enlaces y mismas condiciones que en md+. */}
                  {enlacesVisibles.map((item) => (
                    <MenuItem
                      key={item.to}
                      component={RouterLink}
                      to={item.to}
                      onClick={cerrarMenu}
                    >
                      {item.label}
                    </MenuItem>
                  ))}

                  <Divider />

                  <MenuItem
                    onClick={() => {
                      cerrarMenu()
                      handleLogout()
                    }}
                  >
                    <ListItemIcon>
                      <LogoutRoundedIcon fontSize="small" />
                    </ListItemIcon>
                    Cerrar sesión
                  </MenuItem>
                </Menu>
              </Box>
            </>
          )}

          {/* Si quisieras que en algún caso se vea el botón de login:
          {!user && (
            <Button color="inherit" component={RouterLink} to="/signin">
              Sign in
            </Button>
          )} */}
        </Toolbar>
      </AppBar>

      <Container sx={{ py: 3 }}>
        <Outlet />
      </Container>
    </>
  )
}
