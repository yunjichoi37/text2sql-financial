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
      <input
        type="text"
        placeholder="질문 검색..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      {loading ? (
        <p className="muted">테스트셋 불러오는 중...</p>
      ) : (
        <select
          size={6}
          value={value ?? ''}
          onChange={(e) => onChange(Number(e.target.value))}
        >
          {filtered.map((q) => (
            <option key={q.question_id} value={q.question_id}>
              [{q.difficulty}] {q.question}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
