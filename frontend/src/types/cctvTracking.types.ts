/** Operator-linked events, not person identities or automatic camera handoffs. */
export type CCTVMomentSourceKind = "simulation" | "local" | "sample";
export interface CCTVMomentSource {
  source_kind: CCTVMomentSourceKind;
  source_instance: string;
}
export interface CCTVMomentDraft extends CCTVMomentSource {
  draft_id: string;
  camera_id: string;
  camera_name: string;
  playback_seconds: number;
}
export interface CCTVMomentRequest extends CCTVMomentSource {
  camera_id: string;
  playback_seconds: number;
  note: string;
  manual_association: boolean;
}
export interface CCTVTrackingMoment extends CCTVMomentSource {
  id: string;
  camera_id: string;
  camera_name: string;
  playback_seconds: number;
  note: string;
  created_at: string;
  association: "MANUAL_UNVERIFIED";
}
export interface CCTVTrackingTrail {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  moments: CCTVTrackingMoment[];
}
