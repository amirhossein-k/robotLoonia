// app/telegram/activeChats.ts
export const activeChats = new Map<number, number>();

export function isUserInChat(userId: number) {
    return activeChats.has(userId);
}

export function startChat(user1: number, user2: number) {
    activeChats.set(user1, user2);
    activeChats.set(user2, user1);
}

export function endChat(userId: number) {
    const partnerId = activeChats.get(userId);
    if (!partnerId) return;
    activeChats.delete(userId);
    activeChats.delete(partnerId);
    return partnerId;
}
