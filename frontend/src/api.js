// src/api.js : 백엔드 REST API 래퍼

async function handle(res) {
  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const message = data?.detail ? JSON.stringify(data.detail) : `HTTP ${res.status}`
    throw new Error(message)
  }
  return data
}

export function listCells(mode) {
  const query = mode ? `?mode=${mode}` : ''
  return fetch(`/api/cells${query}`).then(handle)
}

export function createCell(body) {
  return fetch('/api/cells', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(handle)
}

export function updateCell(id, body) {
  return fetch(`/api/cells/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(handle)
}

export function deleteCell(id) {
  return fetch(`/api/cells/${id}`, { method: 'DELETE' }).then(handle)
}

export function listCellRuns() {
  return fetch('/api/cell-runs').then(handle)
}

export function listTestset() {
  return fetch('/api/testset').then(handle)
}

export function listTables() {
  return fetch('/api/tables').then(handle)
}

export function createBatchRun(body) {
  return fetch('/api/batch-runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(handle)
}

export function listBatchRuns() {
  return fetch('/api/batch-runs').then(handle)
}

export function getBatchRun(id) {
  return fetch(`/api/batch-runs/${id}`).then(handle)
}

export function updateBatchRunLabel(id, label) {
  return fetch(`/api/batch-runs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label }),
  }).then(handle)
}

export function getTableRows(tableName, page, pageSize) {
  return fetch(`/api/tables/${tableName}/rows?page=${page}&page_size=${pageSize}`).then(handle)
}
