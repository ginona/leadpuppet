export interface PipelineCallbacks {
  onLog?: (line: string) => void;
  onProgress?: (current: number, total: number) => void;
}

/** Siempre hace console.log (igual que el CLI de siempre) y además, si hay callback, se lo pasa. */
export function makeLogger(callbacks?: PipelineCallbacks): (line: string) => void {
  return (line: string) => {
    console.log(line);
    callbacks?.onLog?.(line);
  };
}

export function reportProgress(callbacks: PipelineCallbacks | undefined, current: number, total: number): void {
  callbacks?.onProgress?.(current, total);
}
