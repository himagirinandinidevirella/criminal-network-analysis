import { Fingerprint } from "lucide-react";
import { useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import type { RootState } from "@/store";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/Common/Tabs";
import FileFingerprintVerifier from "@/components/Fingerprints/FileFingerprintVerifier";
import DeviceFingerprintVerifier from "@/components/Fingerprints/DeviceFingerprintVerifier";

export default function FingerprintVerification() {
  const user = useSelector((state: RootState) => state.auth.user);
  const [params] = useSearchParams();
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-wide text-teal">
          <Fingerprint className="h-4 w-4" />
          Verification tools
        </p>
        <h1 className="dossier-title mt-2 text-3xl font-bold">
          Fingerprint Verification
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Two distinct tools: verify a file’s integrity or request device
          biometric/passkey verification. Neither identifies people from
          fingerprint images or searches criminal records.
        </p>
      </div>
      <Tabs defaultValue={params.get("tab") === "device" ? "device" : "file"}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="file">File fingerprints</TabsTrigger>
          <TabsTrigger value="device">Device biometrics</TabsTrigger>
        </TabsList>
        <TabsContent value="file">
          <FileFingerprintVerifier />
        </TabsContent>
        <TabsContent value="device">
          {user ? (
            <DeviceFingerprintVerifier
              key={String(user.id)}
              accountId={String(user.id)}
              displayName={user.name}
            />
          ) : (
            <p className="glass rounded-xl p-5 text-sm text-ink-soft">
              Sign in with a profile before registering a device.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
