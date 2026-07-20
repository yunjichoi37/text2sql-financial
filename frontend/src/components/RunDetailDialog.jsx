import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { Layout, LayoutContent } from '@astryxdesign/core/Layout'
import CellResultBody from './CellResultBody'
import VerdictBadge from './VerdictBadge'

export default function RunDetailDialog({ run, onClose }) {
  return (
    <Dialog
      isOpen={run != null}
      onOpenChange={(open) => !open && onClose()}
      variant="standard"
      width={880}
      maxHeight="85vh"
      padding={6}
      purpose="info"
    >
      <Layout
        header={
          <DialogHeader
            title={run?.question ?? ''}
            subtitle={run ? new Date(run.created_at).toLocaleString() : undefined}
            onOpenChange={(open) => !open && onClose()}
          />
        }
        content={
          <LayoutContent isScrollable={false}>
            {run && (
              <div className="run-detail-scroll">
                <div className="run-detail-meta">
                  <span className={`mode-tag mode-${run.mode}`}>
                    {run.mode === 'testset' ? '테스트' : '직접 질문'}
                  </span>
                  {run.difficulty && <span className="difficulty-tag">{run.difficulty}</span>}
                  {typeof run.duration_ms === 'number' && (
                    <span className="duration-tag">{(run.duration_ms / 1000).toFixed(1)}s</span>
                  )}
                  {run.mode === 'testset' && <VerdictBadge verdict={run.match_verdict} />}
                </div>
                <CellResultBody
                  error={run.error}
                  aiSql={run.ai_sql}
                  aiAnswer={run.ai_answer}
                  aiResult={run.ai_result}
                  mode={run.mode}
                  goldSql={run.gold_sql}
                  goldResult={run.gold_result}
                />
              </div>
            )}
          </LayoutContent>
        }
      />
    </Dialog>
  )
}
