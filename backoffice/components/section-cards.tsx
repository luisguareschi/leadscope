import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const cardClass =
  "grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4"

export function SectionCards({
  qualifying,
  handedOff,
  paused,
  needsAdvisor,
}: {
  qualifying: number | null
  handedOff: number | null
  paused: number | null
  needsAdvisor: number | null
}) {
  const cards = [
    { label: "En calificación", value: qualifying },
    { label: "Derivados", value: handedOff },
    { label: "Pausados", value: paused },
    { label: "Esperan un asesor", value: needsAdvisor },
  ]

  return (
    <div className={cardClass}>
      {cards.map((card) => (
        <Card key={card.label} className="@container/card">
          <CardHeader>
            <CardDescription>{card.label}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {card.value == null ? "—" : card.value}
            </CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}
