import { createFileRoute } from '@tanstack/react-router';
import { JointBusinessPlansPage } from '@/features/joint-business-plans/joint-business-plans-page';

export const Route = createFileRoute('/_app/jbp')({
  component: JointBusinessPlansPage,
});
