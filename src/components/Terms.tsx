type TermsProps = {
  onBack: () => void
}

export default function Terms({ onBack }: TermsProps) {
  return (
    <div className="min-h-screen bg-gray-800 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-lg">
        <button
          onClick={onBack}
          className="mb-6 text-sm text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-1"
        >
          ← Wróć do lobby
        </button>

        <h1 className="text-3xl font-bold text-white mb-6">Regulamin gry</h1>

        <div className="flex flex-col gap-5 text-gray-300 text-sm leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">1. Cel gry</h2>
            <p>
              Celem gry jest zatopienie wszystkich statków przeciwnika przed tym,
              jak on zatopi twoje. Gracze strzelają na zmianę, podając współrzędne
              pola na planszy przeciwnika.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">2. Plansza</h2>
            <p>
              Każdy gracz dysponuje własną kwadratową planszą 10×10. Kolumny
              oznaczono literami A–J, wiersze cyframi 1–10.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">3. Flota</h2>
            <p className="mb-2">Każdy gracz ustawia następujące statki:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>1 × Lotniskowiec (5 pól)</li>
              <li>1 × Pancernik (4 pola)</li>
              <li>2 × Krążownik (3 pola)</li>
              <li>1 × Niszczyciel (2 pola)</li>
              <li>2 × Łódź podwodna (1 pole)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">4. Ustawianie statków</h2>
            <p>
              Statki ustawia się przed rozpoczęciem rozgrywki. Mogą być ustawione
              poziomo lub pionowo. Statki nie mogą się stykać — nawet rogiem.
              Żaden statek nie może wychodzić poza granice planszy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">5. Przebieg rozgrywki</h2>
            <p>
              Gospodarz pokoju wykonuje pierwszy ruch. Gracze strzelają na zmianę.
              Trafienie w statek oznaczone jest czerwonym kolorem i daje prawo do
              kolejnego strzału. Pudło oznaczone jest szarym kolorem i przekazuje
              ruch przeciwnikowi.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">6. Zatopienie statku</h2>
            <p>
              Statek jest zatopiony, gdy każde jego pole zostanie trafione.
              Zatopienie wszystkich statków przeciwnika oznacza wygraną.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">7. Dołączanie do gry</h2>
            <p>
              Aby dołączyć do rozgrywki, należy wpisać pseudonim (min. 2 znaki)
              oraz podać 6-znakowy kod pokoju udostępniony przez gospodarza.
              Jeden pokój obsługuje dokładnie dwóch graczy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">8. Uczciwa gra</h2>
            <p>
              Zabrania się używania narzędzi wspomagających, odświeżania strony
              w celu uniknięcia przegranej oraz podszywania się pod innych graczy.
              Nierespektowanie zasad fair play może skutkować wykluczeniem z rankingu.
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
