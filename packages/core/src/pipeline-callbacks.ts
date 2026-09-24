export interface PipelineCallbacks {
  onLog?: (line: string) => void;
  onProgress?: (current: number, total: number) => void;
}

/** Always does console.log (same as the classic CLI) and additionally, if there's a callback, passes it the line. */
export function makeLogger(callbacks?: PipelineCallbacks): (line: string) => void {
  return (line: string) => {
    console.log(line);
    callbacks?.onLog?.(line);
  };
}

export function reportProgress(callbacks: PipelineCallbacks | undefined, current: number, total: number): void {
  callbacks?.onProgress?.(current, total);
}
