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
