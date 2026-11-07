import { twitchVideoId } from '../components/VodPlayer';

const STARTGG_LINK =
  /^(?:https?:\/\/)?(?:www\.)?(?:start|smash)\.gg\/(tournament\/[\w-]+(?:\/event\/[\w-]+)?)(?:[/?#].*)?$/i;
const BARE_SLUG = /^(tournament\/[\w-]+(?:\/event\/[\w-]+)?)\/?$/;
const EVENT_SLUG = /^tournament\/[\w-]+\/event\/[\w-]+$/;

function startggPath(input: string) {
  const value = input.trim();
  return (STARTGG_LINK.exec(value) ?? BARE_SLUG.exec(value))?.[1] ?? null;
}

/** Canonical `tournament/x/event/y` from a start.gg event link or slug. */
export function normalizeEventSlug(input: string) {
  const path = startggPath(input);
  return path && EVENT_SLUG.test(path) ? path : null;
}

/** Canonical `tournament/x` from a start.gg tournament link or slug. */
export function tournamentSlug(input: string) {
  const path = startggPath(input);
  return path && !EVENT_SLUG.test(path) ? path : null;
}

/** True when the input is a start.gg link or slug rather than a search. */
export function isStartggReference(input: string) {
  const value = input.trim();
  return /^(?:https?:\/\/|(?:www\.)?(?:start|smash)\.gg\b|tournament\/)/i.test(
    value
  );
}

/** Canonical `https://www.twitch.tv/videos/<id>` from a Twitch VOD link. */
export function normalizeVodUrl(input: string) {
  let value = input.trim();
  if (!value) return null;
  if (!/^[a-z][a-z\d+.-]*:/i.test(value)) value = `https://${value}`;
  value = value.replace(/^http:/i, 'https:');
  const id = twitchVideoId(value);
  return id ? `https://www.twitch.tv/videos/${id}` : null;
}

const words = (value: string) =>
  value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/**
 * Order name-search hits: tournaments containing every query word, newest
 * first, or the closest partial matches when none contain them all.
 */
export function rankByName<T extends { name: string; startAt: number | null }>(
  query: string,
  tournaments: T[]
) {
  const wanted = words(query);
  const scored = tournaments.map((tournament) => {
    const name = words(tournament.name).join(' ');
    return {
      tournament,
      hits: wanted.filter((word) => name.includes(word)).length,
    };
  });
  const complete = scored.filter(({ hits }) => hits === wanted.length);
  return (complete.length ? complete : scored.filter(({ hits }) => hits))
    .sort(
      (a, b) =>
        b.hits - a.hits ||
        (b.tournament.startAt ?? 0) - (a.tournament.startAt ?? 0)
    )
    .map(({ tournament }) => tournament);
}
