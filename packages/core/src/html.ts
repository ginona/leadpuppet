const MAX_HTML_CHARS = 20000;

export function cleanHtml(html: string): string {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    // Never rendered to visitors, a common place to hide injected instructions.
    .replace(/<(template|svg|iframe|object|embed)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned.slice(0, MAX_HTML_CHARS);
}
