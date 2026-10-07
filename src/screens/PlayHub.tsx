import { useTopBar } from '../state/topbar'
import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { blockFor, serverTint } from '../components/catalog/itemView'
import type { ReactNode } from 'react'
import { Icon } from '../components/Icon'
import { noteVisitKind, noteVisitSection } from '../lib/recsSignals'
import { sectionBySlug } from '../components/catalog/site'
import { openItem } from '../components/catalog/itemStore'
import { HubFind } from '../components/playhub/HubFind'
import { fmtN, plural } from '../lib/format'
import { buildsShelf } from '../lib/buildsShelf'
import { openModal, setScreen } from '../state/ui'
import { useProfiles } from '../state/profiles'
import { premiumMode, sameMode, serverMode, useLobby } from '../state/lobbyMode'
import type { LobbyMode } from '../state/lobbyMode'
import { packFromCatalog } from '../lib/premium'
import { playMode } from '../lib/lobbyPlay'
import type { MillidaPack } from '../ipc/commands'
import type { SnapshotServer } from '../lib/snapshot'
import {
  blockArt,
  loadCatalogPacks,
  loadModrinthPacks,
  loadPackServer,
  playVersions,
  versionCover,
} from '../components/playhub/data'
import type { HubPack, ServerModeDef } from '../components/playhub/data'

import { PackPage } from '../components/playhub/PackPage'
import { MyBuildCard, useMyBuilds } from '../components/playhub/MyBuilds'
import { ServerFeed } from '../components/playhub/ServerFeed'
import { useHubTab } from '../components/playhub/hubTab'
import { GAMES, gameHero, useGame } from '../lib/games'
import '../styles/pixel/game.css'
import type { HubSection } from '../components/playhub/hubTab'
import { useMods } from '../state/mods'
import { PlayTogether } from '../components/playhub/PlayTogether'
import { CatalogPane } from './Mods'
import { ONEBLOCK_PACK, ownServerMode, targetsOwnServer } from '../lib/ownServer'
import '../styles/pixel/playhub.css'

/**
 * «Во что играем», версия 6 (владелец 30.09.2026, 15:06 — те же блоки и
 * порядок, что у главной millida.net/katalog): «Мои сборки» обычными
 * карточками с обложкой (нет сборок — полка версий Minecraft) → «Категории»
 * маленькими кнопками → «Рекомендуем» в четыре ряда (хостинг, эксклюзивы,
 * OneBlock, лента) → «Режимы» (значки в стиле Blups, баннер OneBlock) →
 * «Играть вдвоём» → «Другие игры» → «Серверы».
 * «Новая сборка» и «Импорт» — в верхней полосе хаба (PlayhubBar).
 * «Продолжить» здесь нет: продолжение — кнопка «Играть» в лобби.
 */

/** Картинка карточки. Не загрузилась (зеркало CDN не ответило) — прячем, а не рисуем «битую» иконку. */
/**
 * Картинка сервера с запасом (владелец 30.09.2026: «у серверов нет значков»):
 * нет логотипа или он не загрузился — блок Minecraft на цвете от имени сервера,
 * тот же у сервера при каждом заходе. Пустой квадрат больше не показывается.
 */
function SrvArt({ src, name, className, tint }: { src?: string | null; name: string; className: string; tint?: string }) {
  const [bad, setBad] = useState(false)
  useEffect(() => setBad(false), [src])
  if (src && !bad)
    return (
      <span className={className}>
        <img src={src} alt="" loading="lazy" draggable={false} onError={() => setBad(true)} />
      </span>
    )
  return (
    <span className={className + ' is-art'} style={{ backgroundColor: tint || serverTint(name) }}>
      <img className="ph-srv-block" src={blockArt(blockFor(name))} alt="" draggable={false} />
    </span>
  )
}

const img = (src: string | null | undefined) =>
  src ? (
    <img
      src={src}
      alt=""
      loading="lazy"
      draggable={false}
      onError={(e) => {
        e.currentTarget.style.visibility = 'hidden'
      }}
    />
  ) : null

function Players({ n, approx }: { n: number; approx?: boolean }) {
  return (
    <>
      <span className="ph-dot" aria-hidden="true"></span>
      {(approx ? '~' : '') + fmtN(n)}
    </>
  )
}

const verKey = (v: string) => v.split('.').map((x) => Number(x) || 0).reduce((acc, n) => acc * 1000 + n, 0)
/** «1.8–1.21»: от младшей к старшей, как бы рейтинг их ни упорядочил. */
function versionSpan(list: string[]): string {
  if (!list.length) return ''
  const sorted = [...list].sort((a, b) => verKey(a) - verKey(b))
  const lo = sorted[0]!
  const hi = sorted[sorted.length - 1]!
  return lo === hi ? lo : lo + '–' + hi
}

function AllServers({ current, onPick }: { current: LobbyMode | null; onPick: (s: SnapshotServer) => void }) {
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => {
    const t = window.setTimeout(() => setSearch(q.trim().length >= 2 ? q.trim() : ''), 300)
    return () => window.clearTimeout(t)
  }, [q])
  return (
    <div className="ph-mode ph-allsrv" data-section="servers">
      <h1 className="ph-allsrv-h">Серверы Minecraft</h1>
      <label className="input hs-field ph-mode-find">
        <Icon id="i-search" />
        <input value={q} placeholder="Имя или адрес сервера" maxLength={60} onChange={(e) => setQ(e.target.value)} />
        {q ? (
          <button type="button" className="hs-clear" aria-label="Очистить" onClick={() => setQ('')}>
            <Icon id="i-x" />
          </button>
        ) : null}
      </label>
      <ServerFeed search={search} render={(s, i) => <ServerRow s={s} pos={i} current={current} onPlay={onPick} />} />
    </div>
  )
}

function ServerRow({
  s,
  def,
  pos,
  current,
  onPlay,
}: {
  s: SnapshotServer
  def?: ServerModeDef
  pos?: number
  current: LobbyMode | null
  onPlay: (s: SnapshotServer) => void
}) {
  const on = sameMode(current, serverMode(s))
  return (
    <div
      className={'ph-srv' + (on ? ' on' : '') + (s.isOnline ? '' : ' off')}
      data-kind="server"
      data-id={s.slug || s.ip}
      data-pos={pos}
      data-src={def ? 'mode' : 'hub_card'}
    >
      <SrvArt className="ph-srv-logo" src={s.logo} name={s.slug || s.name || s.ip} />
      <SrvArt className="ph-srv-ban" src={s.banner} name={s.slug || s.name || s.ip} tint={def ? def.color : undefined} />
      <span className="ph-srv-body">
        <b>{s.name}</b>
        <span className="ph-srv-meta">
          {versionSpan(s.versions) ? <span>{versionSpan(s.versions)}</span> : null}
          {s.lic === 'CRACKED' ? <span>Без лицензии</span> : s.lic ? <span>Лицензия</span> : null}
        </span>
      </span>
      <span className="ph-srv-online">{s.isOnline ? <Players n={s.online} approx={s.onlineApprox} /> : 'офлайн'}</span>
      <button className="btn md primary" data-track="play" onClick={() => onPlay(s)}>
        <Icon id="i-play" /> Играть
      </button>
    </div>
  )
}

const isArcania = (p: HubPack) => /arcania/i.test(p.slug || p.title)

export function PlayHub({ on }: { on?: boolean }) {
  const current = useLobby((s) => s.picked)
  const pick = useLobby((s) => s.pick)
  const premium = useLobby((s) => s.premium)
  const loadLobby = useLobby((s) => s.load)
  const profiles = useProfiles((s) => s.profiles)

  const [packs, setPacks] = useState<MillidaPack[] | null>(null)
  const [mrPacks, setMrPacks] = useState<HubPack[] | null>(null)
  const [allBuilds, setAllBuilds] = useState(false)
  /** Сборка на своей странице. */
  const [pageId, setPageId] = useState<string | null>(null)
  const [packServer, setPackServer] = useState<SnapshotServer | null>(null)
  /** Страница «Все сборки» (полный каталог) поверх хаба. */
  const all = useHubTab((s) => s.all)
  const setAll = useHubTab((s) => s.setAll)
  const section = useHubTab((s) => s.section)
  // Ушли с экрана — следующий заход снова сверху. Layout-эффект: его
  // очистка идёт раньше, чем `Mods` при переходе `setScreen('mods')` успеет
  // выставить вкладку, — обычный useEffect затирал бы её.
  useLayoutEffect(() => () => useHubTab.getState().reset(), [])
  const mine = useMyBuilds(profiles)
  const shelf = buildsShelf(mine, current && current.kind === 'build' ? current.name : null, allBuilds)

  useEffect(() => {
    void loadLobby()
    let alive = true
    void loadCatalogPacks().then((l) => alive && setPacks(l))
    void loadModrinthPacks().then((l) => alive && setMrPacks(l))
    return () => {
      alive = false
    }
  }, [])

  const top0 = () => document.getElementById('s-playhub')?.scrollIntoView({ block: 'start' })

  // Подстраница открыта — верхняя «← Лобби» становится «← Назад» (правка
  // владельца 22:38), своих кнопок «Назад» на подстраницах больше нет.
  const setBack = useTopBar((st) => st.setBack)
  useEffect(() => {
    // «Каталог Millida» — вкладка переключателя, а не подстраница: наверху
    // остаётся «Лобби» (владелец 24.09.2026, 16:52).
    if (on === false || !pageId) {
      setBack(null)
      return
    }
    setBack(() => setPageId(null))
    return () => setBack(null)
  }, [on, pageId])

  /** «Играть» на этом экране — сразу запуск, как и ждёт человек от этой кнопки. */
  const launch = (m: LobbyMode) => {
    const target = targetsOwnServer(m) ? ownMode : m
    pick(target)
    setScreen('play')
    void playMode(target, profiles)
  }

  // Платная сборка каталога и она же в премиуме — одна карточка, Arcania первой.
  const premiumPacks = useMemo<HubPack[]>(() => {
    const seen = new Set<string>()
    const out: HubPack[] = []
    for (const p of premium) {
      seen.add(p.slug || p.id)
      out.push({ ...p, premium: true, origin: 'millida' })
    }
    for (const c of packs || [])
      if (c.accessRequired && !seen.has(c.slug)) out.push({ ...packFromCatalog(c), premium: true, origin: 'millida' })
    return [...out.filter(isArcania), ...out.filter((p) => !isArcania(p))]
  }, [premium, packs])

  // Наши сборки каталога Millida целиком плюс реальный каталог Modrinth.
  const catalogPacks = useMemo<HubPack[]>(() => {
    const ours = (packs || [])
      .filter((c) => !c.accessRequired)
      .map((c): HubPack => ({ ...packFromCatalog(c), premium: false, origin: 'millida', preview: !!c.preview }))
    return [...ours, ...(mrPacks || [])]
  }, [packs, mrPacks])

  const obPack = catalogPacks.find((p) => p.slug === ONEBLOCK_PACK) || premiumPacks.find((p) => p.slug === ONEBLOCK_PACK) || null
  const ownMode = obPack ? premiumMode(obPack) : ownServerMode()

  // Витрина раздела «Сборки» каталога: Arcania первой, дальше все сборки —
  // платные и бесплатные вперемешку, от самых скачиваемых. Без переключателей
  // «Платные/Сливы» — они режут конверсию (владелец 24.09, 11:28).
  const allPacks = useMemo<HubPack[]>(() => {
    const dl = new Map((packs || []).map((c) => [c.slug, c.downloads] as const))
    const paid = premiumPacks.map((p) => (p.downloads == null && p.slug && dl.has(p.slug) ? { ...p, downloads: dl.get(p.slug) ?? null } : p))
    const rest = [...paid, ...catalogPacks].sort((a, b) => (b.downloads || 0) - (a.downloads || 0))
    const arc = rest.find(isArcania)
    return arc ? [arc, ...rest.filter((p) => p !== arc)] : rest
  }, [premiumPacks, catalogPacks, packs])

  const page: HubPack | null = pageId
    ? premiumPacks.find((p) => p.id === pageId) || catalogPacks.find((p) => p.id === pageId) || null
    : null

  useEffect(() => {
    setPackServer(null)
    if (!page) return
    let alive = true
    void loadPackServer(page.title).then((s) => alive && setPackServer(s))
    return () => {
      alive = false
    }
  }, [page && page.id])

  const wrap = (child: ReactNode) => (
    <section className={'screen playhub' + (on ? ' on' : '')} id="s-playhub">
      {child}
    </section>
  )

  // Пришли из «Рекомендуем» в лобби: сборка — её страница, режим — его
  // серверы; «Назад» ведёт на главную хаба.
  const hubTarget = useLobby((s) => s.hubTarget)
  useEffect(() => {
    if (!hubTarget || !hubTarget.pack) return
    setAll(false)
    const p = allPacks.find((x) => x.slug === hubTarget.pack)
    if (!p) return
    setPageId(p.id)
    useLobby.setState({ hubTarget: null })
  }, [hubTarget, allPacks])
  // Вход снаружи к разделу (openHubTab('modes'), openHubTab('builds')) — прокрутка к нему.
  useEffect(() => {
    if (!section || all || pageId) return
    // «Мой сервер» и «Arcania Labs» теперь карточки «Для тебя».
    const id = section === 'server' || section === 'try' ? 'foryou' : section
    requestAnimationFrame(() => document.getElementById('hub-sec-' + id)?.scrollIntoView({ block: 'start' }))
    useHubTab.setState({ section: null })
  }, [section, all, pageId])

  if (page)
    return wrap(
      <PackPage
        key={page.id}
        pack={page}
        server={packServer}
        onBack={() => setPageId(null)}
        onPlay={(build) => launch(page.origin === 'millida' ? premiumMode(page) : { kind: 'build', name: build })}
        onServer={(s) => launch(serverMode(s))}
      />,
    )

  const openPack = (p: HubPack) => {
    setPageId(p.id)
    top0()
  }
  // «Сборки»: одна строка самых популярных (6 на 1200, 4 на 900 — лишние
  // прячет CSS), «Все» в шапке — полный каталог. Arcania из «Для тебя»
  // второй раз не ставим.
  /** Раздел каталога целиком — страница раздела, как на millida.net. */
  const openSection = (kind: string, mq = '') => {
    noteVisitKind(kind)
    useMods.getState().set({ modTab: kind, mq, fCats: [], fCat: 'все', fVer: 'любая', fLoader: 'любой', count: '' })
    useHubTab.setState((st) => ({ seq: st.seq + 1 }))
    setAll(true)
    top0()
  }

  const head = (id: HubSection, title: string | null, body: ReactNode, more?: ReactNode) => (
    <section key={id} className="hub-sec" id={'hub-sec-' + id}>
      {title ? (
        <div className="ph-shelf-head">
          <h2>{title}</h2>
          {more}
        </div>
      ) : null}
      {body}
    </section>
  )

  // Страница «Все сборки»: полный каталог — поиск, фильтры, моды, карты.
  // Своя сборка каталога (MCSborki, Arcania) — её страница хаба с «Играть».
  const openPackSlug = (slug: string): boolean => {
    const p = allPacks.find((x) => x.slug === slug)
    if (p) openPack(p)
    return !!p
  }
  // Переключатель «Во что играем | Каталог Millida» (владелец 24.09.2026,
  // 16:20): во второй вкладке — весь каталог как на millida.net.
  if (all)
    return wrap(
      <>
        <CatalogPane
          onOpenPack={openPackSlug}
          servers={<AllServers current={current} onPick={(x) => launch(serverMode(x))} />}
        />
      </>,
    )

  return wrap(
    <div className="hub-pane">
      {/* Первый экран (владелец 30.09.2026), как на millida.net/katalog: поле,
          крупная «Найти» и «Собрать с ИИ». Текст поля — запрос каталога или
          просьба к Милли. */}
      <HubFind />
      {/* 1. Свои сборки обычными карточками с обложкой; нет сборок — полка
          версий Minecraft, как было. */}
      {mine.length
        ? head(
            'builds',
            'Мои сборки',
            <div className="hub-grid" data-section="my_builds" data-src="hub_card" data-private>
              {shelf.shown.map((p, i) => (
                <MyBuildCard
                  key={p.name}
                  p={p}
                  pos={i}
                  on={!!current && current.kind === 'build' && current.name === p.name}
                  onPick={() => {
                    // Клик — выбрать и в лобби к «Играть»; редактирование —
                    // карандаш при наведении (владелец 24.09.2026, 19:08).
                    pick({ kind: 'build', name: p.name })
                    setScreen('play')
                  }}
                />
              ))}
              {/* «Все версии» — новая сборка с выбором версии Minecraft (17:31). */}
              <button className="ph-card ph-allver" data-sound="open" data-track="all_versions" onClick={() => openModal('nbModal')}>
                <span className="ph-card-art ph-allver-art">
                  <Icon id="i-plus" />
                </span>
                <span className="ph-card-body">
                  <b>Все версии</b>
                  <span className="ph-card-meta">Новая сборка</span>
                </span>
              </button>
              {/* Same skeleton as the shelf's action tiles, so the toggle is exactly as tall as a build card. */}
              {shelf.toggle ? (
                <button
                  className="ph-card act"
                  data-sound="nav"
                  data-track={allBuilds ? 'builds_less' : 'builds_more'}
                  aria-expanded={allBuilds}
                  onClick={() => setAllBuilds((v) => !v)}
                >
                  <span className="ph-card-art ph-mine-art">
                    <span className="ph-act-ic">
                      <Icon id={allBuilds ? 'i-chev-u' : 'i-grid'} />
                    </span>
                  </span>
                  <span className="ph-card-body">
                    <b>{allBuilds ? 'Свернуть' : 'Показать ещё'}</b>
                    <span className="ph-card-meta">
                      {(allBuilds ? mine.length : shelf.hidden) + ' ' + plural(allBuilds ? mine.length : shelf.hidden, 'сборка', 'сборки', 'сборок')}
                    </span>
                  </span>
                </button>
              ) : null}
            </div>,
          )
        : head(
            'builds',
            'Minecraft',
            <div className="hub-grid one" data-section="versions" data-src="hub_card">
              {playVersions().map((v, i) => (
                <button
                  key={v}
                  className={'ph-card' + (sameMode(current, { kind: 'version', version: v }) ? ' on' : '')}
                  data-sound="nav"
                  data-kind="version"
                  data-id={v}
                  data-pos={i}
                  onClick={() => {
                    pick({ kind: 'version', version: v })
                    setScreen('play')
                  }}
                >
                  <span className="ph-card-art">
                    {img(versionCover(v, i))}
                    <span className="ph-ver">{v}</span>
                  </span>
                  <span className="ph-card-body">
                    <b>{'Minecraft ' + v}</b>
                    <span className="ph-card-meta">Fabric + Boost FPS</span>
                  </span>
                </button>
              ))}
            </div>,
          )}
      {/* Полка «Сборки» убрана: каталог — во вкладке «Ресурсы» (17:31). */}
      {/* Играть вдвоём — сборки и карты «С другом» из разных тем, как на сайте. */}
      {head(
        'together',
        'Играть вдвоём',
        <PlayTogether
          onPack={(slug, title) => {
            if (!openPackSlug(slug)) openSection('modpack', title)
          }}
          onMap={(title) => openSection('world', title)}
          // Клик — страница самой вещи, как в «Рекомендуем»; наша сборка — её страница хаба.
          onItem={(section, card) => {
            if (section === 'modpacks' && openPackSlug(card.slug)) return
            noteVisitSection(section)
            openSection(sectionBySlug(section).kind)
            requestAnimationFrame(() => openItem({ kind: 'card', section, card }))
          }}
        />,
      )}
      {/* Игры Minecraft — такими же карточками, как сборки; клик открывает экран игры (владелец 29.09.2026). */}
      {head(
        'games',
        'Другие игры',
        <div className="hub-grid" data-section="games" data-src="hub_card">
          {GAMES.map((g, i) => (
            <button
              key={g.slug}
              className="ph-card"
              data-sound="open"
              data-track="open_game"
              data-id={g.slug}
              data-pos={i}
              onClick={() => {
                useGame.getState().open(g.slug)
                setScreen('game')
              }}
            >
              <span className="ph-card-art">
                {img(gameHero(g.slug))}
                {g.isNew ? <span className="gm-new gm-new-card">Новинка</span> : null}
              </span>
              <span className="ph-card-body">
                <b>{g.name}</b>
                <span className="ph-card-meta">{g.meta}</span>
              </span>
            </button>
          ))}
        </div>,
      )}
      {/* Под режимами — вся лента серверов Millida (владелец 24.09.2026, 18:29). */}
      {head('servers', 'Серверы', <AllServers current={current} onPick={(x) => launch(serverMode(x))} />)}
      {/* «Зайти на сервер» и «Недавние» убраны из библиотеки (17:50). */}
    </div>,
  )
}
