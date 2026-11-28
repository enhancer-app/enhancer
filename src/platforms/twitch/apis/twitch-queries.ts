export const ChattersQuery = `query GetChannelChattersCount($name: String!) {
        channel(name: $name) {
            chatters {
                count
            }
        }
    }`;

export const CurrentUserFollowsQuery = `query EnhancerCurrentUserFollows($first: Int, $after: Cursor) {
    currentUser {
        id
        follows(first: $first, after: $after) {
            edges {
                cursor
                node {
                    id
                    login
                    displayName
                    profileImageURL(width: 70)
                }
            }
            pageInfo {
                hasNextPage
            }
        }
    }
}`;

export const UsersByIdsQuery = `query EnhancerUsersByIds($ids: [ID!]) {
    users(ids: $ids) {
        id
        login
    }
}`;

export const VideoCreatedAtQuery = `query GetVideoCreatedAt($id: ID!) {
    video(id: $id) {
        createdAt
    }
}`;
