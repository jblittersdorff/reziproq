import { Controller, Get, Inject, Query } from '@nestjs/common';
import { type SearchQuery, type SearchResults, searchQuerySchema } from '@reziproq/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Requires } from '../auth/requires.decorator.js';
import { SearchService } from './search.service.js';

/** QS-05: Suche auf der Seite Fragen, für beide Seiten. */
@Controller('suche')
export class SearchController {
  constructor(@Inject(SearchService) private readonly searchService: SearchService) {}

  @Get()
  @Requires('suche.nutzen')
  search(
    @CurrentUser() auth: AuthContext,
    @Query(new ZodValidationPipe(searchQuerySchema)) query: SearchQuery,
  ): Promise<SearchResults> {
    return this.searchService.search(auth, query);
  }
}
