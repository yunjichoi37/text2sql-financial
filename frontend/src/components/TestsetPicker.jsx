import { useEffect, useState } from 'react'
import { listTestset } from '../api'

export default function TestsetPicker({ value, onChange }) {
  const [questions, setQuestions] = useState([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listTestset()
      .then(setQuestions)
      .finally(() => setLoading(false))
  }, [])

  const filtered = questions.filter((q) =>
    q.question.toLowerCase().includes(filter.toLowerCase())
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
