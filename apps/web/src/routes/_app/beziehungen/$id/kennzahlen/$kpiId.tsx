import { createFileRoute } from '@tanstack/react-router';
import { KpiSheet } from '@/features/akte/akte-kpi-sheet';

// AK-01 (K2-c.5, E-K4-4): Blatt Kennzahl-Verlauf aus einer Zeile der Scorecard
export const Route = createFileRoute('/_app/beziehungen/$id/kennzahlen/$kpiId')({
  component: function Kpi() {
    const { id, kpiId } = Route.useParams();
    return <KpiSheet key={kpiId} relationshipId={id} kpiId={kpiId} />;
  },
});
