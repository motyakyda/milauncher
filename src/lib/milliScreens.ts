import type { ScreenId } from '../state/ui'

/*
 * Где живёт Милли: в библиотеке хаба (экран `playhub`) — каталога Millida
 * больше нет, поэтому панель не привязана к вкладке «Ресурсы». На остальных
 * экранах в углу обычная кнопка поддержки. Открытая страница сборки лежит
 * поверх экрана — там тоже поддержка.
 */
export function isMilliScreen(screen: ScreenId, _hubAll: boolean, buildOpen = false): boolean {
  if (buildOpen) return false
  return screen === 'playhub' || screen === 'mods'
}
