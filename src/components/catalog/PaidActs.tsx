import type { ReactNode } from 'react'
import { Icon } from '../Icon'
import { pickTargetName } from '../../lib/installKeys'
import { useInstalls } from '../../state/installs'
import { useMods } from '../../state/mods'
import { useProfiles } from '../../state/profiles'
import { isPaid } from './paid'
import { MILLIDA_KINDS, installMillidaItem, millidaKey, millidaPid } from './millidaInstall'
import type { SiteCard, SiteSection } from './site'
import { displayName } from './site'

/*
 * Своя вещь каталога Millida в строке ленты: «В сборку» / «Установить».
 * Покупка и цены из лаунчера убраны.
 */

/** Своя вещь Millida без источника на Modrinth: ставится файлом каталога. */
export function NativeBar({ card, sec, extra }: { card: SiteCard; sec: SiteSection; extra?: ReactNode }) {
  const scoped = useMods((s) => s.targetBuild)
  const profiles = useProfiles((s) => s.profiles)
  const selected = useProfiles((s) => s.selected)
  const installed = useMods((s) => s.installedIds.has(millidaPid(card.slug)))
  const target = pickTargetName(scoped, profiles.map((x) => x.name), selected || '')
  const task = useInstalls((s) => s.tasks[millidaKey(target, sec.kind, card.slug)])
  const doneKey = useInstalls((s) => !!s.done[millidaKey(target, sec.kind, card.slug)])
  const running = !!task && task.state === 'run'
  const done = installed || doneKey
  const content = sec.kind !== 'world'
  const label = running ? (task!.pct > 0 ? task!.label + ' ' + Math.round(task!.pct) + '%' : task!.label) : done ? 'Установлено' : content ? 'В сборку' : 'Установить'
  return (
    <div className="mr-actions">
      {extra}
      <button
        className={'btn sm ' + (done ? 'secondary done' : 'primary')}
        data-track={done ? 'installed' : 'install_millida'}
        disabled={running}
        onClick={(e) => {
          e.stopPropagation()
          if (done) return
          void installMillidaItem({ slug: card.slug, title: displayName(card.title), kind: sec.kind, paid: isPaid(card.pricing, card.priceKopecks) })
        }}
      >
        {content && !done && !running ? <Icon id="i-plus" /> : null}
        {label}
      </button>
    </div>
  )
}

export const nativeKind = (sec: SiteSection): boolean => MILLIDA_KINDS.has(sec.kind)
