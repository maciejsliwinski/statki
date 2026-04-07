import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Board, { type CellState } from './components/Board'
import ShipPanel from './components/ShipPanel'
import Lobby, { type GameContext } from './components/Lobby'
import { supabase } from './lib/supabase'
import { SHIP_DEFS, getShipCells, isValidPlacement, findShips, type Orientation } from './store/ships'

const TOTAL_SHIPS = SHIP_DEFS.reduce((sum, s) => sum + s.total, 0)  // 5

// ----------------------------------------------------------------
// Pomocniki
// ----------------------------------------------------------------

function createEmptyGrid(): CellState[][] {
  return Array.from({ length: 10 }, () => Array(10).fill('empty') as CellState[])
}

type PlacedShip   = { id: string; size: number; row: number; col: number; orientation: Orientation }
type SelectedShip = { id: string; size: number; orientation: Orientation }
type Screen       = 'lobby' | 'placing' | 'playing'

// Aktywna animacja torpedy — jeden egzemplarz na strzał
type TorpedoAnim = {
  id: number
  fromX: number      // px na ekranie (centrum łodzi)
  fromY: number
  angle: number      // stopnie: atan2(dy, dx)
  distance: number   // px do celu
}

type Shot = {
  id: string
  shooter: 'host' | 'guest'
  row: number
  col: number
  result: 'hit' | 'miss'
  created_at: string
}

// ----------------------------------------------------------------
// Łódź podwodna (SVG, domyślnie dziobem w prawo)
// ----------------------------------------------------------------

function SubmarineSvg() {
  return (
    <svg width="120" height="64" viewBox="0 0 140 70" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Kadłub */}
      <path
        d="M20,38 Q18,22 34,22 L108,22 Q124,22 126,36 Q128,50 112,52 L34,52 Q18,52 20,42 Z"
        fill="#4B5563"
      />
      {/* Nos */}
      <ellipse cx="122" cy="37" rx="11" ry="14" fill="#374151" />
      {/* Rufa */}
      <ellipse cx="20" cy="37" rx="11" ry="13" fill="#374151" />
      {/* Kiosk */}
      <rect x="56" y="8" width="30" height="17" rx="6" fill="#374151" />
      {/* Peryskop */}
      <rect x="67" y="0" width="5" height="10" rx="2" fill="#4B5563" />
      <rect x="61" y="0" width="16" height="5" rx="2" fill="#4B5563" />
      {/* Śmigła (góra + dół) */}
      <ellipse cx="14" cy="29" rx="4" ry="10" fill="#6B7280"
        transform="rotate(-20 14 29)" />
      <ellipse cx="14" cy="47" rx="4" ry="10" fill="#6B7280"
        transform="rotate(20 14 47)" />
      {/* Piasta śmigła */}
      <circle cx="14" cy="37" r="5" fill="#4B5563" />
      {/* Iluminatory */}
      <circle cx="95" cy="37" r="7" fill="#1F2937" stroke="#6B7280" strokeWidth="2" />
      <circle cx="78" cy="37" r="5" fill="#1F2937" stroke="#6B7280" strokeWidth="1.5" />
    </svg>
  )
}

// ----------------------------------------------------------------
// Torpeda (SVG, leci w prawo)
// ----------------------------------------------------------------

function TorpedoSvg() {
  return (
    <svg width="52" height="16" viewBox="0 0 52 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Kadłub */}
      <ellipse cx="24" cy="8" rx="20" ry="5" fill="#9CA3AF" />
      {/* Głowica */}
      <path d="M42,4 L51,8 L42,12 Z" fill="#6B7280" />
      {/* Płetwy ogonowe */}
      <path d="M6,3 L2,8 L6,13 L9,8 Z" fill="#6B7280" />
      {/* Śruba napędowa */}
      <ellipse cx="4" cy="4" rx="2.5" ry="5" fill="#4B5563" opacity="0.9"
        transform="rotate(-10 4 4)" />
      <ellipse cx="4" cy="12" rx="2.5" ry="5" fill="#4B5563" opacity="0.9"
        transform="rotate(10 4 12)" />
    </svg>
  )
}

// ================================================================
// Ekran rozmieszczania statków
// ================================================================

function PlacingScreen({ ctx, onGameStart }: { ctx: GameContext; onGameStart: () => void }) {
  const [placedShips, setPlacedShips]   = useState<PlacedShip[]>([])
  const [selectedShip, setSelectedShip] = useState<SelectedShip | null>(null)
  const [myBoardReady, setMyBoardReady] = useState(false)
  const [readyLoading, setReadyLoading] = useState(false)
  const [readyError, setReadyError]     = useState<string | null>(null)

  const onGameStartRef = useRef(onGameStart)
  useEffect(() => { onGameStartRef.current = onGameStart }, [onGameStart])

  useEffect(() => {
    const channel = supabase
      .channel(`placing-${ctx.gameId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${ctx.gameId}` },
        (payload) => {
          if ((payload.new as { status: string }).status === 'playing') onGameStartRef.current()
        })
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return
        const { data } = await supabase.from('games').select('status').eq('id', ctx.gameId).single()
        if (data?.status === 'playing') onGameStartRef.current()
      })
    return () => { supabase.removeChannel(channel) }
  }, [ctx.gameId])

  const grid = useMemo<CellState[][]>(() => {
    const g = createEmptyGrid()
    for (const ship of placedShips)
      getShipCells(ship.row, ship.col, ship.size, ship.orientation)
        .forEach(([r, c]) => { g[r][c] = 'ship' })
    return g
  }, [placedShips])

  const placedCounts = useMemo(() => {
    const counts: Record<string, number> = Object.fromEntries(SHIP_DEFS.map(s => [s.id, 0]))
    for (const ship of placedShips) counts[ship.id]++
    return counts
  }, [placedShips])

  const ships    = SHIP_DEFS.map(s => ({ ...s, placed: placedCounts[s.id] ?? 0 }))
  const allPlaced = ships.every(s => s.placed >= s.total)

  const handleToggleOrientation = useCallback(() => {
    setSelectedShip(prev => prev ? { ...prev, orientation: prev.orientation === 'H' ? 'V' : 'H' } : prev)
  }, [])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'r' || e.key === 'R') handleToggleOrientation() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [handleToggleOrientation])

  function handleSelectShip(id: string, size: number) {
    if (selectedShip?.id === id) { setSelectedShip(null); return }
    setSelectedShip({ id, size, orientation: selectedShip?.orientation ?? 'H' })
  }

  function handleShipPlaced(row: number, col: number) {
    if (!selectedShip) return
    setPlacedShips(prev => [...prev, { id: selectedShip.id, size: selectedShip.size, row, col, orientation: selectedShip.orientation }])
    const shipDef = SHIP_DEFS.find(s => s.id === selectedShip.id)!
    if ((placedCounts[selectedShip.id] ?? 0) + 1 >= shipDef.total) setSelectedShip(null)
  }

  function handleShipPickup(row: number, col: number) {
    const idx = placedShips.findIndex(ship =>
      getShipCells(ship.row, ship.col, ship.size, ship.orientation).some(([r, c]) => r === row && c === col)
    )
    if (idx === -1) return
    const ship = placedShips[idx]
    setPlacedShips(prev => prev.filter((_, i) => i !== idx))
    setSelectedShip({ id: ship.id, size: ship.size, orientation: ship.orientation })
  }

  function handleRandomPlace() {
    const result: PlacedShip[] = []; const tempGrid = createEmptyGrid()
    for (const shipDef of SHIP_DEFS) {
      for (let n = 0; n < shipDef.total; n++) {
        let done = false; let attempts = 0
        while (!done && attempts < 2000) {
          attempts++
          const orientation: Orientation = Math.random() < 0.5 ? 'H' : 'V'
          const row = Math.floor(Math.random() * 10), col = Math.floor(Math.random() * 10)
          const cells = getShipCells(row, col, shipDef.size, orientation)
          if (isValidPlacement(tempGrid, cells)) {
            result.push({ id: shipDef.id, size: shipDef.size, row, col, orientation })
            cells.forEach(([r, c]) => { tempGrid[r][c] = 'ship' }); done = true
          }
        }
      }
    }
    setPlacedShips(result); setSelectedShip(null)
  }

  async function handleReady() {
    if (!allPlaced || myBoardReady) return
    setReadyLoading(true); setReadyError(null)
    const { error: upsertErr } = await supabase.from('boards')
      .upsert({ game_id: ctx.gameId, role: ctx.role, grid, ready: true }, { onConflict: 'game_id,role' })
    if (upsertErr) { setReadyError('Błąd zapisu: ' + upsertErr.message); setReadyLoading(false); return }
    setMyBoardReady(true)
    const { data: readyBoards } = await supabase.from('boards').select('role').eq('game_id', ctx.gameId).eq('ready', true)
    if (readyBoards && readyBoards.length === 2)
      await supabase.from('games').update({ status: 'playing', current_turn: 'host' }).eq('id', ctx.gameId)
    setReadyLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-800 flex flex-col items-center justify-center gap-8 px-4 py-8">
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-4xl font-bold text-white">Statki Multiplayer</h1>
        <p className="text-sm text-gray-400">
          Grasz jako <span className="text-white font-medium">{ctx.nickname}</span>
          {' · '}kod: <span className="font-mono font-bold text-yellow-300">{ctx.code}</span>
          {' · '}<span className="text-gray-300">{ctx.role === 'host' ? 'gospodarz' : 'gość'}</span>
        </p>
      </div>
      <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6">
        <Board grid={grid} placementMode placementShip={myBoardReady ? null : selectedShip}
          onShipPlaced={handleShipPlaced} onShipPickup={myBoardReady ? undefined : handleShipPickup}
          onOrientationToggle={handleToggleOrientation} />
        <ShipPanel ships={ships} selected={myBoardReady ? null : selectedShip}
          onSelect={myBoardReady ? () => {} : handleSelectShip}
          onToggleOrientation={handleToggleOrientation}
          onRandomPlace={myBoardReady ? () => {} : handleRandomPlace}
          onReady={handleReady} />
      </div>
      {readyError && (
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/30 rounded-lg px-4 py-2">{readyError}</p>
      )}
      {myBoardReady && (
        <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-yellow-400/10 border border-yellow-400/40 text-yellow-300 text-sm font-medium">
          <span className="inline-block w-4 h-4 border-2 border-yellow-300 border-t-transparent rounded-full animate-spin" />
          {readyLoading ? 'Zapisuję…' : 'Twoja flota gotowa! Czekam aż przeciwnik skończy rozstawianie…'}
        </div>
      )}
      <footer className="text-xs text-gray-500 text-center px-4">
        Zwibekodowane podczas warsztatów z narzędzi MCP + VibeCoding.<br />
        <a href="https://apius.pl" target="_blank" rel="noopener noreferrer"
          className="underline hover:text-gray-300 transition-colors">Apius Technologies</a>{' '}2026
      </footer>
    </div>
  )
}

// ================================================================
// Ekran rozgrywki
// ================================================================

function PlayingScreen({ ctx }: { ctx: GameContext }) {
  const opponentRole = ctx.role === 'host' ? 'guest' : 'host'

  const [myShipGrid,  setMyShipGrid]  = useState<CellState[][]>(createEmptyGrid())
  const [oppShipGrid, setOppShipGrid] = useState<CellState[][] | null>(null)
  const [shots,       setShots]       = useState<Shot[]>([])
  const [currentTurn, setCurrentTurn] = useState<'host' | 'guest'>('host')
  const [shooting,    setShooting]    = useState(false)
  const [loaded,      setLoaded]      = useState(false)

  // Torpedy w locie (może być kilka jednocześnie w teorii)
  const [torpedoes, setTorpedoes] = useState<TorpedoAnim[]>([])
  // Drżenie mojej łodzi po trafieniu
  const [shakeLeft, setShakeLeft] = useState(false)

  // Powiadomienie o zatopieniu
  const [notification, setNotification] = useState<{ msg: string; id: number } | null>(null)
  const prevSunkRef   = useRef({ my: 0, opp: 0 })
  const wasLoadedRef  = useRef(false)

  // Flagi na planszy przeciwnika (lokalny stan, nie zapisywany do bazy)
  const [flaggedCells, setFlaggedCells] = useState<Set<string>>(new Set())

  // Koniec gry
  const [gameOver, setGameOver] = useState<{ winner: 'host' | 'guest' } | null>(null)

  // Timer tury
  const [timeLeft, setTimeLeft] = useState(30)

  // Refy do centrum łodzi podwodnych — potrzebne do obliczenia startu torpedy
  const leftSubRef  = useRef<HTMLDivElement>(null)
  const rightSubRef = useRef<HTMLDivElement>(null)

  // Oblicz pozycję i kąt torpedy, dodaj ją do listy animacji
  function launchTorpedo(
    subEl: HTMLElement,
    boardAttr: 'mine' | 'opponent',
    row: number,
    col: number,
  ) {
    const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
    const cell = document
      .querySelector(`[data-board="${boardAttr}"]`)
      ?.querySelector(`button[title="${ROWS[row]}${col + 1}"]`) as HTMLElement | null
    if (!cell) return

    const subRect  = subEl.getBoundingClientRect()
    const cellRect = cell.getBoundingClientRect()

    // Jeśli łódź jest ukryta (mobile), subRect.width === 0 — nie animuj
    if (subRect.width === 0) return

    const fromX = subRect.left + subRect.width  / 2
    const fromY = subRect.top  + subRect.height / 2
    const toX   = cellRect.left + cellRect.width  / 2
    const toY   = cellRect.top  + cellRect.height / 2
    const dx    = toX - fromX
    const dy    = toY - fromY

    setTorpedoes(prev => [...prev, {
      id: Date.now() + Math.random(),
      fromX,
      fromY,
      angle:    Math.atan2(dy, dx) * (180 / Math.PI),
      distance: Math.sqrt(dx * dx + dy * dy),
    }])
  }

  // ---- Siatki pochodne (z wykrywaniem zatopionych statków) ----

  const { myGrid, opponentGrid, mySunkCount, oppSunkCount } = useMemo(() => {
    // --- Moja plansza ---
    const myG = myShipGrid.map(r => [...r] as CellState[])
    const oppShots = shots.filter(s => s.shooter === opponentRole)
    for (const s of oppShots) myG[s.row][s.col] = s.result

    let mySunkCount = 0
    const myShips = findShips(myShipGrid as string[][])
    for (const shipCells of myShips) {
      if (shipCells.every(([r, c]) => oppShots.some(s => s.row === r && s.col === c && s.result === 'hit'))) {
        mySunkCount++
        for (const [r, c] of shipCells) myG[r][c] = 'sunk'
      }
    }

    // --- Plansza przeciwnika ---
    const oppG = createEmptyGrid()
    const myShots = shots.filter(s => s.shooter === ctx.role)
    for (const s of myShots) oppG[s.row][s.col] = s.result

    let oppSunkCount = 0
    if (oppShipGrid) {
      const oppShips = findShips(oppShipGrid as string[][])
      for (const shipCells of oppShips) {
        if (shipCells.every(([r, c]) => myShots.some(s => s.row === r && s.col === c && s.result === 'hit'))) {
          oppSunkCount++
          for (const [r, c] of shipCells) oppG[r][c] = 'sunk'
        }
      }
    }

    return { myGrid: myG, opponentGrid: oppG, mySunkCount, oppSunkCount }
  }, [myShipGrid, oppShipGrid, shots, opponentRole, ctx.role])

  const isMyTurn = currentTurn === ctx.role

  // ---- Powiadomienia o zatopionach ----

  useEffect(() => {
    if (!loaded) return
    if (!wasLoadedRef.current) {
      wasLoadedRef.current = true
      prevSunkRef.current = { my: mySunkCount, opp: oppSunkCount }
      return
    }
    if (oppSunkCount > prevSunkRef.current.opp) {
      setNotification({ msg: '💥 Zatopiony!', id: Date.now() })
    } else if (mySunkCount > prevSunkRef.current.my) {
      setNotification({ msg: '💀 Twój statek zatopiony!', id: Date.now() })
    }
    prevSunkRef.current = { my: mySunkCount, opp: oppSunkCount }
  }, [mySunkCount, oppSunkCount, loaded])

  useEffect(() => {
    if (!notification) return
    const t = setTimeout(() => setNotification(null), 3000)
    return () => clearTimeout(t)
  }, [notification])

  // ---- Koniec gry — wykrycie po stronie zwycięzcy ----
  // Przegrany dowie się przez Realtime (games UPDATE status='finished')

  useEffect(() => {
    if (!loaded || gameOver) return
    if (oppSunkCount === TOTAL_SHIPS) {
      // Wygrałem — zapisuję do bazy (przegrany dowie się przez Realtime)
      setGameOver({ winner: ctx.role })
      supabase.from('games')
        .update({ status: 'finished', winner: ctx.role })
        .eq('id', ctx.gameId)
        .then()   // konieczne — bez .then() Supabase nie wysyła zapytania
    } else if (mySunkCount === TOTAL_SHIPS) {
      // Przegrałem — wykrywam lokalnie z mySunkCount, nie czekam na Realtime
      setGameOver({ winner: opponentRole })
    }
  }, [oppSunkCount, mySunkCount, loaded, gameOver, ctx.role, opponentRole, ctx.gameId])

  // ---- Ładowanie danych ----

  useEffect(() => {
    async function load() {
      const [boardsRes, shotsRes, gameRes] = await Promise.all([
        supabase.from('boards').select('role, grid').eq('game_id', ctx.gameId),
        supabase.from('shots').select('*').eq('game_id', ctx.gameId).order('created_at'),
        supabase.from('games').select('current_turn').eq('id', ctx.gameId).single(),
      ])
      if (boardsRes.data) {
        const mine = boardsRes.data.find(b => b.role === ctx.role)
        const opp  = boardsRes.data.find(b => b.role === opponentRole)
        if (mine) setMyShipGrid(mine.grid as CellState[][])
        if (opp)  setOppShipGrid(opp.grid  as CellState[][])
      }
      if (shotsRes.data) setShots(shotsRes.data as Shot[])
      if (gameRes.data)  setCurrentTurn(gameRes.data.current_turn as 'host' | 'guest')
      setLoaded(true)
    }
    load()
  }, [ctx.gameId, ctx.role, opponentRole])

  // ---- Realtime ----

  useEffect(() => {
    const channel = supabase
      .channel(`playing-${ctx.gameId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'shots', filter: `game_id=eq.${ctx.gameId}` },
        (payload) => {
          const shot = payload.new as Shot
          setShots(prev => {
            // Zastąp tymczasowy optymistyczny wpis prawdziwym rekordem z bazy
            const withoutTemp = prev.filter(s => s.id !== `opt-${shot.row}-${shot.col}`)
            return withoutTemp.some(s => s.id === shot.id) ? withoutTemp : [...withoutTemp, shot]
          })
          // Strzał przeciwnika: torpeda z prawej łodzi w kierunku mojego pola
          if (shot.shooter !== ctx.role) {
            if (rightSubRef.current) launchTorpedo(rightSubRef.current, 'mine', shot.row, shot.col)
            if (shot.result === 'hit') setShakeLeft(true)
          }
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${ctx.gameId}` },
        (payload) => {
          const g = payload.new as { current_turn: 'host' | 'guest'; status: string; winner: string | null }
          setCurrentTurn(g.current_turn)
          if (g.status === 'finished' && g.winner) {
            setGameOver({ winner: g.winner as 'host' | 'guest' })
          }
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [ctx.gameId, ctx.role])

  // ---- Timer tury ----

  // Reset do 30 przy każdej zmianie tury (i po załadowaniu)
  useEffect(() => {
    if (loaded) setTimeLeft(30)
  }, [currentTurn, loaded])

  // Odliczanie — tylko aktywny gracz strzela po upływie czasu
  useEffect(() => {
    if (!loaded || gameOver) return
    if (timeLeft <= 0) {
      if (isMyTurn) {
        supabase.from('games').update({ current_turn: opponentRole }).eq('id', ctx.gameId)
      }
      return
    }
    const t = setTimeout(() => setTimeLeft(prev => prev - 1), 1000)
    return () => clearTimeout(t)
  }, [timeLeft, loaded, gameOver, isMyTurn, opponentRole, ctx.gameId])

  // ---- Strzelanie ----

  function handleCellRightClick(row: number, col: number) {
    // Przełącz flagę tylko na pustych polach planszy przeciwnika
    if (opponentGrid[row][col] !== 'empty') return
    const key = `${row},${col}`
    setFlaggedCells(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  async function handleShoot(row: number, col: number) {
    if (!isMyTurn || shooting || opponentGrid[row][col] === 'hit' || opponentGrid[row][col] === 'miss' || opponentGrid[row][col] === 'sunk' || !oppShipGrid) return
    setShooting(true)
    // Usuń flagę ze strzelanego pola
    setFlaggedCells(prev => { const next = new Set(prev); next.delete(`${row},${col}`); return next })
    // Torpeda z lewej łodzi w kierunku klikniętego pola na planszy przeciwnika
    if (leftSubRef.current) launchTorpedo(leftSubRef.current, 'opponent', row, col)

    const result: 'hit' | 'miss' = oppShipGrid[row][col] === 'ship' ? 'hit' : 'miss'

    // Optymistyczny update — pole od razu staje się hit/miss lokalnie,
    // blokując ponowne kliknięcie zanim Realtime wróci z potwierdzeniem
    const tempId = `opt-${row}-${col}`
    setShots(prev => [...prev, { id: tempId, shooter: ctx.role, row, col, result, created_at: '' }])

    const { error } = await supabase.from('shots').insert({
      game_id: ctx.gameId, shooter: ctx.role, row, col, result,
    })

    if (error) {
      // Cofnij optymistyczny update przy błędzie (np. wyścig)
      setShots(prev => prev.filter(s => s.id !== tempId))
    } else if (result === 'miss') {
      // Pudło — tura przechodzi na przeciwnika
      await supabase.from('games').update({ current_turn: opponentRole }).eq('id', ctx.gameId)
      // Trafienie — tura ZOSTAJE u strzelca (nie aktualizujemy current_turn)
    }

    setShooting(false)
  }

  // ---- Render ----

  if (!loaded) {
    return (
      <div className="min-h-screen bg-gray-800 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-300">
          <span className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          Ładowanie gry…
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-800 flex flex-col items-center justify-center gap-6 px-4 py-8">

      {/* Nagłówek */}
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-4xl font-bold text-white">Statki Multiplayer</h1>
        <p className="text-sm text-gray-400">
          <span className="text-white font-medium">{ctx.nickname}</span>
          {' · '}kod: <span className="font-mono font-bold text-yellow-300">{ctx.code}</span>
        </p>
      </div>

      {/* Wskaźnik tury + timer */}
      <div className={[
        'w-full max-w-sm rounded-xl border overflow-hidden transition-all duration-300',
        isMyTurn
          ? 'bg-green-500/20 border-green-500'
          : 'bg-gray-700/40 border-gray-600',
      ].join(' ')}>
        <div className="flex items-center justify-between px-6 py-3">
          <span className={`font-semibold text-lg ${isMyTurn ? 'text-green-300' : 'text-gray-400'}`}>
            {isMyTurn ? '🎯 Twoja tura — Strzelaj!' : '⏳ Tura przeciwnika…'}
          </span>
          <span className={[
            'text-2xl font-mono font-bold tabular-nums w-10 text-right',
            timeLeft > 15 ? 'text-green-400' : timeLeft > 8 ? 'text-yellow-400' : 'text-red-400',
          ].join(' ')}>
            {timeLeft}
          </span>
        </div>
        {/* Pasek postępu — kurczy się w lewo */}
        <div className="h-1 bg-gray-700">
          <div
            className={[
              'h-full transition-all duration-1000 ease-linear',
              timeLeft > 15 ? 'bg-green-500' : timeLeft > 8 ? 'bg-yellow-400' : 'bg-red-500',
            ].join(' ')}
            style={{ width: `${(timeLeft / 30) * 100}%` }}
          />
        </div>
      </div>

      {/* Powiadomienie o zatopieniu */}
      {notification && (
        <div
          key={notification.id}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-8 py-4 rounded-2xl bg-gray-900 border-2 border-yellow-400 text-yellow-300 font-bold text-2xl shadow-2xl cursor-pointer select-none"
          onClick={() => setNotification(null)}
        >
          {notification.msg}
        </div>
      )}

      {/* Torpedy w locie — position:fixed, na wierzchu wszystkiego */}
      {torpedoes.map(t => (
        <div
          key={t.id}
          className="torpedo-fly"
          style={{
            left: t.fromX - 26,   // 26 = połowa szerokości TorpedoSvg (52px)
            top:  t.fromY - 8,    //  8 = połowa wysokości TorpedoSvg (16px)
            '--torpedo-angle': `${t.angle}deg`,
            '--torpedo-dist':  `${t.distance}px`,
          } as React.CSSProperties}
          onAnimationEnd={() => setTorpedoes(prev => prev.filter(tp => tp.id !== t.id))}
        >
          <TorpedoSvg />
        </div>
      ))}

      {/* Obszar gry: łodzie + plansze */}
      <div className="flex items-center gap-4">

        {/* Moja łódź (lewa) */}
        <div
          ref={leftSubRef}
          className={`hidden lg:block ${shakeLeft ? 'sub-shake' : ''}`}
          onAnimationEnd={() => setShakeLeft(false)}
        >
          <SubmarineSvg />
        </div>

        {/* Plansze */}
        <div className="flex flex-col lg:flex-row items-center lg:items-start gap-8">

          {/* Moja plansza — tylko do odczytu */}
          <div className="flex flex-col items-center gap-2" data-board="mine">
            <h2 className="text-sm font-semibold text-gray-300">Moja flota</h2>
            <Board grid={myGrid} readonly />
          </div>

          {/* Plansza przeciwnika — klikalna tylko w mojej turze */}
          <div
            className={`flex flex-col items-center gap-2 transition-opacity duration-200 ${!isMyTurn ? 'opacity-50' : ''}`}
            data-board="opponent"
          >
            <h2 className={`text-sm font-semibold ${isMyTurn ? 'text-green-400' : 'text-gray-400'}`}>
              Wody przeciwnika{isMyTurn ? ' ← Strzelaj!' : ''}
            </h2>
            <Board
              grid={opponentGrid}
              readonly={!isMyTurn || shooting}
              onCellClick={handleShoot}
              flaggedCells={flaggedCells}
              onCellRightClick={handleCellRightClick}
            />
          </div>

        </div>

        {/* Łódź przeciwnika (prawa, odwrócona) */}
        <div ref={rightSubRef} className="hidden lg:block" style={{ transform: 'scaleX(-1)' }}>
          <SubmarineSvg />
        </div>

      </div>

      <footer className="text-xs text-gray-500 text-center px-4">
        Zwibekodowane podczas warsztatów z narzędzi MCP + VibeCoding.<br />
        <a href="https://apius.pl" target="_blank" rel="noopener noreferrer"
          className="underline hover:text-gray-300 transition-colors">Apius Technologies</a>{' '}2026
      </footer>

      {/* Overlay końca gry */}
      {gameOver && (
        <div className="fixed inset-0 z-50 bg-gray-900/85 flex items-center justify-center px-4">
          <div className="flex flex-col items-center gap-6 p-10 rounded-3xl bg-gray-800 border-2 border-yellow-400 shadow-2xl text-center">
            <div className="text-7xl">
              {gameOver.winner === ctx.role ? '🏆' : '💀'}
            </div>
            <h2 className="text-4xl font-bold text-white">
              {gameOver.winner === ctx.role ? 'Wygrałeś!' : 'Przegrałeś!'}
            </h2>
            <p className="text-gray-400">
              {gameOver.winner === ctx.role
                ? 'Zatopiłeś całą flotę przeciwnika!'
                : 'Twoja flota została zatopiona.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg transition-colors"
            >
              Zagraj jeszcze raz
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ================================================================
// Router aplikacji
// ================================================================

export default function App() {
  const [screen,  setScreen]  = useState<Screen>('lobby')
  const [gameCtx, setGameCtx] = useState<GameContext | null>(null)

  function handleEnterGame(ctx: GameContext) { setGameCtx(ctx); setScreen('placing') }

  if (screen === 'playing' && gameCtx)  return <PlayingScreen ctx={gameCtx} />
  if (screen === 'placing' && gameCtx)  return <PlacingScreen ctx={gameCtx} onGameStart={() => setScreen('playing')} />
  return <Lobby onEnterGame={handleEnterGame} />
}
