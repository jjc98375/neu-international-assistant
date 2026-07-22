export function sortConversations<T extends { pinned: boolean; updatedAt: string | Date }>(list: T[]): T[] {
  return [...list].sort((a, b) =>
    Number(b.pinned) - Number(a.pinned) ||
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}
