declare module 'react-native-nfc-manager' {
  export interface NfcTech {
    Ndef: string;
    NfcA: string;
    NfcB: string;
    NfcF: string;
    NfcV: string;
    IsoDep: string;
    MifareClassic: string;
    MifareUltralight: string;
  }

  export interface Ndef {
    TNF_EMPTY: number;
    TNF_WELL_KNOWN: number;
    TNF_MIME_MEDIA: number;
    TNF_ABSOLUTE_URI: number;
    TNF_EXTERNAL_TYPE: number;
    TNF_UNKNOWN: number;
    TNF_UNCHANGED: number;
    RTD_TEXT: Uint8Array;
    RTD_URI: Uint8Array;
    RTD_SMART_POSTER: Uint8Array;
    RTD_ALTERNATIVE_CARRIER: Uint8Array;
    RTD_HANDOVER_CARRIER: Uint8Array;
    RTD_HANDOVER_REQUEST: Uint8Array;
    RTD_HANDOVER_SELECT: Uint8Array;

    getCachedNdefMessage(): Promise<NdefMessage>;
    writeNdefMessage(bytes: number[]): Promise<void>;
    makeNdefRecord(tnf: number, type: number[], id: number[], payload: number[]): number[];
    makeNdefTextRecord(text: string, locale?: string, id?: number[]): number[];
    makeNdefUriRecord(uri: string, id?: number[]): number[];
  }

  export interface NdefMessage {
    records: NdefRecord[];
    ndefMessage?: NdefRecord[];
  }

  export interface NdefRecord {
    id: number[];
    type: number[];
    payload: number[];
    tnf: number;
  }

  export interface Tag {
    id: number[];
    techTypes: string[];
  }

  export interface NfcManager {
    start(): Promise<void>;
    stop(): Promise<void>;
    isSupported(): Promise<boolean>;
    isEnabled(): Promise<boolean>;
    goToNfcSetting(): Promise<void>;
    getLaunchTagEvent(): Promise<Tag | null>;
    setEventListener(event: string, listener: (tag: Tag) => void): void;
    requestTechnology(tech: string): Promise<void>;
    cancelTechnologyRequest(): Promise<void>;
    getTag(): Promise<Tag>;
    getNdefMessage(): Promise<NdefMessage>;
    writeNdefMessage(bytes: number[]): Promise<void>;
    connect(): Promise<void>;
    close(): Promise<void>;
  }

  const NfcManager: NfcManager;
  const NfcTech: NfcTech;
  const Ndef: Ndef;

  export default NfcManager;
  export { NfcTech, Ndef };
}
