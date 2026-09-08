import { validateCCTVRecording } from "./cctvUtils";

export interface CCTVRecording {
  instance_id: string;
  name: string;
  url: string;
  kind: "local" | "sample";
}
export interface RecordingAssignment {
  slotId: string;
  file: File;
}

/** Validate the entire selection before replacing anything. A maximum of four independent views. */
export function planCCTVRecordings(
  files: File[],
  slotIds: string[],
  selectedId: string,
): RecordingAssignment[] {
  if (files.length > slotIds.length)
    throw new Error(
      `Choose up to ${slotIds.length} recordings, one per camera view.`,
    );
  for (const file of files) {
    const error = validateCCTVRecording(file);
    if (error) throw new Error(`${file.name}: ${error}`);
  }
  const index = Math.max(0, slotIds.indexOf(selectedId));
  const order = [...slotIds.slice(index), ...slotIds.slice(0, index)];
  return files.map((file, i) => ({ slotId: order[i], file }));
}

/** Keep temporary recording data out of Redux and localStorage. */
export class CCTVRecordingRegistry {
  private entries: Record<string, CCTVRecording> = {};
  get records() {
    return { ...this.entries };
  }
  install(assignments: RecordingAssignment[]) {
    const created: Record<string, CCTVRecording> = {};
    try {
      for (const { slotId, file } of assignments)
        created[slotId] = {
          instance_id: crypto.randomUUID(),
          name: file.name,
          url: URL.createObjectURL(file),
          kind: "local",
        };
    } catch (error) {
      Object.values(created).forEach((record) =>
        URL.revokeObjectURL(record.url),
      );
      throw error;
    }
    for (const [slot, recording] of Object.entries(created)) {
      this.remove(slot);
      this.entries[slot] = recording;
    }
    return this.records;
  }
  sample(slotId: string) {
    this.remove(slotId);
    this.entries[slotId] = {
      instance_id: `sample:${slotId}:v1`,
      name: "AI-generated face test clip",
      url: "/demo/cctv-face-sample.webm",
      kind: "sample",
    };
    return this.records;
  }
  remove(slotId: string) {
    const previous = this.entries[slotId];
    if (previous?.kind === "local") URL.revokeObjectURL(previous.url);
    delete this.entries[slotId];
    return this.records;
  }
  dispose() {
    Object.keys(this.entries).forEach((slotId) => this.remove(slotId));
  }
}
