/** Only in-app paths are followed (never external URLs from notification payloads). */
export function safeNotificationLink(link: string | null): string | null {
  return link && link.startsWith('/') && !link.startsWith('//') ? link : null;
}
