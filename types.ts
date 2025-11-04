
export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

export interface ViewElementWord extends WordTiming {
  type: 'word';
  originalIndex: number;
}
export interface ViewElementWhitespace {
  type: 'whitespace';
  content: string;
}
export type ViewElement = ViewElementWord | ViewElementWhitespace;
