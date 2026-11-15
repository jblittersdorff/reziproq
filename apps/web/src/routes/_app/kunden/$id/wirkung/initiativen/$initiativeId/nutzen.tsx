import { createFileRoute } from '@tanstack/react-router';
import { BenefitPage } from '@/features/impact/sharing-pages';

export const Route = createFileRoute('/_app/kunden/$id/wirkung/initiativen/$initiativeId/nutzen')({
  component: function Benefit() {
    const { id, initiativeId } = Route.useParams();
    return <BenefitPage key={initiativeId} relationshipId={id} initiativeId={initiativeId} />;
  },
});
