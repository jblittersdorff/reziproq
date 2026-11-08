import { useQuery } from '@tanstack/react-query';
import { useToken } from '@/features/ratings/use-rating';
import {
  focusDetailQueryOptions,
  focusQueryOptions,
  portfolioMatrixQueryOptions,
  portfolioOpenQueryOptions,
  portfolioQueryOptions,
} from '@/lib/api';

export function usePortfolio() {
  const accessToken = useToken();
  return useQuery({ ...portfolioQueryOptions(accessToken), enabled: accessToken !== '' });
}

export function usePortfolioMatrix(filter: {
  businessUnitId?: string | undefined;
  materialGroupId?: string | undefined;
}) {
  const accessToken = useToken();
  return useQuery({
    ...portfolioMatrixQueryOptions(accessToken, filter),
    enabled: accessToken !== '',
  });
}

export function usePortfolioOpen() {
  const accessToken = useToken();
  return useQuery({ ...portfolioOpenQueryOptions(accessToken), enabled: accessToken !== '' });
}

export function useFocus() {
  const accessToken = useToken();
  return useQuery({ ...focusQueryOptions(accessToken), enabled: accessToken !== '' });
}

export function useFocusDetail(relationshipId: string) {
  const accessToken = useToken();
  return useQuery({
    ...focusDetailQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });
}
