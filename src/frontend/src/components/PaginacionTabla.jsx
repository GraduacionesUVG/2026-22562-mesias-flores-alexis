import * as React from 'react'
import { TablePagination } from '@mui/material'

// Hook de paginación en cliente: recibe la lista completa y devuelve
// los items de la página actual junto con las props para <PaginacionTabla />
export function usePaginacion(items, rowsPerPageInicial = 10) {
  const [page, setPage] = React.useState(0)
  const [rowsPerPage, setRowsPerPage] = React.useState(rowsPerPageInicial)

  const count = items?.length ?? 0
  // Si la lista se achica (filtros, eliminaciones) evitamos quedar en una página vacía
  const maxPage = Math.max(0, Math.ceil(count / rowsPerPage) - 1)
  const paginaActual = Math.min(page, maxPage)

  const itemsPagina = React.useMemo(
    () => (items || []).slice(paginaActual * rowsPerPage, paginaActual * rowsPerPage + rowsPerPage),
    [items, paginaActual, rowsPerPage]
  )

  const reset = React.useCallback(() => setPage(0), [])

  const paginacion = {
    count,
    page: paginaActual,
    rowsPerPage,
    onPageChange: (_event, nuevaPagina) => setPage(nuevaPagina),
    onRowsPerPageChange: (event) => {
      setRowsPerPage(parseInt(event.target.value, 10))
      setPage(0)
    },
  }

  return { itemsPagina, paginacion, reset }
}

export default function PaginacionTabla(props) {
  return (
    <TablePagination
      component="div"
      rowsPerPageOptions={[5, 10, 25, 50]}
      labelRowsPerPage="Filas por página"
      labelDisplayedRows={({ from, to, count }) =>
        `${from}–${to} de ${count !== -1 ? count : `más de ${to}`}`}
      {...props}
    />
  )
}
