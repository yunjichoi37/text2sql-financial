import { useEffect, useState } from 'react'
import {
  Table,
  pixel,
  proportional,
  useTableSortable,
  useTableSortableState,
} from '@astryxdesign/core/Table'
import { listBatchRuns } from '../api'

const HISTORY_COLUMNS = [
  {
    key: 'label',
    header: '라벨',
    sortable: true,
    width: proportional(2),
    renderCell: (run) => run.label || `배치 #${run.id}`,
  },
  { key: 'scope', header: '범위', sortable: true, width: pixel(120) },
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
    width: proportional(1),
    renderCell: (run) => new Date(run.started_at).toLocaleString(),
  },
]

const HISTORY_COMPARATORS = {
  started_at: (a, b) => new Date(a.started_at) - new Date(b.started_at),
  ex_correct: (a, b) => (a.ex_correct ?? -1) - (b.ex_correct ?? -1),
  soft_f1_avg: (a, b) => (a.soft_f1_avg ?? -1) - (b.soft_f1_avg ?? -1),
  duration_ms: (a, b) => (a.duration_ms ?? -1) - (b.duration_ms ?? -1),
}

export default function BatchHistoryPage({ onSelect }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listBatchRuns()
      .then(setHistory)
      .finally(() => setLoading(false))
  }, [])

  const { sortedData: sortedHistory, sortConfig } = useTableSortableState({
    data: history,
    defaultSort: [{ sortKey: 'started_at', direction: 'descending' }],
    comparators: HISTORY_COMPARATORS,
  })
  const sortPlugin = useTableSortable(sortConfig)

  if (loading) return <p className="muted">불러오는 중...</p>
  if (history.length === 0) return <p className="muted">아직 배치 실행 기록이 없습니다.</p>

  return (
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
                onClick: () => onSelect(item.id),
                style: { ...props.htmlProps?.style, cursor: 'pointer' },
              },
            }
          },
        },
      }}
    />
  )
}
