import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@astryxdesign/core/Button'
import {
  Table,
  pixel,
  proportional,
  useTableSortable,
  useTableSortableState,
} from '@astryxdesign/core/Table'
import { getBatchRun, listBatchRuns, updateBatchRunLabel } from '../api'
import BatchRunDetail from './BatchRunDetail'
import BatchRunForm from './BatchRunForm'

const HISTORY_COLUMNS = [
  {
    key: 'label',
    header: '테스트명',
    sortable: true,
    width: proportional(1),
    renderCell: (run) => run.label || `배치 #${run.id}`,
  },
  { 
    key: 'scope', 
    header: '범위', 
    sortable: true, 
    width: pixel(290) 
  },
  {
    key: 'status',
    header: '상태',
    sortable: true,
    width: pixel(90),
    align: 'center',
    renderCell: (run) => (
      <span className={`batch-status-tag batch-status-${run.status}`}>
        {run.status === 'running' ? '실행 중' : run.status === 'completed' ? '완료' : '실패'}
      </span>
    ),
  },
  {
    key: 'ex_correct',
    header: 'EX',
    sortable: true,
    width: pixel(90),
    align: 'center',
    renderCell: (run) =>
      run.ex_correct != null ? `${run.ex_correct}/${run.total_count}` : '—',
  },
  {
    key: 'soft_f1_avg',
    header: 'Soft F1',
    sortable: true,
    width: pixel(90),
    align: 'center',
    renderCell: (run) =>
      run.soft_f1_avg != null ? `${Math.round(run.soft_f1_avg * 100)}%` : '—',
  },
  {
    key: 'duration_ms',
    header: '소요시간',
    sortable: true,
    width: pixel(90),
    align: 'center',
    renderCell: (run) =>
      typeof run.duration_ms === 'number' ? `${(run.duration_ms / 1000).toFixed(1)}s` : '—',
  },
  {
    key: 'started_at',
    header: '시각',
    sortable: true,
    // width: pixel(150),
    width: proportional(1),
    align: 'center',
    renderCell: (run) => new Date(run.started_at).toLocaleString(),
  },
]

const HISTORY_COMPARATORS = {
  started_at: (a, b) => new Date(a.started_at) - new Date(b.started_at),
  ex_correct: (a, b) => (a.ex_correct ?? -1) - (b.ex_correct ?? -1),
  soft_f1_avg: (a, b) => (a.soft_f1_avg ?? -1) - (b.soft_f1_avg ?? -1),
  duration_ms: (a, b) => (a.duration_ms ?? -1) - (b.duration_ms ?? -1),
}

export default function BatchTestPage() {
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [detailBatch, setDetailBatch] = useState(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [headerActions, setHeaderActions] = useState(null)

  // page-header는 App.jsx가 렌더링하므로, 마운트 후에야 DOM에서 찾을 수 있다.
  useEffect(() => {
    setHeaderActions(document.getElementById('page-header-actions'))
  }, [])

  useEffect(() => {
    if (detailBatch) return
    setHistoryLoading(true)
    listBatchRuns()
      .then(setHistory)
      .finally(() => setHistoryLoading(false))
  }, [detailBatch])

  // 상세 화면이 실행 중인 배치를 보고 있으면 완료될 때까지 계속 폴링한다.
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

  const { sortedData: sortedHistory, sortConfig } = useTableSortableState({
    data: history,
    defaultSort: [{ sortKey: 'started_at', direction: 'descending' }],
    comparators: HISTORY_COMPARATORS,
  })
  const sortPlugin = useTableSortable(sortConfig)

  async function openDetail(id) {
    setDetailBatch(await getBatchRun(id))
  }

  async function handleCreated(id) {
    setIsCreateOpen(false)
    await openDetail(id)
  }

  async function handleLabelUpdate(id, label) {
    const updated = await updateBatchRunLabel(id, label)
    setDetailBatch((prev) => (prev && prev.id === id ? { ...prev, label: updated.label } : prev))
  }

  if (detailBatch) {
    return (
      <BatchRunDetail
        run={detailBatch}
        onBack={() => setDetailBatch(null)}
        onLabelUpdate={handleLabelUpdate}
      />
    )
  }

  return (
    <div className="batch-page">
      {headerActions &&
        createPortal(
          <Button
            variant="primary"
            label="+ 새 테스트 등록"
            onClick={() => setIsCreateOpen(true)}
          />,
          headerActions
        )}

      <BatchRunForm
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={handleCreated}
      />

      {historyLoading && <p className="muted">불러오는 중...</p>}
      {!historyLoading && history.length === 0 && (
        <p className="muted">아직 배치 실행 기록이 없습니다.</p>
      )}
      {!historyLoading && history.length > 0 && (
        <Table
          data={sortedHistory}
          columns={HISTORY_COLUMNS}
          idKey="id"
          density="compact"
          dividers="grid"
          hasHover
          plugins={{
            sort: sortPlugin,
            click: {
              transformBodyRow(props, item) {
                return {
                  ...props,
                  htmlProps: {
                    ...props.htmlProps,
                    onClick: () => openDetail(item.id),
                    style: { ...props.htmlProps?.style, cursor: 'pointer' },
                  },
                }
              },
            },
          }}
        />
      )}
    </div>
  )
}
