import { Badge } from '@astryxdesign/core/Badge'
import { Icon } from '@astryxdesign/core/Icon'

const badgeStyle = { verticalAlign: 'middle' }

export default function VerdictBadge({ verdict }) {
  if (verdict === true) {
    return <Badge variant="success" icon={<Icon icon="success" />} label="일치" style={badgeStyle} />
  }
  if (verdict === false) {
    return <Badge variant="error" icon={<Icon icon="error" />} label="불일치" style={badgeStyle} />
  }
  return <Badge variant="neutral" label="미계산" style={badgeStyle} />
}
