import { useEffect, useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { createBatchRun, listTestset } from '../api'

const DIFFICULTY_ORDER = ['simple', 'moderate', 'challenging']
const DIFFICULTY_DOT_COLOR = {
  simple: 'var(--pass-text)',
  moderate: '#d97706',
  challenging: 'var(--fail-text)',
}

function DifficultyDot({ difficulty }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: DIFFICULTY_DOT_COLOR[difficulty],
      }}
    />
  )
}

export default function BatchRunPage({ onCreated }) {
  const [difficultyCounts, setDifficultyCounts] = useState({})
  const [totalCount, setTotalCount] = useState(0)
  const [selectedDifficulty, setSelectedDifficulty] = useState(null)
  const [label, setLabel] = useState('')
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState(null)

  useEffect(() => {
    listTestset()
      .then((questions) => {
        const counts = {}
        for (const q of questions) {
          counts[q.difficulty] = (counts[q.difficulty] || 0) + 1
        }
        setDifficultyCounts(counts)
        setTotalCount(questions.length)
      })
      .catch(() => {})
  }, [])

  const availableDifficulties = DIFFICULTY_ORDER.filter((d) => difficultyCounts[d])

  async function handleRun() {
    setStarting(true)
    setStartError(null)
    try {
      const body = { difficulty: selectedDifficulty, label: label.trim() || null }
      const created = await createBatchRun(body)
      onCreated(created.id)
    } catch (e) {
      setStartError(e.message)
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="batch-run-form">
      <input
        type="text"
        className="batch-label-input"
        placeholder="라벨 (선택, 예: prompt-v2)"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <div className="difficulty-filter" role="group" aria-label="실행 범위">
        <Button
          size="md"
          variant={selectedDifficulty == null ? 'primary' : 'secondary'}
          label={`전체 (${totalCount})`}
          onClick={() => setSelectedDifficulty(null)}
        />
        {availableDifficulties.map((d) => (
          <Button
            key={d}
            size="md"
            variant={selectedDifficulty === d ? 'primary' : 'secondary'}
            label={`${d} (${difficultyCounts[d]})`}
            icon={<DifficultyDot difficulty={d} />}
            onClick={() => setSelectedDifficulty(selectedDifficulty === d ? null : d)}
          />
        ))}
      </div>
      <Button
        variant="primary"
        label={starting ? '실행 중...' : '실행'}
        isDisabled={starting}
        onClick={handleRun}
        className="run-button"
      />
      {startError && <div className="cell-error">에러: {startError}</div>}
    </div>
  )
}
