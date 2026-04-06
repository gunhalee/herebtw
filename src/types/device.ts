type PermissionMode = "unknown" | "granted" | "denied";

type DeviceState = {
  anonymousDeviceId: string | null;
  deviceReady: boolean;
  permissionMode: PermissionMode;
  readOnlyMode: boolean;
};

export type AppShellState = DeviceState & {
  selectedDongCode: string | null;
  selectedDongName: string | null;
};
