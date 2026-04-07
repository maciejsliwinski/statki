import { useEffect, useRef, useState } from 'react'
import { supabase, getPlayerId, generateRoomCode } from '../lib/supabase'

export type GameContext = {
  gameId: string
  code: string
  role: 'host' | 'guest'
  nickname: string
  playerId: string
}

type LobbyProps = {
  onEnterGame: (ctx: GameContext) => void
}

const NICKNAME_KEY = 'statki_nickname'

export default function Lobby({ onEnterGame }: LobbyProps) {
  const [nickname, setNickname]         = useState(() => sessionStorage.getItem(NICKNAME_KEY) ?? '')
  const [joinCode, setJoinCode]         = useState('')
  const [createdCode, setCreatedCode]   = useState<string | null>(null)
  const [createdGameId, setCreatedGameId] = useState<string | null>(null)
  const [waitingForGuest, setWaitingForGuest] = useState(false)
  const [loading, setLoading]           = useState<'create' | 'join' | null>(null)
  const [error, setError]               = useState<string | null>(null)
  const codeRef = useRef<HTMLInputElement>(null)

  // Zapisz pseudonim przy każdej zmianie
  useEffect(() => { sessionStorage.setItem(NICKNAME_KEY, nickname) }, [nickname])

  // Realtime: host czeka aż gość dołączy (status → 'placing')
  useEffect(() => {
    if (!createdGameId || !createdCode) return

    const ctx: GameContext = {
      gameId: createdGameId,
      code: createdCode,
      role: 'host',
      nickname: nickname.trim(),
      playerId: getPlayerId(),
    }

    const channel = supabase
      .channel(`lobby-${createdGameId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${createdGameId}` },
        (payload) => {
          const updated = payload.new as { status: string }
          if (updated.status === 'placing') onEnterGame(ctx)
        },
      )
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return
        // Sprawdź czy gość nie dołączył zanim zdążyliśmy zasubskrybować
        const { data } = await supabase
          .from('games').select('status').eq('id', createdGameId).single()
        if (data?.status === 'placing') onEnterGame(ctx)
      })

    return () => { supabase.removeChannel(channel) }
  // onEnterGame celowo poza deps — stabilna referencja z App
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createdGameId, createdCode])

  function nicknameOk() { return nickname.trim().length >= 2 }

  // --- STWÓRZ GRĘ ---
  async function handleCreate() {
    if (!nicknameOk()) { setError('Pseudonim musi mieć co najmniej 2 znaki.'); return }
    setError(null)
    setLoading('create')
    const playerId = getPlayerId()

    let game: { id: string; code: string } | null = null
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateRoomCode()
      const { data, error: err } = await supabase
        .from('games')
        .insert({ host_id: playerId, code, status: 'pending' })
        .select('id, code')
        .single()
      if (!err && data) { game = data; break }
      if (err && !err.message.includes('unique')) {
        setError('Błąd tworzenia gry: ' + err.message)
        setLoading(null)
        return
      }
    }

    if (!game) { setError('Nie udało się wygenerować unikalnego kodu. Spróbuj ponownie.'); setLoading(null); return }

    setCreatedCode(game.code)
    setCreatedGameId(game.id)
    setWaitingForGuest(true)
    setLoading(null)
  }

  async function handleCopyCode() {
    if (!createdCode) return
    await navigator.clipboard.writeText(createdCode).catch(() => {})
    codeRef.current?.select()
  }

  // --- DOŁĄCZ DO GRY ---
  async function handleJoin() {
    if (!nicknameOk()) { setError('Pseudonim musi mieć co najmniej 2 znaki.'); return }
    const code = joinCode.trim().toUpperCase()
    if (code.length !== 6) { setError('Kod pokoju musi mieć dokładnie 6 znaków.'); return }
    setError(null)
    setLoading('join')
    const playerId = getPlayerId()

    const { data: game, error: findErr } = await supabase
      .from('games')
      .select('id, code, status, host_id, guest_id')
      .eq('code', code)
      .single()

    if (findErr || !game) { setError('Nie znaleziono pokoju o tym kodzie.'); setLoading(null); return }
    if (game.status !== 'pending')  { setError('Ta gra już się rozpoczęła lub jest zakończona.'); setLoading(null); return }
    if (game.host_id === playerId)  { setError('Nie możesz dołączyć do własnej gry.'); setLoading(null); return }
    if (game.guest_id)              { setError('Pokój jest już pełny.'); setLoading(null); return }

    const { error: joinErr } = await supabase
      .from('games')
      .update({ guest_id: playerId, status: 'placing' })
      .eq('id', game.id)

    if (joinErr) { setError('Błąd dołączania: ' + joinErr.message); setLoading(null); return }

    setLoading(null)
    onEnterGame({ gameId: game.id, code: game.code, role: 'guest', nickname: nickname.trim(), playerId })
  }

  return (
    <div className="min-h-screen bg-gray-800 flex flex-col items-center justify-center gap-8 px-4 py-8">
      <h1 className="text-4xl font-bold text-white">Statki Multiplayer</h1>

      <div className="w-full max-w-sm flex flex-col gap-5">

        {/* Pseudonim */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-300">Pseudonim</label>
          <input
            type="text"
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            maxLength={20}
            placeholder="Wpisz pseudonim…"
            disabled={waitingForGuest}
            className="px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 transition-colors disabled:opacity-50"
          />
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* --- STWÓRZ GRĘ --- */}
        <div className="flex flex-col gap-3 p-4 rounded-xl border border-gray-600 bg-gray-700/50">
          <h2 className="text-base font-semibold text-gray-200">Nowa gra</h2>

          {waitingForGuest && createdCode ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-gray-400">Podaj ten kod znajomemu:</p>
              <div className="flex gap-2">
                <input
                  ref={codeRef}
                  readOnly
                  value={createdCode}
                  onClick={handleCopyCode}
                  className="flex-1 px-3 py-2 rounded-lg bg-gray-900 border border-gray-500 text-2xl font-mono font-bold text-yellow-300 tracking-widest text-center cursor-pointer"
                />
                <button
                  onClick={handleCopyCode}
                  title="Kopiuj"
                  className="px-3 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 text-gray-200 text-sm transition-colors"
                >
                  📋
                </button>
              </div>
              {/* Animowany wskaźnik oczekiwania */}
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span className="inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                Czekam aż przeciwnik dołączy…
              </div>
            </div>
          ) : (
            <button
              onClick={handleCreate}
              disabled={loading === 'create'}
              className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition-colors"
            >
              {loading === 'create' ? 'Tworzę…' : 'Stwórz grę'}
            </button>
          )}
        </div>

        {/* --- DOŁĄCZ DO GRY --- */}
        {!waitingForGuest && (
          <div className="flex flex-col gap-3 p-4 rounded-xl border border-gray-600 bg-gray-700/50">
            <h2 className="text-base font-semibold text-gray-200">Dołącz do gry</h2>
            <input
              type="text"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="KOD POKOJU"
              className="px-3 py-2 rounded-lg bg-gray-900 border border-gray-600 text-white font-mono text-xl tracking-widest text-center placeholder-gray-600 uppercase focus:outline-none focus:border-blue-400 transition-colors"
            />
            <button
              onClick={handleJoin}
              disabled={loading === 'join' || joinCode.trim().length !== 6}
              className="w-full py-2.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition-colors"
            >
              {loading === 'join' ? 'Dołączam…' : 'Dołącz do gry'}
            </button>
          </div>
        )}
      </div>

      <footer className="text-xs text-gray-500 text-center px-4">
        Zwibekodowane podczas warsztatów z narzędzi MCP + VibeCoding.
        <br />
        <a href="https://apius.pl" target="_blank" rel="noopener noreferrer"
          className="underline hover:text-gray-300 transition-colors">
          Apius Technologies
        </a>{' '}2026
      </footer>
    </div>
  )
}
