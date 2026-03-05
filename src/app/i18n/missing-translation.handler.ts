import { MissingTranslationHandler, MissingTranslationHandlerParams } from '@ngx-translate/core';

export class AppMissingTranslationHandler implements MissingTranslationHandler {
  handle(params: MissingTranslationHandlerParams): string {
    // Log não intrusivo e retorno da própria chave como fallback
    // eslint-disable-next-line no-console
    console.warn('[i18n] Missing translation key:', params.key);
    return params.key;
  }
}


