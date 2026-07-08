import { useEffect, useState } from 'react'
import { createCell, deleteCell, listCells, updateCell } from './api'
import CellList from './components/CellList'
import HistoryPanel from './components/HistoryPanel'

function App() {
  const [cells, setCells] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [view, setView] = useState('notebook')
  const [scrollToId, setScrollToId] = useState(null)

  useEffect(() => {
    listCells()
      .then(setCells)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (view === 'notebook' && scrollToId != null) {
      const el = document.getElementById(`cell-${scrollToId}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setScrollToId(null)
    }
  }, [view, scrollToId, cells])

  function handleHistorySelect(id) {
    setView('notebook')
    setScrollToId(id)
  }

  async function handleCreate(body) {
    const newCell = await createCell(body)
    setCells((prev) => [...prev, newCell])
  }

  async function handleUpdate(id, body) {
    const updated = await updateCell(id, body)
    setCells((prev) => prev.map((c) => (c.id === id ? updated : c)))
  }

  async function handleDelete(id) {
    await deleteCell(id)
    setCells((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <div className="app">
      <h1>Text2SQL Notebook</h1>

      <div className="tabs">
        <button
          type="button"
          className={view === 'notebook' ? 'active' : ''}
          onClick={() => setView('notebook')}
        >
          노트북
        </button>
        <button
          type="button"
          className={view === 'history' ? 'active' : ''}
          onClick={() => setView('history')}
        >
          테스트셋 히스토리
        </button>
      </div>

      {loading && <p className="muted">불러오는 중...</p>}
      {error && <p className="cell-error">에러: {error}</p>}
      {!loading && !error && view === 'notebook' && (
        <CellList
          cells={cells}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}
      {!loading && !error && view === 'history' && (
        <HistoryPanel cells={cells} onSelect={handleHistorySelect} />
      )}
    </div>
  )
}

export default App
