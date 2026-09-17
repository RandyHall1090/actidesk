/**
 * Replaces {{first_name}}, {{company}}, {{full_name}} tokens in a letter
 * template with a specific contact's real values. Unknown tokens are left
 * as-is (visibly wrong, not silently dropped) rather than guessed at.
 */
export function applyMergeFields(
  template: string,
  contact: { name: string; email: string; company?: string },
): string {
  const firstName = contact.name.split(" ")[0] ?? contact.name;
  return template
    .replaceAll("{{first_name}}", firstName)
    .replaceAll("{{full_name}}", contact.name)
    .replaceAll("{{company}}", contact.company ?? "");
}
