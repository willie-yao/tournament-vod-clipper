import { gql } from '@apollo/client';

export const GET_SETS_AT_STATION = gql`
  query SetsAtStation($eventId: String!, $stationNumbers: [Int], $page: Int!) {
    event(slug: $eventId) {
      id
      name
      tournament {
        name
      }
      sets(
        page: $page
        perPage: 20
        filters: { stationNumbers: $stationNumbers }
      ) {
        pageInfo {
          totalPages
        }
        nodes {
          id
          station {
            id
            number
          }
          slots {
            id
            entrant {
              id
              name
            }
          }
          startedAt
          completedAt
          fullRoundText
          games {
            selections {
              selectionValue
              selectionType
              entrant {
                id
              }
            }
          }
        }
      }
    }
  }
`;

export const GET_SETS_AT_STREAM_STATION = gql`
  query SetsAtStreamStation($eventId: String!, $page: Int!) {
    event(slug: $eventId) {
      id
      name
      tournament {
        name
      }
      sets(page: $page, perPage: 20) {
        pageInfo {
          totalPages
        }
        nodes {
          id
          station {
            id
            number
          }
          slots {
            id
            entrant {
              id
              name
            }
          }
          startedAt
          completedAt
          fullRoundText
          games {
            selections {
              selectionValue
              selectionType
              entrant {
                id
              }
            }
          }
          stream {
            streamName
          }
        }
      }
    }
  }
`;

export const GET_ALL_SETS_AT_EVENT = gql`
  query SetsAtStation($eventId: String!) {
    event(slug: $eventId) {
      id
      name
      tournament {
        name
      }
      sets {
        nodes {
          id
          station {
            id
            number
          }
          slots {
            id
            entrant {
              id
              name
            }
          }
          startedAt
          completedAt
          fullRoundText
          games {
            selections {
              selectionValue
              selectionType
              entrant {
                id
              }
            }
          }
        }
      }
    }
  }
`;

export const GET_ALL_CHARACTERS = gql`
  query VideogamesQuery($gameid: ID) {
    videogame(id: $gameid) {
      characters {
        id
        name
      }
    }
  }
`;

const TOURNAMENT_EVENTS = gql`
  fragment TournamentEvents on Tournament {
    id
    name
    startAt
    events {
      id
      name
      slug
      videogame {
        id
        displayName
      }
    }
  }
`;

export const GET_YOUR_TOURNAMENTS = gql`
  query YourTournaments {
    currentUser {
      id
      tournaments(query: { page: 1, perPage: 6, sortBy: "startAt desc" }) {
        nodes {
          ...TournamentEvents
        }
      }
    }
    organizing: tournaments(
      query: {
        page: 1
        perPage: 6
        sortBy: "startAt desc"
        filter: { isCurrentUserAdmin: true }
      }
    ) {
      nodes {
        ...TournamentEvents
      }
    }
  }
  ${TOURNAMENT_EVENTS}
`;

// start.gg matches any word of the name, so pull relevance-ranked and newest
// matches for the client to rank.
export const SEARCH_TOURNAMENT_NAMES = gql`
  query SearchTournamentNames($name: String!) {
    scored: tournaments(
      query: {
        page: 1
        perPage: 50
        sortBy: "startAt desc"
        filter: { name: $name, sortByScore: true }
      }
    ) {
      nodes {
        id
        name
        startAt
      }
    }
    recent: tournaments(
      query: {
        page: 1
        perPage: 50
        sortBy: "startAt desc"
        filter: { name: $name }
      }
    ) {
      nodes {
        id
        name
        startAt
      }
    }
  }
`;

export const GET_TOURNAMENTS_BY_ID = gql`
  query TournamentsById($ids: [ID], $perPage: Int!) {
    tournaments(query: { page: 1, perPage: $perPage, filter: { ids: $ids } }) {
      nodes {
        ...TournamentEvents
      }
    }
  }
  ${TOURNAMENT_EVENTS}
`;

export const GET_TOURNAMENT_EVENTS = gql`
  query TournamentEventsBySlug($slug: String!) {
    tournament(slug: $slug) {
      ...TournamentEvents
    }
  }
  ${TOURNAMENT_EVENTS}
`;
