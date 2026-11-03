import { getVideoTitleError } from '../common/files';
import generateSetTitle, {
  PLAYERS_FIRST_TITLE,
  TOURNAMENT_FIRST_TITLE,
} from '../renderer/common/setTitle';

type Fields = Parameters<typeof generateSetTitle>[0];
const fields = (overrides: Partial<Fields> = {}): Fields => ({
  players: ['Player A', 'Player B'],
  characters: [[], []],
  round: 'Finals',
  tournament: 'Tournament',
  format: PLAYERS_FIRST_TITLE,
  ...overrides,
});
const length = (text: string) => [...text].length;

describe.each([PLAYERS_FIRST_TITLE, TOURNAMENT_FIRST_TITLE] as const)(
  '%s',
  (format) => {
    it('does not restyle a title that already fits', () => {
      const input = fields({
        characters: [['Donkey Kong'], ['Zero Suit Samus']],
        round: 'Winners Quarter-Final',
        tournament: 'Cup  9',
        format,
      });
      const result = generateSetTitle(input);
      expect(result.title).toBe(result.originalTitle);
      expect(result.title).toContain('Donkey Kong');
      expect(result.title).toContain('Winners Quarter-Final');
      expect(result.title).toContain('Cup  9');
      expect(getVideoTitleError(result.title)).toBeNull();
    });

    it.each([
      [100, 'x'],
      [101, 'x'],
      [100, '😀'],
      [101, '😀'],
    ] as const)(
      'honors the exact %s-code-point boundary with %s',
      (size, character) => {
        const input = fields({ tournament: '', format });
        input.tournament = character.repeat(
          size - length(generateSetTitle(input).title)
        );
        const result = generateSetTitle(input);
        expect(length(result.originalTitle)).toBe(size);
        expect(length(result.title)).toBe(100);
        expect(result.title === result.originalTitle).toBe(size === 100);
        expect(result.title).toContain('Player A vs Player B - Finals');
        expect(getVideoTitleError(result.title)).toBeNull();
      }
    );

    it('shares tag space fairly while retaining round, event identity and edition', () => {
      const input = fields({
        players: [
          'NorthernLightsVeryLongCompetitorTag',
          'SouthernCrossAnotherLongCompetitorTag',
        ],
        round: 'Grand Final Reset',
        tournament:
          'Midnight Summit International Championship Super Smash Bros. Ultimate #128',
        format,
      });
      const result = generateSetTitle(input);
      expect(result.title).toContain('NorthernLights');
      expect(result.title).toContain('SouthernCross');
      expect(result.title).toContain('GF Reset');
      expect(result.title).toContain('Midnight Summit');
      expect(result.title).toContain('#128');
      expect(result.title.match(/~/g)).toHaveLength(3);
      expect(length(result.title)).toBeLessThanOrEqual(100);
      expect(getVideoTitleError(result.title)).toBeNull();
      expect(result.title.startsWith('Midnight Summit')).toBe(
        format === TOURNAMENT_FIRST_TITLE
      );
      expect(generateSetTitle(input)).toEqual(result);
      expect(input.players[0]).toBe('NorthernLightsVeryLongCompetitorTag');
    });

    it('keeps a short tag intact and gives unused space to the long opponent', () => {
      const result = generateSetTitle(
        fields({
          players: ['A', 'LongOpponent'.repeat(20)],
          tournament: 'Local Cup 2026',
          format,
        })
      );
      expect(result.title).toContain('A vs LongOpponentLongOpponent');
      expect(result.title).toContain('Finals');
      expect(result.title).toContain('Local Cup 2026');
      expect(getVideoTitleError(result.title)).toBeNull();
    });

    it('keeps unknown round numbers and reset identity when shortening a long round', () => {
      const result = generateSetTitle(
        fields({
          round: `${'Championship stage '.repeat(10)}17 (Reset)`,
          tournament: 'Spring Cup #12',
          format,
        })
      );
      expect(result.title).toContain('Championship');
      expect(result.title).toContain('17 Reset');
      expect(result.title).toContain('Player A vs Player B');
      expect(result.title).toContain('Spring Cup #12');
      expect(getVideoTitleError(result.title)).toBeNull();
    });
  }
);

it.each([
  ['Winners Quarter-Final', 'WQF'],
  ['Losers Semi-Final', 'LSF'],
  ['Winners Final', 'WF'],
  ['Losers Round 12', 'LR12'],
  ['Grand Finals (Reset)', 'GF (Reset)'],
])(
  'uses a readable abbreviation for %s without dropping its identity',
  (round, short) => {
    const result = generateSetTitle(
      fields({
        round,
        tournament: 'The Regional Championship Series '.repeat(3),
      })
    );
    expect(result.title).toContain(` - ${short} - `);
    expect(getVideoTitleError(result.title)).toBeNull();
  }
);

it('uses a small set of familiar character aliases only when needed', () => {
  const result = generateSetTitle(
    fields({
      characters: [['Donkey Kong'], ['Zero Suit Samus']],
      tournament: 'Autumn National Regional Championships 2026',
    })
  );
  expect(length(result.originalTitle)).toBeGreaterThan(100);
  expect(result.title).toContain('Player A (DK) vs Player B (ZSS)');
  expect(result.title).toContain('Autumn National Regional Championships 2026');
  expect(getVideoTitleError(result.title)).toBeNull();
});

it('summarizes multiple picks explicitly instead of pretending there was only one', () => {
  const result = generateSetTitle(
    fields({
      characters: [
        [
          'Unlisted fighter one',
          'Unlisted fighter two',
          'Unlisted fighter three',
        ],
        ['Different fighter one', 'Different fighter two'],
      ],
      tournament: 'Regional Championship 2026',
    })
  );
  expect(result.title).toContain('Player A (3 chars) vs Player B (2 chars)');
  expect(result.originalTitle).toContain('Unlisted fighter two');
  expect(getVideoTitleError(result.title)).toBeNull();
});

it('omits character groups before cutting player tags', () => {
  const result = generateSetTitle(
    fields({
      players: ['LongNorthernCompetitorTag', 'LongSouthernCompetitorTag'],
      characters: [
        ['Unlisted fighter one', 'Unlisted fighter two'],
        ['Another fighter one', 'Another fighter two'],
      ],
      tournament: 'Regional Championship #2026',
    })
  );
  expect(result.title).toContain(
    'LongNorthernCompetitorTag vs LongSouthernCompetitorTag'
  );
  expect(result.title).not.toContain('chars');
  expect(getVideoTitleError(result.title)).toBeNull();
});

it('does not guess aliases for unknown characters', () => {
  const result = generateSetTitle(
    fields({
      characters: [['constructor'], ['A mystery fighter']],
      round: 'Winners Quarter-Final',
      tournament: 'The very long regional tournament',
    })
  );
  expect(result.title).toContain('(constructor)');
  expect(result.title).toContain('(A mystery fighter)');
  expect(getVideoTitleError(result.title)).toBeNull();
});

it.each(['#128', 'X2', '２０２６'])(
  'retains a trailing event edition %s',
  (edition) => {
    const result = generateSetTitle(
      fields({
        tournament: `${'Midnight Summit Regional Championship '.repeat(
          5
        )}${edition}`,
      })
    );
    expect(result.title).toContain('Midnight Summit');
    expect(result.title).toContain(edition);
    expect(getVideoTitleError(result.title)).toBeNull();
  }
);

it('marks a pathological indivisible grapheme instead of splitting it', () => {
  const result = generateSetTitle(
    fields({ players: [`e${'\u0301'.repeat(200)}`, 'Opponent'] })
  );
  expect(result.title).toContain('~ vs Opponent');
  expect(result.originalTitle).toContain(`e${'\u0301'.repeat(200)}`);
  expect(getVideoTitleError(result.title)).toBeNull();
});

it.each(['😀', 'e\u0301', '👩🏽‍💻', '🇨🇦', '家'])(
  'shortens %s only at grapheme boundaries within a code-point budget',
  (grapheme) => {
    const result = generateSetTitle(
      fields({
        players: [grapheme.repeat(80), 'Opponent'],
        tournament: 'Spring Cup #12',
      })
    );
    const tag = result.title.split(' vs ')[0];
    expect(tag).toMatch(/~$/);
    const prefix = tag.slice(0, -1);
    expect(prefix.length).toBeGreaterThan(0);
    expect(prefix).toBe(grapheme.repeat(prefix.length / grapheme.length));
    expect(result.title).toContain('Opponent');
    expect(getVideoTitleError(result.title)).toBeNull();
  }
);

it('leaves invalid source punctuation visible for normal validation', () => {
  const result = generateSetTitle(
    fields({ players: ['<Player A>', 'Player B'] })
  );
  expect(getVideoTitleError(result.title)).toContain('cannot contain');
});
