import { useEffect, useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { createBatchRun, listTestset } from '../api'

const DIFFICULTY_OPTIONS = ['simple', 'moderate', 'challenging']

export default function BatchRunPage({ onCreated }) {
  const [difficultyCounts, setDifficultyCounts] = useState({})
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
      })
      .catch(() => {})
  }, [])

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
  )
}
