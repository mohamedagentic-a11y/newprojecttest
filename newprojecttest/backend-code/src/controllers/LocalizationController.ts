import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

interface LocalizationConfig {
  lang: string;
  dir: 'ltr' | 'rtl';
  fonts: string[];
}

const SUPPORTED_LANGUAGES: Record<string, LocalizationConfig> = {
  en: {
    lang: 'en',
    dir: 'ltr',
    fonts: ['Inter', 'Roboto'],
  },
  ar: {
    lang: 'ar',
    dir: 'rtl',
    fonts: ['Cairo', 'Noto Sans Arabic'],
  },
};

const DEFAULT_LANGUAGE = 'en';

function getRequestId(): string {
  return `req_${uuidv4().replace(/-/g, '').substring(0, 12)}`;
}

function getTimestamp(): string {
  return new Date().toISOString();
}

export class LocalizationController {
  /**
   * GET /localization/config
   * Returns active language preference, RTL/LTR flag, and font recommendations.
   * Public for initial render; if authenticated, uses token's preferred_language.
   */
  static getConfig(req: Request, res: Response, _next: NextFunction): void {
    const requestId = getRequestId();
    const timestamp = getTimestamp();

    try {
      let resolvedLang = DEFAULT_LANGUAGE;

      // If authenticated, JWT payload preferred_language takes priority
      const user = (req as any).user as { preferred_language?: string } | undefined;
      if (user?.preferred_language && SUPPORTED_LANGUAGES[user.preferred_language]) {
        resolvedLang = user.preferred_language;
      } else {
        // Fall back to query param or Accept-Language header
        const queryLang = req.query.lang as string | undefined;
        if (queryLang && SUPPORTED_LANGUAGES[queryLang]) {
          resolvedLang = queryLang;
        } else {
          const acceptLanguage = req.headers['accept-language'] ?? '';
          const primary = acceptLanguage.split(',')[0]?.split('-')[0]?.trim().toLowerCase();
          if (primary && SUPPORTED_LANGUAGES[primary]) {
            resolvedLang = primary;
          }
        }
      }

      const config = SUPPORTED_LANGUAGES[resolvedLang];

      res.status(200).json({
        status: 'success',
        data: {
          lang: config.lang,
          dir: config.dir,
          fonts: config.fonts,
        },
        meta: {
          requestId,
          timestamp,
        },
      });
    } catch (err) {
      res.status(500).json({
        status: 'error',
        code: 500,
        message: 'Failed to retrieve localization configuration.',
        meta: {
          requestId,
          timestamp,
        },
      });
    }
  }
}