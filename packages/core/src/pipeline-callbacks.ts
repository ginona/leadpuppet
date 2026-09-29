export interface PipelineCallbacks {
  onLog?: (line: string) => void;
  onProgress?: (current: number, total: number) => void;
}

// C0/C1 control characters (except tab and newline) and Unicode bidi overrides.
// Log lines embed third-party data (business names from Places, scraped
// emails): an ESC sequence there could rewrite or hide terminal output.
const UNSAFE_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g;

export function sanitizeLogLine(line: string): string {
  return line.replace(UNSAFE_CHARS, '');
}

/** Always does console.log (same as the classic CLI) and additionally, if there's a callback, passes it the line. */
export function makeLogger(callbacks?: PipelineCallbacks): (line: string) => void {
  return (line: string) => {
    const safe = sanitizeLogLine(line);
    console.log(safe);
    callbacks?.onLog?.(safe);
  };
}

export function reportProgress(callbacks: PipelineCallbacks | undefined, current: number, total: number): void {
  callbacks?.onProgress?.(current, total);
}
