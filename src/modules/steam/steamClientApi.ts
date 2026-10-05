import { invoke } from "@tauri-apps/api/core";

export type SteamClientWindow = {
  windowId: string;
  pid: number | null;
  title: string;
  launched: boolean;
};

export function findOrLaunchSteamClient(): Promise<SteamClientWindow> {
  return invoke<SteamClientWindow>("steam_client_find_or_launch");
}
