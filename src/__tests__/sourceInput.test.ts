import {
  isStartggReference,
  normalizeEventSlug,
  normalizeVodUrl,
  rankByName,
  tournamentSlug,
} from '../renderer/common/sourceInput';

describe('normalizeEventSlug', () => {
  it.each([
    [
      'tournament/genesis-11/event/ultimate-singles',
      'tournament/genesis-11/event/ultimate-singles',
    ],
    [
      '  tournament/genesis-11/event/ultimate-singles/  ',
      'tournament/genesis-11/event/ultimate-singles',
    ],
    [
      'https://www.start.gg/tournament/genesis-11/event/ultimate-singles',
      'tournament/genesis-11/event/ultimate-singles',
    ],
    [
      'https://start.gg/tournament/genesis-11/event/ultimate-singles/overview',
      'tournament/genesis-11/event/ultimate-singles',
    ],
    [
      'start.gg/tournament/genesis-11/event/ultimate-singles?tab=brackets',
      'tournament/genesis-11/event/ultimate-singles',
    ],
    [
      'http://smash.gg/tournament/old_event/event/melee#top',
      'tournament/old_event/event/melee',
    ],
  ])('accepts %s', (input, slug) => {
    expect(normalizeEventSlug(input)).toBe(slug);
  });

  it.each([
    '',
    'genesis',
    'tournament/genesis-11',
    'https://start.gg/tournament/genesis-11',
    'https://evil.example/tournament/x/event/y',
    'tournament/x/event/y z',
  ])('rejects %s', (input) => {
    expect(normalizeEventSlug(input)).toBeNull();
  });
});

describe('tournamentSlug', () => {
  it('reads tournament-only links and slugs', () => {
    expect(
      tournamentSlug('https://www.start.gg/tournament/genesis-11/details')
    ).toBe('tournament/genesis-11');
    expect(tournamentSlug('tournament/genesis-11')).toBe(
      'tournament/genesis-11'
    );
    expect(tournamentSlug('tournament/genesis-11/event/singles')).toBeNull();
    expect(tournamentSlug('genesis')).toBeNull();
  });
});

describe('isStartggReference', () => {
  it('separates links and slugs from name searches', () => {
    expect(isStartggReference('https://start.gg/tournament/x')).toBe(true);
    expect(isStartggReference('start.gg/tournament/x')).toBe(true);
    expect(isStartggReference('tournament/x')).toBe(true);
    expect(isStartggReference('Genesis 11')).toBe(false);
    expect(isStartggReference('tournament of champions')).toBe(false);
  });
});

describe('normalizeVodUrl', () => {
  it.each([
    [
      'https://www.twitch.tv/videos/123456789',
      'https://www.twitch.tv/videos/123456789',
    ],
    ['twitch.tv/videos/123456789', 'https://www.twitch.tv/videos/123456789'],
    [
      'http://twitch.tv/videos/123?t=1h2m3s',
      'https://www.twitch.tv/videos/123',
    ],
    [' m.twitch.tv/videos/42/ ', 'https://www.twitch.tv/videos/42'],
  ])('accepts %s', (input, url) => {
    expect(normalizeVodUrl(input)).toBe(url);
  });

  it.each([
    '',
    'https://www.youtube.com/watch?v=abc',
    'https://www.twitch.tv/somechannel',
    'https://evil.example/videos/123',
    'ftp://twitch.tv/videos/1',
  ])('rejects %s', (input) => {
    expect(normalizeVodUrl(input)).toBeNull();
  });
});

describe('rankByName', () => {
  const t = (name: string, startAt: number) => ({ name, startAt });

  it('keeps tournaments with every word, newest first', () => {
    expect(
      rankByName('split neutral', [
        t('Neutral Grounds #14', 50),
        t('Split Neutral #76', 30),
        t('Split Decision', 45),
        t('Split Neutral #77 - Pengu-Win’s Send Off Bracket', 40),
      ]).map(({ name }) => name)
    ).toEqual([
      'Split Neutral #77 - Pengu-Win’s Send Off Bracket',
      'Split Neutral #76',
    ]);
  });

  it('matches across punctuation and case', () => {
    expect(
      rankByName('PENGU-WIN', [t('Split Neutral #57 - Pengu-Win’s Bash', 1)])
    ).toHaveLength(1);
  });

  it('falls back to the closest partial matches', () => {
    expect(
      rankByName('split neutral weekly', [
        t('Neutral Grounds', 3),
        t('Split Neutral #1', 1),
        t('Unrelated', 5),
      ]).map(({ name }) => name)
    ).toEqual(['Split Neutral #1', 'Neutral Grounds']);
  });
});
