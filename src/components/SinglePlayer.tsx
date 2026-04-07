import { useCallback, useEffect, useMemo, useState } from 'react'
import Board, { type CellState } from './Board'
import ShipPanel from './ShipPanel'
import { SHIP_DEFS, getShipCells, isValidPlacement, findShips, type Orientation } from '../store/ships'

const TOTAL_SHIPS = SHIP_DEFS.reduce((sum, s) => sum + s.total, 0)

type PlacedShip   = { id: string; size: number; row: number; col: number; orientation: Orientation }
type SelectedShip = { id: string; size: number; orientation: Orientation }
type Phase        = 'placing' | 'playing'

function createEmptyGrid(): CellState[][] {
  return Array.from({ length: 10 }, () => Array(10).fill('empty') as CellState[])
}

// Losowe rozmieszczenie statków — zwraca gotową siatkę z polami 'ship'
function buildRandomGrid(): CellState[][] {
  const grid = createEmptyGrid()
  for (const def of SHIP_DEFS) {
    for (let n = 0; n < def.total; n++) {
      let done = false
      let attempts = 0
      while (!done && attempts < 2000) {
        attempts++
        const orientation: Orientation = Math.random() < 0.5 ? 'H' : 'V'
        const row = Math.floor(Math.random() * 10)
        const col = Math.floor(Math.random() * 10)
        const cells = getShipCells(row, col, def.size, orientation)
        if (isValidPlacement(grid as string[][], cells)) {
          cells.forEach(([r, c]) => { grid[r][c] = 'ship' })
          done = true
        }
      }
    }
  }
  return grid
}

// AI komputera: wybierz następne pole do strzału
// Tryb polowania (hunt) jeśli są kandydaci po poprzednich trafieniach,
// inaczej tryb losowy na szachownicy.
function cpuPick(
  shotSet: Set<string>,
  huntStack: Array<[number, number]>,
): { cell: [number, number]; remainingStack: Array<[number, number]> } {
  // Tryb polowania
  for (let i = 0; i < huntStack.length; i++) {
    const [r, c] = huntStack[i]
    if (r >= 0 && r < 10 && c >= 0 && c < 10 && !shotSet.has(`${r},${c}`)) {
      return {
        cell: [r, c],
        remainingStack: [...huntStack.slice(0, i), ...huntStack.slice(i + 1)],
      }
    }
  }

  // Tryb losowy — najpierw szachownica (r+c parzyste), potem pozostałe pola
  const candidates: Array<[number, number]> = []
  for (let r = 0; r < 10; r++)
    for (let c = 0; c < 10; c++)
      if (!shotSet.has(`${r},${c}`) && (r + c) % 2 === 0) candidates.push([r, c])

  if (candidates.length === 0)
    for (let r = 0; r < 10; r++)
      for (let c = 0; c < 10; c++)
        if (!shotSet.has(`${r},${c}`)) candidates.push([r, c])

  return {
    cell: candidates[Math.floor(Math.random() * candidates.length)],
    remainingStack: [],
  }
}

type Props = { onBack: () => void }

export default function SinglePlayer({ onBack }: Props) {
  const [phase, setPhase] = useState<Phase>('placing')

  // ---- Faza rozmieszczania ----
  const [placedShips,  setPlacedShips]  = useState<PlacedShip[]>([])
  const [selectedShip, setSelectedShip] = useState<SelectedShip | null>(null)

  // ---- Faza gry ----
  const [playerShipGrid, setPlayerShipGrid] = useState<CellState[][]>(createEmptyGrid())
  const [cpuShipGrid,    setCpuShipGrid]    = useState<CellState[][]>(createEmptyGrid())
  const [playerShots, setPlayerShots] = useState<Array<{ row: number; col: number; result: 'hit' | 'miss' }>>([])
  const [cpuShots,    setCpuShots]    = useState<Array<{ row: number; col: number; result: 'hit' | 'miss' }>>([])
  const [isPlayerTurn, setIsPlayerTurn] = useState(true)
  const [huntStack,    setHuntStack]   = useState<Array<[number, number]>>([])
  const [cpuThinking,  setCpuThinking] = useState(false)
  const [gameOver,     setGameOver]    = useState<'player' | 'cpu' | null>(null)

  // ---- Siatki pochodne ----
  const { playerDisplay, cpuDisplay, playerSunkCount, cpuSunkCount } = useMemo(() => {
    // Moja plansza: statki + trafienia CPU
    const playerDisp = playerShipGrid.map(r => [...r] as CellState[])
    for (const s of cpuShots) playerDisp[s.row][s.col] = s.result

    let playerSunk = 0
    for (const cells of findShips(playerShipGrid as string[][])) {
      if (cells.every(([r, c]) => cpuShots.some(s => s.row === r && s.col === c && s.result === 'hit'))) {
        playerSunk++
        cells.forEach(([r, c]) => { playerDisp[r][c] = 'sunk' })
      }
    }

    // Plansza CPU: tylko trafienia gracza (pozycje CPU ukryte)
    const cpuDisp = createEmptyGrid()
    for (const s of playerShots) cpuDisp[s.row][s.col] = s.result

    let cpuSunk = 0
    for (const cells of findShips(cpuShipGrid as string[][])) {
      if (cells.every(([r, c]) => playerShots.some(s => s.row === r && s.col === c && s.result === 'hit'))) {
        cpuSunk++
        cells.forEach(([r, c]) => { cpuDisp[r][c] = 'sunk' })
      }
    }

    return { playerDisplay: playerDisp, cpuDisplay: cpuDisp, playerSunkCount: playerSunk, cpuSunkCount: cpuSunk }
  }, [playerShipGrid, cpuShipGrid, playerShots, cpuShots])

  // ---- Koniec gry ----
  useEffect(() => {
    if (gameOver || phase !== 'playing') return
    if (cpuSunkCount === TOTAL_SHIPS)    setGameOver('player')
    else if (playerSunkCount === TOTAL_SHIPS) setGameOver('cpu')
  }, [cpuSunkCount, playerSunkCount, gameOver, phase])

  // ---- Tura komputera ----
  useEffect(() => {
    if (isPlayerTurn || gameOver || phase !== 'playing') return

    setCpuThinking(true)
    const delay = 700 + Math.random() * 700   // 0.7–1.4 s

    const timer = setTimeout(() => {
      const shotSet = new Set(cpuShots.map(s => `${s.row},${s.col}`))
      const { cell: [r, c], remainingStack } = cpuPick(shotSet, huntStack)

      const result: 'hit' | 'miss' = playerShipGrid[r][c] === 'ship' ? 'hit' : 'miss'
      setCpuShots(prev => [...prev, { row: r, col: c, result }])
      setCpuThinking(false)

      if (result === 'hit') {
        // Dodaj sąsiadów do stosu — CPU trafił i strzela ponownie
        const neighbors: Array<[number, number]> = [
          [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1],
        ].filter(([nr, nc]) =>
          nr >= 0 && nr < 10 && nc >= 0 && nc < 10 && !shotSet.has(`${nr},${nc}`)
        ) as Array<[number, number]>
        setHuntStack([...neighbors, ...remainingStack])
        // isPlayerTurn pozostaje false → effect odpali się ponownie
      } else {
        setHuntStack(remainingStack)
        setIsPlayerTurn(true)
      }
    }, delay)

    return () => clearTimeout(timer)
  // cpuShots.length jako dep zamiast tablicy — unikamy niepotrzebnych odpaleń
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlayerTurn, gameOver, phase, cpuShots.length, huntStack, playerShipGrid])

  // ---- Logika rozmieszczania (kopia z PlacingScreen) ----
  const placingGrid = useMemo<CellState[][]>(() => {
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
    const def = SHIP_DEFS.find(s => s.id === selectedShip.id)!
    if ((placedCounts[selectedShip.id] ?? 0) + 1 >= def.total) setSelectedShip(null)
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
    const result: PlacedShip[] = []
    const tempGrid = createEmptyGrid()
    for (const def of SHIP_DEFS) {
      for (let n = 0; n < def.total; n++) {
        let done = false; let attempts = 0
        while (!done && attempts < 2000) {
          attempts++
          const orientation: Orientation = Math.random() < 0.5 ? 'H' : 'V'
          const row = Math.floor(Math.random() * 10)
          const col = Math.floor(Math.random() * 10)
          const cells = getShipCells(row, col, def.size, orientation)
          if (isValidPlacement(tempGrid as string[][], cells)) {
            result.push({ id: def.id, size: def.size, row, col, orientation })
            cells.forEach(([r, c]) => { tempGrid[r][c] = 'ship' })
            done = true
          }
        }
      }
    }
    setPlacedShips(result)
    setSelectedShip(null)
  }

  function handleReady() {
    if (!allPlaced) return
    setPlayerShipGrid(placingGrid)
    setCpuShipGrid(buildRandomGrid())
    setPhase('playing')
  }

  function handlePlayerShoot(row: number, col: number) {
    if (!isPlayerTurn || cpuDisplay[row][col] !== 'empty' || !!gameOver) return
    const result: 'hit' | 'miss' = cpuShipGrid[row][col] === 'ship' ? 'hit' : 'miss'
    setPlayerShots(prev => [...prev, { row, col, result }])
    if (result === 'miss') setIsPlayerTurn(false)
    // Trafienie — gracz strzela ponownie (isPlayerTurn pozostaje true)
  }

  function handleRestart() {
    setPhase('placing')
    setPlacedShips([]); setSelectedShip(null)
    setPlayerShipGrid(createEmptyGrid()); setCpuShipGrid(createEmptyGrid())
    setPlayerShots([]); setCpuShots([])
    setIsPlayerTurn(true); setHuntStack([])
    setCpuThinking(false); setGameOver(null)
  }

  // ================================================================
  // Render
  // ================================================================

  return (
    <div className="min-h-screen bg-gray-800 flex flex-col items-center justify-center gap-6 px-4 py-8">

      <h1 className="text-3xl font-bold text-white">Gra z komputerem</h1>

      {/* ---- FAZA ROZMIESZCZANIA ---- */}
      {phase === 'placing' && (
        <>
          <p className="text-sm text-gray-400 text-center">
            Rozstaw swoją flotę, a następnie kliknij <span className="text-white font-medium">Gotowy!</span>
          </p>
          <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6">
            <Board
              grid={placingGrid}
              placementMode
              placementShip={selectedShip}
              onShipPlaced={handleShipPlaced}
              onShipPickup={handleShipPickup}
              onOrientationToggle={handleToggleOrientation}
            />
            <ShipPanel
              ships={ships}
              selected={selectedShip}
              onSelect={handleSelectShip}
              onToggleOrientation={handleToggleOrientation}
              onRandomPlace={handleRandomPlace}
              onReady={handleReady}
            />
          </div>
          <button
            onClick={onBack}
            className="text-sm text-gray-400 hover:text-gray-200 underline transition-colors"
          >
            ← Wróć do lobby
          </button>
        </>
      )}

      {/* ---- FAZA GRY ---- */}
      {phase === 'playing' && (
        <>
          {/* Wskaźnik tury */}
          <div className={[
            'w-full max-w-sm rounded-xl border transition-all duration-300',
            isPlayerTurn && !gameOver ? 'bg-green-500/20 border-green-500' : 'bg-gray-700/40 border-gray-600',
          ].join(' ')}>
            <div className="flex items-center justify-between px-6 py-3">
              <span className={`font-semibold text-lg ${isPlayerTurn && !gameOver ? 'text-green-300' : 'text-gray-400'}`}>
                {isPlayerTurn ? '🎯 Twoja tura — Strzelaj!' : '🤖 Komputer myśli…'}
              </span>
              {cpuThinking && (
                <span className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          </div>

          {/* Plansze */}
          <div className="w-full flex flex-col lg:flex-row lg:w-auto items-center lg:items-start gap-8">

            <div className="w-full lg:w-auto flex flex-col items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-300">Moja flota</h2>
              <Board grid={playerDisplay} readonly />
            </div>

            <div className={`w-full lg:w-auto flex flex-col items-center gap-2 transition-opacity duration-200 ${!isPlayerTurn || !!gameOver ? 'opacity-50' : ''}`}>
              <h2 className={`text-sm font-semibold ${isPlayerTurn && !gameOver ? 'text-green-400' : 'text-gray-400'}`}>
                Wody komputera{isPlayerTurn && !gameOver ? ' ← Strzelaj!' : ''}
              </h2>
              <Board
                grid={cpuDisplay}
                readonly={!isPlayerTurn || !!gameOver}
                onCellClick={handlePlayerShoot}
              />
            </div>

          </div>

          {/* Overlay końca gry */}
          {gameOver && (
            <div className="fixed inset-0 z-50 bg-gray-900/85 flex items-center justify-center px-4">
              <div className="flex flex-col items-center gap-6 p-10 rounded-3xl bg-gray-800 border-2 border-yellow-400 shadow-2xl text-center">
                <div className="text-7xl">{gameOver === 'player' ? '🏆' : '💀'}</div>
                <h2 className="text-4xl font-bold text-white">
                  {gameOver === 'player' ? 'Wygrałeś!' : 'Przegrałeś!'}
                </h2>
                <p className="text-gray-400">
                  {gameOver === 'player'
                    ? 'Zatopiłeś całą flotę komputera!'
                    : 'Komputer zatopił Twoją flotę.'}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleRestart}
                    className="px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg transition-colors"
                  >
                    Zagraj jeszcze raz
                  </button>
                  <button
                    onClick={onBack}
                    className="px-6 py-3 rounded-xl bg-gray-600 hover:bg-gray-500 text-white font-bold text-lg transition-colors"
                  >
                    Lobby
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <footer className="text-xs text-gray-500 text-center px-4">
        Zwibekodowane podczas warsztatów z narzędzi MCP + VibeCoding.<br />
        <a href="https://apius.pl" target="_blank" rel="noopener noreferrer"
          className="underline hover:text-gray-300 transition-colors">Apius Technologies</a>{' '}2026
      </footer>
    </div>
  )
}
