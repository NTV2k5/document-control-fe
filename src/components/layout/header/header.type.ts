export interface IHeaderProps {
  isSidebarCollapsed?: boolean;
  onSidebarCollapsedChange?: (collapsed: boolean) => void;
}

export interface ISpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

export interface ISpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

export interface ISpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((this: ISpeechRecognitionInstance, ev: Event) => any) | null;
  onresult: ((this: ISpeechRecognitionInstance, ev: ISpeechRecognitionEvent) => any) | null;
  onerror: ((this: ISpeechRecognitionInstance, ev: ISpeechRecognitionErrorEvent) => any) | null;
  onend: ((this: ISpeechRecognitionInstance, ev: Event) => any) | null;
}

export type TSpeechRecognitionConstructor = new () => ISpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: TSpeechRecognitionConstructor;
    webkitSpeechRecognition?: TSpeechRecognitionConstructor;
  }
}
