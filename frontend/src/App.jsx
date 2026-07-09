import { useEffect, useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Icon } from '@astryxdesign/core/Icon'
import { SideNav, SideNavItem, SideNavSection } from '@astryxdesign/core/SideNav'
import { createCell, deleteCell, listCells, listTables, updateCell } from './api'
import CellList from './components/CellList'
import HistoryPanel from './components/HistoryPanel'
import TableView from './components/TableView'

function IconIndicator({ color, d }) {
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  )
}

const NAV_ITEMS = [
  {
    id: 'test',
    label: '테스트',
    description: '테스트셋 질문을 골라 AI가 생성한 SQL과 정답 SQL을 비교합니다.',
    color: '#2563eb',
    iconPath: 'M9 3h6M10 3v5.2L4.8 18a1.6 1.6 0 0 0 1.4 2.4h11.6a1.6 1.6 0 0 0 1.4-2.4L14 8.2V3',
  },
  {
    id: 'query',
    label: '직접 질문',
    description: '자유롭게 질문을 입력해 SQL을 생성하고 바로 실행합니다.',
    color: '#7c3aed',
    iconPath: 'M4 5h16v11H8l-4 4V5Z',
  },
  {
    id: 'history',
    label: '히스토리',
    description: '지금까지 실행한 질문과 결과를 모아봅니다.',
    color: '#0d9488',
    iconPath: 'M12 8v5l3 2M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9Z',
  },
]

const TABLE_ICON_PATH = 'M4 5h16v14H4z M4 10h16 M4 15h16 M10 5v14'
const TABLE_ICON_COLOR = '#d97706'

function App() {
  const [cells, setCells] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [view, setView] = useState('test')
  const [scrollToId, setScrollToId] = useState(null)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [tables, setTables] = useState([])
  const [selectedTableName, setSelectedTableName] = useState(null)

  useEffect(() => {
    listCells()
      .then(setCells)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    listTables()
      .then(setTables)
      .catch(() => {})
  }, [])

  useEffect(() => {
    function onScroll() {
      setShowScrollTop(window.scrollY > 400)
    }
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (view !== 'history' && scrollToId != null) {
      const el = document.getElementById(`cell-${scrollToId}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setScrollToId(null)
    }
  }, [view, scrollToId, cells])

  function handleHistorySelect(id) {
    const target = cells.find((c) => c.id === id)
    setView(target?.mode === 'freeform' ? 'query' : 'test')
    setScrollToId(id)
  }

  async function handleCreate(body) {
    const start = performance.now()
    const newCell = await createCell(body)
    const durationMs = performance.now() - start
    setCells((prev) => [...prev, { ...newCell, _durationMs: durationMs }])
  }

  async function handleUpdate(id, body) {
    const start = performance.now()
    const updated = await updateCell(id, body)
    const durationMs = performance.now() - start
    setCells((prev) => prev.map((c) => (c.id === id ? { ...updated, _durationMs: durationMs } : c)))
  }

  async function handleDelete(id) {
    await deleteCell(id)
    setCells((prev) => prev.filter((c) => c.id !== id))
  }

  const current = NAV_ITEMS.find((item) => item.id === view)
  const selectedTable = tables.find((t) => t.name === selectedTableName)

  function selectTable(name) {
    setView('tables')
    setSelectedTableName(name)
  }

  return (
    <div className="shell">
      <SideNav
        className="sidebar"
        header={
          <div className="sidebar-brand">
            <span className="sidebar-logo">T2S</span>
            Text2SQL
          </div>
        }
      >
        <SideNavSection title="MENU">
          {tables.length > 0 && (
            <SideNavItem
              label="테이블"
              icon={<IconIndicator color={TABLE_ICON_COLOR} d={TABLE_ICON_PATH} />}
              collapsible
            >
              {tables.map((t) => (
                <SideNavItem
                  key={t.name}
                  label={t.name}
                  isSelected={view === 'tables' && selectedTableName === t.name}
                  onClick={() => selectTable(t.name)}
                />
              ))}
            </SideNavItem>
          )}

          {NAV_ITEMS.map((item) => (
            <SideNavItem
              key={item.id}
              label={item.label}
              icon={<IconIndicator color={item.color} d={item.iconPath} />}
              isSelected={view === item.id}
              onClick={() => setView(item.id)}
            />
          ))}
        </SideNavSection>
      </SideNav>

      <main className="main">
        <div className="main-inner">
          <header className="page-header">
            <div className="breadcrumb">
              <span>Home</span>
              <span>/</span>
              {view === 'tables' ? (
                <>
                  <span>테이블</span>
                  {selectedTableName && (
                    <>
                      <span>/</span>
                      <span className="crumb-current">{selectedTableName}</span>
                    </>
                  )}
                </>
              ) : (
                <span className="crumb-current">{current.label}</span>
              )}
            </div>
            <h1>{view === 'tables' ? selectedTableName || '테이블' : current.label}</h1>
            <p className="page-desc">
              {view === 'tables'
                ? selectedTable?.summary || '왼쪽 사이드바에서 테이블을 선택하면 데이터를 확인할 수 있습니다.'
                : current.description}
            </p>
          </header>

          {loading && <p className="muted">불러오는 중...</p>}
          {error && <p className="cell-error">에러: {error}</p>}

          {!loading && !error && view === 'test' && (
            <CellList
              mode="testset"
              cells={cells.filter((c) => c.mode === 'testset')}
              onCreate={handleCreate}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          )}
          {!loading && !error && view === 'query' && (
            <CellList
              mode="freeform"
              cells={cells.filter((c) => c.mode === 'freeform')}
              onCreate={handleCreate}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          )}
          {!loading && !error && view === 'history' && (
            <HistoryPanel cells={cells} onSelect={handleHistorySelect} />
          )}
          {view === 'tables' && selectedTable && (
            <TableView key={selectedTable.name} table={selectedTable} />
          )}
        </div>
      </main>

      <Button
        className={showScrollTop ? 'scroll-top-button visible' : 'scroll-top-button'}
        variant="secondary"
        isIconOnly
        icon={<Icon icon="arrowUp" />}
        label="맨 위로"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      />
    </div>
  )
}

export default App
