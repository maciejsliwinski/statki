import { useCallback, useEffect, useMemo, useState } from 'react'
import Board, { type CellState } from './components/Board'
import ShipPanel from './components/ShipPanel'
import { SHIP_DEFS, getShipCells, isValidPlacement, type Orientation } from './store/ships'

function createEmptyGrid(): CellState[][] {
  return Array.from({ length: 10 }, () => Array(10).fill('empty') as CellState[])
}

// Pojedynczy postawiony statek z pełnymi danymi pozycji
type PlacedShip = {
  id: string
  size: number
  row: number
  col: number
  orientation: Orientation
}

type SelectedShip = { id: string; size: number; orientation: Orientation }

export default function App() {
  const [placedShips, setPlacedShips] = useState<PlacedShip[]>([])
  const [selectedShip, setSelectedShip] = useState<SelectedShip | null>(null)

  // Siatka obliczana z listy postawionych statków — żadne dane nie są duplikowane
  const grid = useMemo<CellState[][]>(() => {
    const g = createEmptyGrid()
    for (const ship of placedShips) {
      getShipCells(ship.row, ship.col, ship.size, ship.orientation)
        .forEach(([r, c]) => { g[r][c] = 'ship' })
    }
    return g
  }, [placedShips])

  // Liczba postawionych egzemplarzy każdego typu
  const placedCounts = useMemo(() => {
    const counts: Record<string, number> = Object.fromEntries(SHIP_DEFS.map(s => [s.id, 0]))
    for (const ship of placedShips) counts[ship.id]++
    return counts
  }, [placedShips])

  const ships = SHIP_DEFS.map(s => ({ ...s, placed: placedCounts[s.id] ?? 0 }))

  const handleToggleOrientation = useCallback(() => {
    setSelectedShip(prev =>
      prev ? { ...prev, orientation: prev.orientation === 'H' ? 'V' : 'H' } : prev
    )
  }, [])

  // Globalny listener klawisza R — działa bez konieczności fokusowania planszy
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'r' || e.key === 'R') handleToggleOrientation()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleToggleOrientation])

  function handleSelectShip(id: string, size: number) {
    // Ponowne kliknięcie tego samego statku → odznacz
    if (selectedShip?.id === id) {
      setSelectedShip(null)
      return
    }
    setSelectedShip({ id, size, orientation: selectedShip?.orientation ?? 'H' })
  }

  function handleShipPlaced(row: number, col: number) {
    if (!selectedShip) return
    setPlacedShips(prev => [
      ...prev,
      { id: selectedShip.id, size: selectedShip.size, row, col, orientation: selectedShip.orientation },
    ])
    // Odznacz jeśli wszystkie egzemplarze tego typu zostały postawione
    const shipDef = SHIP_DEFS.find(s => s.id === selectedShip.id)!
    if ((placedCounts[selectedShip.id] ?? 0) + 1 >= shipDef.total) {
      setSelectedShip(null)
    }
  }

  // Podnieś statek z planszy — znajdź który statek zajmuje kliknięte pole i usuń go
  function handleShipPickup(row: number, col: number) {
    const idx = placedShips.findIndex(ship =>
      getShipCells(ship.row, ship.col, ship.size, ship.orientation)
        .some(([r, c]) => r === row && c === col)
    )
    if (idx === -1) return
    const ship = placedShips[idx]
    setPlacedShips(prev => prev.filter((_, i) => i !== idx))
    // Automatycznie zaznacz podniesiony statek do ponownego umieszczenia
    setSelectedShip({ id: ship.id, size: ship.size, orientation: ship.orientation })
  }

  // Losowe rozmieszczenie wszystkich statków (czyści poprzednie)
  function handleRandomPlace() {
    const result: PlacedShip[] = []
    const tempGrid = createEmptyGrid()

    for (const shipDef of SHIP_DEFS) {
      for (let n = 0; n < shipDef.total; n++) {
        let done = false
        let attempts = 0
        while (!done && attempts < 2000) {
          attempts++
          const orientation: Orientation = Math.random() < 0.5 ? 'H' : 'V'
          const row = Math.floor(Math.random() * 10)
          const col = Math.floor(Math.random() * 10)
          const cells = getShipCells(row, col, shipDef.size, orientation)
          if (isValidPlacement(tempGrid, cells)) {
            result.push({ id: shipDef.id, size: shipDef.size, row, col, orientation })
            cells.forEach(([r, c]) => { tempGrid[r][c] = 'ship' })
            done = true
          }
        }
      }
    }

    setPlacedShips(result)
    setSelectedShip(null)
  }

  return (
    <div className="min-h-screen bg-gray-800 flex flex-col items-center justify-center gap-8 px-4 py-8">
      <h1 className="text-4xl font-bold text-white">Statki Multiplayer</h1>

      <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6">
        <Board
          grid={grid}
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
          onReady={() => alert('Gotowy! (kolejny etap do implementacji)')}
        />
      </div>

      <footer className="text-xs text-gray-500 text-center px-4">
        Zwibekodowane podczas warsztatów z narzędzi MCP + VibeCoding.
        <br />
        <a
          href="https://apius.pl"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-gray-300 transition-colors"
        >
          Apius Technologies
        </a>{' '}
        2026
      </footer>
    </div>
  )
}
