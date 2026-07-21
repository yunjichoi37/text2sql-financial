import { useEffect, useRef, useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Table, pixel, proportional } from '@astryxdesign/core/Table'
import { createBatchRun, getBatchRun, listBatchRuns, listTestset } from '../api'
import BatchRunDetailDialog from './BatchRunDetailDialog'
import VerdictBadge from './VerdictBadge'

const DIFFICULTY_OPTIONS = ['simple', 'moderate', 'challenging']

const ITEM_COLUMNS = [
  { key: 'seq', header: '#', width: pixel(64), align: 'center' },
  { key: 'question', header: '질문', width: proportional(3) },
  {
    key: 'difficulty',
    header: '난이도',
    width: pixel(90),
    align: 'center',
    renderCell: (item) => item.difficulty || '—',
  },
  {
    key: 'match_verdict',
    header: '결과',
    width: pixel(90),
    align: 'center',
    renderCell: (item) => <VerdictBadge verdict={item.match_verdict} softF1={item.soft_f1} />,
  },
  {
    key: 'duration_ms',
    header: '소요시간',
    width: pixel(80),
    align: 'center',
    renderCell: (item) =>
      typeof item.duration_ms === 'number' ? `${(item.duration_ms / 1000).toFixed(1)}s` : '—',
  },
]

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
  const [activeBatch, setActiveBatch] = useState(null)
  const pollRef = useRef(null)

  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [selectedRun, setSelectedRun] = useState(null)

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
    if (tab === 'history') loadHistory()
  }, [tab])

  useEffect(() => {
    return () => clearInterval(pollRef.current)
  }, [])

  function stopPolling() {
    clearInterval(pollRef.current)
    pollRef.current = null
  }

  function pollBatch(id) {
    pollRef.current = setInterval(async () => {
      try {
        const detail = await getBatchRun(id)
        setActiveBatch(detail)
        if (detail.status !== 'running') {
          stopPolling()
          if (tab === 'history') loadHistory()
        }
      } catch {
        stopPolling()
      }
    }, 1500)
  }

  async function handleRun() {
    setStarting(true)
    setStartError(null)
    try {
      const body = { difficulty: selectedDifficulty, label: label.trim() || null }
      const created = await createBatchRun(body)
      const detail = await getBatchRun(created.id)
      setActiveBatch(detail)
      pollBatch(created.id)
    } catch (e) {
      setStartError(e.message)
    } finally {
      setStarting(false)
    }
  }

  const progressPct =
    activeBatch && activeBatch.total_count > 0
      ? Math.round((activeBatch.completed_count / activeBatch.total_count) * 100)
      : 0

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
        <div className="batch-run-tab">
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
              label={activeBatch?.status === 'running' ? '실행 중...' : '실행'}
              isDisabled={starting || activeBatch?.status === 'running'}
              onClick={handleRun}
              className="run-button"
            />
            {startError && <div className="cell-error">에러: {startError}</div>}
          </div>

          {activeBatch && (
            <div className="batch-progress-block">
              <div className="batch-progress-label">
                {activeBatch.status === 'running' ? (
                  <>
                    <span className="spinner" /> 진행 중 — {activeBatch.completed_count}/
                    {activeBatch.total_count}
                  </>
                ) : activeBatch.status === 'completed' ? (
                  `완료 — EX ${activeBatch.ex_correct}/${activeBatch.total_count}, Soft F1 평균 ${
                    activeBatch.soft_f1_avg != null ? Math.round(activeBatch.soft_f1_avg * 100) : 0
                  }%`
                ) : (
                  `실패: ${activeBatch.error || '알 수 없는 에러'}`
                )}
              </div>
              <div className="batch-progress-track">
                <div className="batch-progress-fill" style={{ width: `${progressPct}%` }} />
              </div>

              {activeBatch.items.length > 0 && (
                <Table
                  data={activeBatch.items.map((item, i) => ({ ...item, seq: i + 1 }))}
                  columns={ITEM_COLUMNS}
                  idKey="id"
                  density="compact"
                  dividers="grid"
                />
              )}
            </div>
          )}
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
                        onClick: () => getBatchRun(item.id).then(setSelectedRun),
                        style: { ...props.htmlProps?.style, cursor: 'pointer' },
                      },
                    }
                  },
                },
              }}
            />
          )}
          <BatchRunDetailDialog run={selectedRun} onClose={() => setSelectedRun(null)} />
        </div>
      )}
    </div>
  )
}
