import { query } from '../db/pool';

interface LanguageConfig {
  lang: string;
  dir: 'ltr' | 'rtl';
  fonts: string[];
}

const LANGUAGE_CONFIGS: Record<string, LanguageConfig> = {
  en: {
    lang: 'en',
    dir: 'ltr',
    fonts: ['Inter', 'Roboto'],
  },
  ar: {
    lang: 'ar',
    dir: 'rtl',
    fonts: ['Cairo', 'Noto Naskh Arabic'],
  },
};

const DEFAULT_LANGUAGE = 'en';

export function getLanguageConfig(lang?: string): LanguageConfig {
  const resolvedLang = lang && LANGUAGE_CONFIGS[lang] ? lang : DEFAULT_LANGUAGE;
  return LANGUAGE_CONFIGS[resolvedLang];
}

export async function getLocalizationConfig(
  lang?: string,
  passengerId?: string | number
): Promise<LanguageConfig> {
  if (passengerId) {
    try {
      const result = await query(
        'SELECT preferred_language FROM passengers WHERE passenger_id = $1',
        [passengerId]
      );

      if (result.rows.length > 0) {
        const dbLang = result.rows[0].preferred_language;
        const resolvedLang = lang ?? dbLang ?? DEFAULT_LANGUAGE;
        return getLanguageConfig(resolvedLang);
      }
    } catch (err) {
      console.error('[localizationService] Failed to fetch passenger language preference:', err);
    }
  }

  return getLanguageConfig(lang);
}

export async function persistPreferredLanguage(
  passengerId: string | number,
  lang: string
): Promise<void> {
  if (!LANGUAGE_CONFIGS[lang]) {
    throw new Error(`Unsupported language: ${lang}`);
  }

  try {
    const result = await query(
      `UPDATE passengers
         SET preferred_language = $1,
             updated_at = NOW()
       WHERE passenger_id = $2`,
      [lang, passengerId]
    );

    if (result.rowCount === 0) {
      throw new Error(`Passenger not found: ${passengerId}`);
    }
  } catch (err) {
    console.error('[localizationService] Failed to persist preferred language:', err);
    throw err;
  }
}

export async function getLocalizationConfigAndPersist(
  lang: string,
  passengerId?: string | number
): Promise<LanguageConfig> {
  const config = getLanguageConfig(lang);

  if (passengerId) {
    await persistPreferredLanguage(passengerId, lang);
  }

  return config;
}