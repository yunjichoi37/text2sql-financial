import { useEffect, useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { listTestset } from '../api'

const DIFFICULTY_ORDER = ['simple', 'moderate', 'challenging']
const DIFFICULTY_DOT_COLOR = {
  simple: 'var(--pass-text)',
  moderate: '#c2410c',
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

export default function TestsetPicker({ value, onChange }) {
  const [questions, setQuestions] = useState([])
  const [filter, setFilter] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listTestset()
      .then(setQuestions)
      .finally(() => setLoading(false))
  }, [])

  const availableDifficulties = DIFFICULTY_ORDER.filter((d) =>
    questions.some((q) => q.difficulty === d)
  )

  const filtered = questions.filter(
    (q) =>
      q.question.toLowerCase().includes(filter.toLowerCase()) &&
      (difficultyFilter === 'all' || q.difficulty === difficultyFilter)
  )

  return (
    <div className="testset-picker">
      <div className="search-input">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          type="text"
          placeholder="질문 검색..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      {!loading && availableDifficulties.length > 0 && (
        <div className="difficulty-filter" role="group" aria-label="난이도 필터">
          <Button
            size="sm"
            variant={difficultyFilter === 'all' ? 'primary' : 'secondary'}
            label="전체"
            onClick={() => setDifficultyFilter('all')}
          />
          {availableDifficulties.map((d) => (
            <Button
              key={d}
              size="sm"
              variant={difficultyFilter === d ? 'primary' : 'secondary'}
              label={d}
              icon={<DifficultyDot difficulty={d} />}
              onClick={() => setDifficultyFilter(difficultyFilter === d ? 'all' : d)}
            />
          ))}
        </div>
      )}
      {loading ? (
        <p className="muted">테스트셋 불러오는 중...</p>
      ) : (
        <div className="question-list" role="listbox">
          {filtered.map((q) => (
            <button
              key={q.question_id}
              type="button"
              role="option"
              aria-selected={value === q.question_id}
              className={value === q.question_id ? 'question-item active' : 'question-item'}
              onClick={() => onChange(q.question_id)}
            >
              <span className={`difficulty-chip difficulty-${q.difficulty}`}>{q.difficulty}</span>
              <span className="question-text">{q.question}</span>
            </button>
          ))}
          {filtered.length === 0 && <p className="muted">검색 결과가 없습니다.</p>}
        </div>
      )}
    </div>
  )
}
