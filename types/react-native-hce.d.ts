declare module 'react-native-hce' {
  export enum NFCTagType4NDEFContentType {
    Text = 'text',
    URI = 'uri'
  }

  export interface NFCTagType4Config {
    type: NFCTagType4NDEFContentType;
    content: string;
    writable: boolean;
  }

  export class NFCTagType4 {
    constructor(config: NFCTagType4Config);
  }

  export class HCESession {
    static getInstance(): Promise<HCESession>;
    setApplication(tag: NFCTagType4): void;
    setEnabled(enabled: boolean): Promise<void>;
    on(event: string, callback: () => void): () => void;
    
    static Events: {
      HCE_STATE_READ: string;
    };
  }
}
