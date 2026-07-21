import { useEffect, useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Table, pixel, proportional } from '@astryxdesign/core/Table'
import { createBatchRun, getBatchRun, listBatchRuns, listTestset } from '../api'
import BatchRunDetail from './BatchRunDetail'

const DIFFICULTY_OPTIONS = ['simple', 'moderate', 'challenging']

const HISTORY_COLUMNS = [
  {
    key: 'label',
    header: '라벨',
    width: proportional(2),
    renderCell: (run) => run.label || `배치 #${run.id}`,
  },
  { key: 'scope', header: '범위', width: pixel(120) },
  {
    key: 'status',
    header: '상태',
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
    width: pixel(90),
    align: 'center',
    renderCell: (run) =>
      run.ex_correct != null ? `${run.ex_correct}/${run.total_count}` : '—',
  },
  {
    key: 'soft_f1_avg',
    header: 'Soft F1',
    width: pixel(90),
    align: 'center',
    renderCell: (run) =>
      run.soft_f1_avg != null ? `${Math.round(run.soft_f1_avg * 100)}%` : '—',
  },
  {
    key: 'duration_ms',
    header: '소요시간',
    width: pixel(90),
    align: 'center',
    renderCell: (run) =>
      typeof run.duration_ms === 'number' ? `${(run.duration_ms / 1000).toFixed(1)}s` : '—',
  },
  {
    key: 'started_at',
    header: '시각',
    width: proportional(1),
    renderCell: (run) => new Date(run.started_at).toLocaleString(),
  },
]

export default function BatchTestPage() {
  const [tab, setTab] = useState('run')

  const [difficultyCounts, setDifficultyCounts] = useState({})
  const [selectedDifficulty, setSelectedDifficulty] = useState(null)
  const [label, setLabel] = useState('')
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState(null)

  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const [detailBatch, setDetailBatch] = useState(null)

  useEffect(() => {
    listTestset()
      .then((questions) => {
        const counts = {}
        for (const q of questions) {
          counts[q.difficulty] = (counts[q.difficulty] || 0) + 1
        }
        setDifficultyCounts(counts)
      })
      .catch(() => {})
  }, [])

  function loadHistory() {
    setHistoryLoading(true)
    listBatchRuns()
      .then(setHistory)
      .finally(() => setHistoryLoading(false))
  }

  useEffect(() => {
    if (tab === 'history' && !detailBatch) loadHistory()
    // detailBatch intentionally excluded: history should only reload when returning to the list, not on every poll tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

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

  async function handleRun() {
    setStarting(true)
    setStartError(null)
    try {
      const body = { difficulty: selectedDifficulty, label: label.trim() || null }
      const created = await createBatchRun(body)
      setDetailBatch(await getBatchRun(created.id))
    } catch (e) {
      setStartError(e.message)
    } finally {
      setStarting(false)
    }
  }

  async function openDetail(id) {
    setDetailBatch(await getBatchRun(id))
  }

  function handleBack() {
    setDetailBatch(null)
    setTab('history')
    loadHistory()
  }

  if (detailBatch) {
    return <BatchRunDetail run={detailBatch} onBack={handleBack} />
  }

  return (
    <div className="batch-page">
      <div className="batch-tabs">
        <Button
          size="sm"
          variant={tab === 'run' ? 'primary' : 'secondary'}
          label="새 실행"
          onClick={() => setTab('run')}
        />
        <Button
          size="sm"
          variant={tab === 'history' ? 'primary' : 'secondary'}
          label="지난 실행"
          onClick={() => setTab('history')}
        />
      </div>

      {tab === 'run' && (
        <div className="batch-run-form">
          <div className="difficulty-filter" role="group" aria-label="실행 범위">
            <Button
              size="sm"
              variant={selectedDifficulty == null ? 'primary' : 'secondary'}
              label="전체"
              onClick={() => setSelectedDifficulty(null)}
            />
            {DIFFICULTY_OPTIONS.filter((d) => difficultyCounts[d]).map((d) => (
              <Button
                key={d}
                size="sm"
                variant={selectedDifficulty === d ? 'primary' : 'secondary'}
                label={`${d} (${difficultyCounts[d]})`}
                onClick={() => setSelectedDifficulty(d)}
              />
            ))}
          </div>
          <input
            type="text"
            className="batch-label-input"
            placeholder="라벨 (선택, 예: prompt-v2)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Button
            variant="primary"
            label={starting ? '실행 중...' : '실행'}
            isDisabled={starting}
            onClick={handleRun}
            className="run-button"
          />
          {startError && <div className="cell-error">에러: {startError}</div>}
        </div>
      )}

      {tab === 'history' && (
        <div className="batch-history-tab">
          {historyLoading && <p className="muted">불러오는 중...</p>}
          {!historyLoading && history.length === 0 && (
            <p className="muted">아직 배치 실행 기록이 없습니다.</p>
          )}
          {!historyLoading && history.length > 0 && (
            <Table
              data={history}
              columns={HISTORY_COLUMNS}
              idKey="id"
              density="compact"
              dividers="grid"
              hasHover
              plugins={{
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
      )}
    </div>
  )
}
