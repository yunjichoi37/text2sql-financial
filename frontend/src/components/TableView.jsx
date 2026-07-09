import { useEffect, useState } from 'react'
import { Table, useTablePagination } from '@astryxdesign/core/Table'
import { getTableRows } from '../api'

const PAGE_SIZE = 20

export default function TableView({ table }) {
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getTableRows(table.name, page, PAGE_SIZE)
      .then((data) => {
        setRows(data.rows)
        setTotal(data.total)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [table.name, page])

  const paginationPlugin = useTablePagination({
    page,
    onPageChange: setPage,
    totalItems: total,
    pageSize: PAGE_SIZE,
  })

  const idKey = Object.keys(table.columns)[0]

  return (
    <div className="table-view">
      {loading && <p className="muted">불러오는 중...</p>}
      {error && <div className="cell-error">에러: {error}</div>}
      {!loading && !error && (
        <Table
          data={rows}
          idKey={idKey}
          density="compact"
          dividers="grid"
          hasHover
          plugins={{ pagination: paginationPlugin }}
        />
      )}
    </div>
  )
}
