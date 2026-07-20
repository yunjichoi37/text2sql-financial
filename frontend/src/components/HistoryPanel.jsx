import { useMemo, useState } from 'react'
import { Table, useTableSortableState, useTableSortable, proportional, pixel } from '@astryxdesign/core/Table'
import RunDetailDialog from './RunDetailDialog'
import VerdictBadge from './VerdictBadge'

function useClickableRowPlugin(onSelect) {
  return useMemo(
    () => ({
      transformBodyRow(props, item) {
        return {
          ...props,
          htmlProps: {
            ...props.htmlProps,
            onClick: () => onSelect(item),
            style: { ...props.htmlProps?.style, cursor: 'pointer' },
          },
        }
      },
    }),
    [onSelect]
  )
}

export default function HistoryPanel({ runs }) {
  const [selectedRun, setSelectedRun] = useState(null)

  const { sortedData, sortConfig } = useTableSortableState({
    data: runs,
    defaultSort: [{ sortKey: 'created_at', direction: 'descending' }],
    comparators: {
      created_at: (a, b) => new Date(a.created_at) - new Date(b.created_at),
      mode: (a, b) => (a.mode === 'testset' ? '테스트' : '직접 질문').localeCompare(
        b.mode === 'testset' ? '테스트' : '직접 질문'
      ),
      duration_ms: (a, b) => (a.duration_ms ?? -1) - (b.duration_ms ?? -1),
    },
  })
  const sortPlugin = useTableSortable(sortConfig)
  const clickableRowPlugin = useClickableRowPlugin(setSelectedRun)

  if (runs.length === 0) {
    return <p className="muted">아직 실행 기록이 없습니다.</p>
  }

  const columns = [
    {
      key: 'mode',
      header: '모드',
      sortable: true,
      width: pixel(96),
      align: 'center',
      renderCell: (c) => (
        <span className={`mode-tag mode-${c.mode}`}>
          {c.mode === 'testset' ? '테스트' : '직접 질문'}
        </span>
      ),
    },
    { key: 'question', header: '질문', sortable: true, width: proportional(3) },
    {
      key: 'difficulty',
      header: '난이도',
      sortable: true,
      width: pixel(85),
      align: 'center',
      renderCell: (c) => c.difficulty || '—',
    },
    {
      key: 'match_verdict',
      header: '결과',
      sortable: true,
      width: pixel(90),
      align: 'center',
      renderCell: (c) =>
        c.mode === 'testset' ? (
          <VerdictBadge verdict={c.match_verdict} softF1={c.soft_f1} />
        ) : (
          <span className="muted">—</span>
        ),
    },
    {
      key: 'duration_ms',
      header: '소요시간',
      sortable: true,
      width: pixel(80),
      align: 'center',
      renderCell: (c) =>
        typeof c.duration_ms === 'number' ? `${(c.duration_ms / 1000).toFixed(1)}s` : '—',
    },
    {
      key: 'created_at',
      header: '시각',
      sortable: true,
      width: proportional(1),
      renderCell: (c) => new Date(c.created_at).toLocaleString(),
    },
  ]

  return (
    <>
      <Table
        data={sortedData}
        columns={columns}
        idKey="id"
        density="compact"
        dividers="grid"
        hasHover
        plugins={{ sort: sortPlugin, click: clickableRowPlugin }}
      />
      <RunDetailDialog run={selectedRun} onClose={() => setSelectedRun(null)} />
    </>
  )
}
