import { registerPlugin } from '@capacitor/core';

export interface LocalUpdateStatus {
  active: boolean;
  path: string;
}

export interface LocalUpdatePlugin {
  pickUpdatePackage(): Promise<LocalUpdateStatus>;
  pickUpdateFolder(): Promise<LocalUpdateStatus>;
  getStatus(): Promise<LocalUpdateStatus>;
  clearUpdate(): Promise<void>;
}

export const LocalUpdate = registerPlugin<LocalUpdatePlugin>('LocalUpdate');