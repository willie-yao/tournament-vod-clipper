import { gql } from '@apollo/client';

export const GET_SETS_AT_STATION = gql`
  query SetsAtStation($eventId: String!, $stationNumbers: [Int]) {
    event(slug: $eventId) {
      id
      name
      tournament {
        name
      }
      sets(filters: { stationNumbers: $stationNumbers }) {
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
    videogame(id: $gameid){
      characters {
        id
        name
      }
    }
  }
`
