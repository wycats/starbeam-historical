import { Stack } from "@starbeam/debug-utils";
import type { UnsafeAny } from "@starbeam/fundamental";
import { LocationScope } from "./trace.js";

Error.stackTraceLimit = Infinity;

export const FRAMES_TO_REMOVE = 3;
const FRAME_START = "    at ";

export let CURRENT_FRAMES_TO_REMOVE: number | null = FRAMES_TO_REMOVE;

export class Abstraction {
  static default(): Abstraction {
    return new Abstraction(null);
  }

  static start(): number | null {
    return ABSTRACTION.#start(2);
  }

  static end(start: number | null, error: Error): never;
  static end(start: number | null): void;
  static end(start: number | null, error?: Error): void {
    return ABSTRACTION.#end(start, error);
  }

  static callerFrame(
    { extraFrames = 0 }: { extraFrames: number } = { extraFrames: 0 }
  ): string {
    let stack = Abstraction.#stack(3 + extraFrames);
    return stack.split("\n")[0].trimStart();
  }

  static callerScope(internal = 0): LocationScope | undefined {
    return LocationScope.create(Stack.callerFrame(internal + 1));
  }

  static #stack(frames = 1): string {
    let abstraction = new Abstraction(frames);

    try {
      throw Error(`capturing stack`);
    } catch (e) {
      return parse(abstraction.#error(null, e as Error)).stack;
    }
  }

  static #buildError(frames: number, message: string): Error {
    let start = ABSTRACTION.#start(frames);

    try {
      throw Error(message);
    } catch (e) {
      return ABSTRACTION.#error(start, e as Error);
    }
  }

  static throw(message: string): never {
    throw Abstraction.#buildError(2, message);
  }

  // static eraseFrame(callback: () => void): void {

  // }

  static not(callback: () => void, _frames?: number): void {
    callback();
  }

  static throws(callback: () => void, frames = 1): void {
    let stack = Abstraction.#stack(frames);

    try {
      callback();
    } catch (e) {
      let header = parse(e as Error).header;
      (e as Error).stack = `${header}\n${stack}`;
      throw e;
    }
  }

  static wrap<T>(callback: () => T, frames = 2): T {
    let start = ABSTRACTION.#start(frames);

    try {
      let result = callback();
      ABSTRACTION.#end(start);
      return result;
    } catch (e) {
      throw ABSTRACTION.#error(start, e as Error);
    }
  }

  #currentFrames: number | null;

  private constructor(currentFrames: number | null) {
    this.#currentFrames = currentFrames;
  }

  #start(frames: number): number | null {
    let prev = this.#currentFrames;

    if (this.#currentFrames === null) {
      this.#currentFrames = frames + 1;
    } else {
      this.#currentFrames += frames;
    }

    return prev;
  }

  #end(prevFrames: number | null, error: Error): never;
  #end(prevFrames: number | null): void;
  #end(prevFrames: number | null, error?: Error): void;
  #end(prevFrames: number | null, error?: Error): void {
    let filtered = this.#error(prevFrames, error);

    if (filtered) {
      throw filtered;
    }
  }

  #error(prevFrames: number | null): void;
  #error(prevFrames: number | null, error: Error): Error;
  #error(prevFrames: number | null, error?: Error): Error | void;
  #error(prevFrames: number | null, error?: Error): Error | void {
    // Only filter once, at the top
    if (prevFrames !== null) {
      return error;
    }

    let framesToFilter = this.#currentFrames;

    if (framesToFilter === null) {
      throw Error(`Unexpected: unbalanced start and end in Abstraction`);
    }

    this.#currentFrames = prevFrames;

    if (error) {
      return this.#filter(framesToFilter, error);
    }
  }

  #filter(currentFrames: number, error: Error): Error {
    let filteredError: Error = error as UnsafeAny;

    // console.log(`[FILTERING] ${currentFrames} frames`);
    // console.log(`[ORIGINAL] ${error.stack}`);

    if (error.stack === undefined) {
      throw Error(`Unexpected: missing error.stack`);
    }

    let lines = error.stack.split("\n");

    let removed = 0;

    let filtered: string[] = [];

    for (let line of lines) {
      if (!line.startsWith(FRAME_START)) {
        filtered.push(line);
      } else if (removed++ >= currentFrames) {
        filtered.push(line);
      }
    }

    filteredError.stack = filtered.join("\n");

    // console.log(`[FILTERED] ${filteredError.stack}`);

    return filteredError;
  }
}

const ABSTRACTION = Abstraction.default();

function parse(error: Error): { header: string; stack: string } {
  let lines = (error.stack as string).split("\n");
  let headerDone = false;

  let header = [];
  let stack = [];

  for (let line of lines) {
    if (headerDone) {
      stack.push(line);
    } else {
      if (line.startsWith(FRAME_START)) {
        headerDone = true;
        stack.push(line);
      } else {
        header.push(line);
      }
    }
  }

  return { header: header.join("\n"), stack: stack.join("\n") };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function abstractify<F extends (...args: any[]) => any>(f: F): F {
  return ((...args: Parameters<F>): ReturnType<F> => {
    let start = Abstraction.start();

    try {
      let result = f(...args);
      Abstraction.end(start);
      return result;
    } catch (e) {
      Abstraction.end(start, e as Error);
    }
  }) as F;
}

interface FrameParts {
  readonly tag?: string;
  readonly pkg: string;
  readonly file: string;
  readonly loc?: {
    readonly line: string;
    readonly column: string;
  };
}

function parseFrame(frame: string): FrameParts | undefined {
  let parts = frame.match(
    /^at (?:(?<tag>.*) )?[(]?.*(?<starbeam>@starbeam)[/\\](?<pkg>[^/\\]*)[/\\]dist[/\\]src[/\\](?<file>[^\.]*)[^:]*(?:[:](?<line>[^:)]*)[:](?<column>[^:)]*))[)]?$/
  );

  if (parts === null) {
    parts = frame.match(
      /^at (?:(?<tag>.*) )?[(].*(?<file>[^\./\\]*)[^:]*(?:[:](?<line>[^:)]*)[:](?<column>[^:)]*))[)]$/
    );
  }

  const groups = parts?.groups;

  if (groups === undefined) {
    console.warn(
      `Expected caller frame to be in the format of a stack frame, but it was \`${frame}\``
    );
    return;
  } else {
    return {
      tag: groups.tag,
      pkg: groups.starbeam ? `@starbeam/${groups.pkg}` : "(app)",
      file: groups.file,
      loc:
        groups.line && groups.column
          ? { line: groups.line, column: groups.column }
          : undefined,
    };
  }
}
