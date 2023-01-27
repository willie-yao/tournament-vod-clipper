import { gql } from '@apollo/client';

export const GET_SETS_AT_STATION = gql`
  query SetsAtStation($eventId: String!, $stationNumbers: [Int]) {
    event(slug: $eventId) {
      id
      name
      sets(
        filters: {
        stationNumbers: $stationNumbers
      }) {
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
          games {
            selections {
              selectionValue
              selectionType
            }
          }
        }
      }
    }
  }
`

export const GET_ALL_SETS_AT_EVENT = gql`
  query SetsAtStation($eventId: String!) {
    event(slug: $eventId) {
      id
      name
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
            }
          }
        }
      }
    }
  }
`

