import { useEffect, useRef, useState } from 'react';
import { Autocomplete, TextField } from '@mui/material';
import { useApolloClient } from '@apollo/client';
import {
  GET_TOURNAMENT_EVENTS,
  GET_YOUR_TOURNAMENTS,
  SEARCH_TOURNAMENTS,
} from '../common/StartggQueries';
import startggRequest from '../common/startggRequest';
import {
  isStartggReference,
  normalizeEventSlug,
  tournamentSlug,
} from '../common/sourceInput';

interface TournamentNode {
  id: string;
  name: string;
  startAt: number | null;
  events:
    | {
        id: string;
        name: string;
        slug: string;
        videogame: { displayName: string } | null;
      }[]
    | null;
}

interface EventOption {
  slug: string;
  name: string;
  game: string;
  tournament: string;
  group: string;
}

type Lookup = { key: string; status: 'loading' | 'done' | 'error' };

const SEARCH_DELAY_MS = 350;
const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function eventOptions(tournaments: (TournamentNode | null | undefined)[]) {
  const unique = new Map<string, TournamentNode>();
  tournaments.forEach((t) => {
    if (t && !unique.has(t.id)) unique.set(t.id, t);
  });
  return [...unique.values()]
    .sort((a, b) => (b.startAt ?? 0) - (a.startAt ?? 0))
    .flatMap((tournament) => {
      const group = tournament.startAt
        ? `${tournament.name} · ${dateFormat.format(tournament.startAt * 1000)}`
        : tournament.name;
      return (tournament.events ?? []).map((event) => ({
        slug: event.slug,
        name: event.name,
        game: event.videogame?.displayName ?? '',
        tournament: tournament.name,
        group,
      }));
    });
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error?: string;
  disabled: boolean;
  /** Saved API key; search is off without one and results reset when it changes. */
  apiKey: string;
}

const EventField = ({
  value,
  onChange,
  onBlur,
  error,
  disabled,
  apiKey,
}: Props) => {
  const client = useApolloClient();
  const [focused, setFocused] = useState(false);
  const [selected, setSelected] = useState<EventOption | null>(null);
  const [recents, setRecents] = useState<
    (Lookup & { options: EventOption[] }) | null
  >(null);
  const recentsLoad = useRef<{ key: string; controller: AbortController }>();
  const [results, setResults] = useState<
    (Lookup & { options: EventOption[] }) | null
  >(null);

  // Decide whether the input is a link, a tournament to expand or a search.
  const canSearch = !!apiKey;
  const trimmed = value.trim();
  const tournament = tournamentSlug(value);
  let kind: 'none' | 'recent' | 'search' | 'tournament' = 'none';
  if (canSearch) {
    if (tournament) kind = 'tournament';
    else if (!isStartggReference(value))
      kind = trimmed.length >= 3 ? 'search' : 'recent';
  }
  const lookupKey =
    kind === 'search' || kind === 'tournament'
      ? `${kind}:${tournament ?? trimmed}`
      : '';

  useEffect(() => {
    if (!focused || !canSearch || recentsLoad.current?.key === apiKey) return;
    recentsLoad.current?.controller.abort();
    const load = { key: apiKey, controller: new AbortController() };
    recentsLoad.current = load;
    setRecents({ key: apiKey, status: 'loading', options: [] });
    const loadRecents = async () => {
      try {
        const { data } = await startggRequest<{
          currentUser: {
            tournaments: { nodes: TournamentNode[] } | null;
          } | null;
          organizing: { nodes: TournamentNode[] } | null;
        }>(client, { query: GET_YOUR_TOURNAMENTS }, load.controller.signal);
        if (recentsLoad.current !== load) return;
        setRecents({
          key: load.key,
          status: 'done',
          options: eventOptions([
            ...(data.organizing?.nodes ?? []),
            ...(data.currentUser?.tournaments?.nodes ?? []),
          ]),
        });
      } catch {
        if (recentsLoad.current !== load) return;
        // Failures are not cached, so the next focus retries.
        recentsLoad.current = undefined;
        setRecents({ key: load.key, status: 'error', options: [] });
      }
    };
    loadRecents();
  }, [focused, canSearch, apiKey, client]);

  useEffect(() => () => recentsLoad.current?.controller.abort(), []);

  useEffect(() => {
    if (!focused || !lookupKey) return undefined;
    const controller = new AbortController();
    setResults({ key: lookupKey, status: 'loading', options: [] });
    const timer = setTimeout(async () => {
      try {
        let options: EventOption[];
        if (kind === 'tournament') {
          const { data } = await startggRequest<{
            tournament: TournamentNode | null;
          }>(
            client,
            { query: GET_TOURNAMENT_EVENTS, variables: { slug: tournament } },
            controller.signal
          );
          options = eventOptions([data.tournament]);
        } else {
          const { data } = await startggRequest<{
            tournaments: { nodes: TournamentNode[] } | null;
          }>(
            client,
            { query: SEARCH_TOURNAMENTS, variables: { name: trimmed } },
            controller.signal
          );
          options = eventOptions(data.tournaments?.nodes ?? []);
        }
        if (!controller.signal.aborted)
          setResults({ key: lookupKey, status: 'done', options });
      } catch {
        if (!controller.signal.aborted)
          setResults({ key: lookupKey, status: 'error', options: [] });
      }
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // kind, tournament and trimmed are encoded in lookupKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, lookupKey, client]);

  // Pick the options and status line for the current input.
  let options: EventOption[] = [];
  let status = '';
  if (kind === 'recent' && recents?.key === apiKey) {
    const needle = trimmed.toLowerCase();
    options = recents.options.filter(
      (option) =>
        !needle ||
        option.group.toLowerCase().includes(needle) ||
        option.name.toLowerCase().includes(needle)
    );
    if (recents.status === 'loading') status = 'Loading your tournaments...';
    else if (recents.status === 'error')
      status =
        'Could not load your tournaments. Search by name or paste an event link.';
    else if (!recents.options.length)
      status = 'No recent tournaments. Search by name or paste an event link.';
  } else if (lookupKey && results?.key === lookupKey) {
    options = results.options;
    if (results.status === 'loading') status = 'Searching start.gg...';
    else if (results.status === 'error')
      status = 'Search failed. Paste the event link instead.';
    else if (!options.length)
      status =
        kind === 'tournament'
          ? 'No events found for this tournament.'
          : 'No tournaments match.';
  }
  const picked =
    selected && selected.slug === normalizeEventSlug(value)
      ? `${selected.tournament} · ${selected.name}`
      : '';
  let helperText = picked || undefined;
  if (focused && status) helperText = status;
  else if (error) helperText = error;

  return (
    <Autocomplete
      freeSolo
      openOnFocus
      disabled={disabled}
      options={options}
      filterOptions={(all) => all}
      groupBy={(option) => option.group}
      getOptionLabel={(option) =>
        typeof option === 'string' ? option : option.slug
      }
      isOptionEqualToValue={(option, other) => option.slug === other.slug}
      value={null}
      inputValue={value}
      onInputChange={(_event, next) => onChange(next)}
      onChange={(_event, option) => {
        if (option && typeof option !== 'string') {
          setSelected(option);
          onChange(option.slug);
        }
      }}
      renderOption={(props, option) => (
        // MUI supplies the option's listbox props.
        // eslint-disable-next-line react/jsx-props-no-spreading
        <li {...props} key={option.slug}>
          <span className="event-option">
            <span>{option.name}</span>
            {option.game && <span className="muted">{option.game}</span>}
          </span>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          // eslint-disable-next-line react/jsx-props-no-spreading
          {...params}
          className="textfield"
          label="Start.gg event"
          required
          error={!!error && !(focused && status)}
          placeholder={
            canSearch
              ? 'Search tournaments or paste an event link'
              : 'Paste a start.gg event link'
          }
          helperText={helperText}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur();
          }}
        />
      )}
    />
  );
};

EventField.defaultProps = { error: undefined };

export default EventField;
