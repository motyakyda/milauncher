import { create } from 'zustand'
import { readPref, writePref } from '../lib/prefs'

/*
 * ИИ (Милли) в лаунчере — отдельная опция в настройках.
 *
 * По умолчанию выключен: экосистема Millida (вход, каталог, Plus) убрана, а
 * без сессии Милли отвечает «Войди в аккаунт». Кто хочет — включает сам.
 */
export function aiOn(): boolean {
  return readPref('m-ai', '0') === '1'
}

interface AiState {
  on: boolean
  setAi: (v: boolean) => void
}

export const useAi = create<AiState>((set) => ({
  on: aiOn(),
  setAi: (v) => {
    writePref('m-ai', v ? '1' : '0')
    set({ on: v })
  },
}))
