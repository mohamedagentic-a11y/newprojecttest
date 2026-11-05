import { Request, Response } from 'express';
import {
  getLanguageConfig,
  getLocalizationConfig,
  persistPreferredLanguage,
  getLocalizationConfigAndPersist,
} from '../services/localizationService';

export async function getLocalizationConfigHandler(req: Request, res: Response): Promise<void> {
  try {
    const requestId = `req_${Math.random().toString(36).substring(2, 10)}`;
    const timestamp = new Date().toISOString();

    // Check if JWT is present (attached by auth middleware, if any)
    const passenger = (req as any).user as { passenger_id?: string; preferred_language?: string } | undefined;

    let config: { lang: string; dir: string; fonts: string[] };

    if (passenger && passenger.passenger_id) {
      // Authenticated: attempt to persist preference and return config
      const acceptLanguage = req.headers['accept-language'];
      let lang: string | undefined = passenger.preferred_language;

      if (!lang && acceptLanguage) {
        // Parse Accept-Language header for primary language tag
        const primary = acceptLanguage.split(',')[0]?.split(';')[0]?.trim();
        if (primary) {
          lang = primary.startsWith('ar') ? 'ar' : 'en';
        }
      }

      if (lang) {
        config = await getLocalizationConfigAndPersist(passenger.passenger_id, lang);
      } else {
        config = await getLocalizationConfig();
      }
    } else {
      // Unauthenticated: check Accept-Language header for a default
      const acceptLanguage = req.headers['accept-language'];
      let lang: string | undefined;

      if (acceptLanguage) {
        const primary = acceptLanguage.split(',')[0]?.split(';')[0]?.trim();
        if (primary) {
          lang = primary.startsWith('ar') ? 'ar' : 'en';
        }
      }

      if (lang) {
        config = await getLanguageConfig(lang);
      } else {
        config = await getLocalizationConfig();
      }
    }

    res.status(200).json({
      status: 'success',
      data: config,
      meta: {
        requestId,
        timestamp,
      },
    });
  } catch (error: unknown) {
    const requestId = `req_${Math.random().toString(36).substring(2, 10)}`;
    const timestamp = new Date().toISOString();
    const message = error instanceof Error ? error.message : 'Failed to retrieve localization config';

    res.status(500).json({
      status: 'error',
      code: 500,
      message,
      meta: {
        requestId,
        timestamp,
      },
    });
  }
}