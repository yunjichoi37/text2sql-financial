import { useEffect, useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Icon } from '@astryxdesign/core/Icon'
import { SideNav, SideNavItem, SideNavSection } from '@astryxdesign/core/SideNav'
import {
  createCell,
  deleteCell,
  getBatchRun,
  listCellRuns,
  listCells,
  listTables,
  updateCell,
} from './api'
import BatchHistoryPage from './components/BatchHistoryPage'
import BatchRunDetail from './components/BatchRunDetail'
import BatchRunPage from './components/BatchRunPage'
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
  {
    id: 'batch-run',
    label: '새 테스트',
    description: '테스트셋 전체(또는 난이도별)를 한 번에 실행해 정확도와 소요시간을 비교합니다.',
  },
  {
    id: 'batch-history',
    label: '통합 히스토리',
    description: '지금까지 실행한 통합 테스트 결과를 모아봅니다.',
  },
]

const TABLE_ICON_PATH = 'M4 5h16v14H4z M4 10h16 M4 15h16 M10 5v14'
const TABLE_ICON_COLOR = '#d97706'
const BATCH_ICON_PATH = 'M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'
const BATCH_ICON_COLOR = '#dc2626'

function App() {
  const [cells, setCells] = useState([])
  const [cellRuns, setCellRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [view, setView] = useState('test')
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [tables, setTables] = useState([])
  const [selectedTableName, setSelectedTableName] = useState(null)
  const [selectedTableRowCount, setSelectedTableRowCount] = useState(null)
  const [detailBatch, setDetailBatch] = useState(null)

  useEffect(() => {
    listCells()
      .then(setCells)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    listCellRuns()
      .then(setCellRuns)
      .catch(() => {})
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

  // 통합 테스트 상세 화면이 실행 중인 배치를 보고 있으면 완료될 때까지 계속 폴링한다.
  useEffect(() => {
    if (!detailBatch || detailBatch.status !== 'running') return undefined
    const id = detailBatch.id
    const interval = setInterval(async () => {
      try {
        setDetailBatch(await getBatchRun(id))
      } catch {
        clearInterval(interval)
      }
    }, 1500)
    return () => clearInterval(interval)
  }, [detailBatch?.id, detailBatch?.status])

  async function openBatchDetail(id) {
    setDetailBatch(await getBatchRun(id))
    setView('batch-history')
  }

  function closeBatchDetail() {
    setDetailBatch(null)
    setView('batch-history')
  }

  function selectBatchTab(id) {
    setDetailBatch(null)
    setView(id)
  }

  async function handleCreate(body) {
    const newCell = await createCell(body)
    setCells((prev) => [...prev, newCell])
    listCellRuns().then(setCellRuns).catch(() => {})
  }

  async function handleUpdate(id, body) {
    const updated = await updateCell(id, body)
    setCells((prev) => prev.map((c) => (c.id === id ? updated : c)))
    listCellRuns().then(setCellRuns).catch(() => {})
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
    setSelectedTableRowCount(null)
  }

  return (
    <div className="shell">
      <SideNav
        className="sidebar"
        header={
          <div className="sidebar-brand">
            <img src="/birdSQL.png" alt="" className="sidebar-logo" />
            <div className="sidebar-brand-text">
              <div className="sidebar-brand-title">Bird Bench</div>
              <div className="sidebar-brand-subtitle">SQL Test Playground</div>
            </div>
          </div>
        }
      >
        <SideNavSection title="MENU">
          {['test', 'query'].map((id) => {
            const item = NAV_ITEMS.find((n) => n.id === id)
            return (
              <SideNavItem
                key={item.id}
                label={item.label}
                icon={<IconIndicator color={item.color} d={item.iconPath} />}
                isSelected={view === item.id}
                onClick={() => setView(item.id)}
              />
            )
          })}

          {tables.length > 0 && (
            <SideNavItem
              label="테이블"
              icon={<IconIndicator color={TABLE_ICON_COLOR} d={TABLE_ICON_PATH} />}
              collapsible={{ defaultIsCollapsed: true }}
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

          {NAV_ITEMS.filter((item) => item.id === 'history').map((item) => (
            <SideNavItem
              key={item.id}
              label={item.label}
              icon={<IconIndicator color={item.color} d={item.iconPath} />}
              isSelected={view === item.id}
              onClick={() => setView(item.id)}
            />
          ))}

          <SideNavItem
            label="통합 테스트"
            icon={<IconIndicator color={BATCH_ICON_COLOR} d={BATCH_ICON_PATH} />}
            collapsible={{ defaultIsCollapsed: false }}
          >
            <SideNavItem
              label="새 테스트"
              isSelected={view === 'batch-run'}
              onClick={() => selectBatchTab('batch-run')}
            />
            <SideNavItem
              label="통합 히스토리"
              isSelected={view === 'batch-history'}
              onClick={() => selectBatchTab('batch-history')}
            />
          </SideNavItem>
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
            <h1>
              {view === 'tables' ? selectedTableName || '테이블' : current.label}
              {view === 'tables' && selectedTableRowCount != null && (
                <span className="row-count-label"> {selectedTableRowCount} rows</span>
              )}
            </h1>
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
          {!loading && !error && view === 'history' && <HistoryPanel runs={cellRuns} />}
          {!loading && !error && detailBatch && (view === 'batch-run' || view === 'batch-history') && (
            <BatchRunDetail run={detailBatch} onBack={closeBatchDetail} />
          )}
          {!loading && !error && !detailBatch && view === 'batch-run' && (
            <BatchRunPage onCreated={openBatchDetail} />
          )}
          {!loading && !error && !detailBatch && view === 'batch-history' && (
            <BatchHistoryPage onSelect={openBatchDetail} />
          )}
          {view === 'tables' && selectedTable && (
            <TableView
              key={selectedTable.name}
              table={selectedTable}
              onTotalChange={setSelectedTableRowCount}
            />
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
