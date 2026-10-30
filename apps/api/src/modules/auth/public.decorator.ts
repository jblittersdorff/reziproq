import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = Symbol('IS_PUBLIC');

/** Nimmt eine Route von der Login-Pflicht aus. Ohne diese Markierung braucht jede Route ein Token. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
