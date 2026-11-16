import { Module } from '@nestjs/common';
import { createLanguageModel } from '../../common/ai-language-model.js';
import { AiSdkDraftModel, DRAFT_MODEL, TestDraftModel } from './draft-model.js';

@Module({
  providers: [
    {
      provide: DRAFT_MODEL,
      useFactory: async () => {
        const model = await createLanguageModel();
        return model ? new AiSdkDraftModel(model) : new TestDraftModel();
      },
    },
  ],
  exports: [DRAFT_MODEL],
})
export class AiDraftsModule {}
