import { describe, expect, it } from 'bun:test'
import { isMilliScreen } from './milliScreens'
import type { ScreenId } from '../state/ui'

/*
 * Милли — в библиотеке хаба, на остальных экранах в углу поддержка.
 * Каталога Millida больше нет, поэтому вкладка «Ресурсы» не участвует.
 */
describe('isMilliScreen', () => {
  it('библиотека хаба — Милли', () => {
    expect(isMilliScreen('playhub', false)).toBe(true)
    expect(isMilliScreen('playhub', true)).toBe(true)
  })

  it('старый экран каталога — Милли', () => {
    expect(isMilliScreen('mods', false)).toBe(true)
    expect(isMilliScreen('mods', true)).toBe(true)
  })

  const support: ScreenId[] = ['play', 'premium', 'plus', 'builds', 'servers', 'skins', 'rubies', 'friends', 'chat', 'hosting', 'game', 'settings']
  for (const s of support) {
    it(`${s} — поддержка`, () => {
      expect(isMilliScreen(s, true)).toBe(false)
      expect(isMilliScreen(s, false)).toBe(false)
    })
  }

  it('страница сборки поверх хаба — поддержка', () => {
    expect(isMilliScreen('playhub', true, true)).toBe(false)
    expect(isMilliScreen('mods', false, true)).toBe(false)
  })
})
