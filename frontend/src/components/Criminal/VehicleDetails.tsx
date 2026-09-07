/**
 * VehicleDetails — vehicles owned/used by a criminal.
 */
import { Car, Bike, Truck } from "lucide-react";
import type { Vehicle } from "@/types/criminal.types";

interface Props {
  vehicles: Vehicle[];
}

const TYPE_ICON: Record<string, typeof Car> = {
  CAR: Car,
  BIKE: Bike,
  TRUCK: Truck,
  AUTO: Truck,
  BOAT: Truck,
};

export default function VehicleDetails({ vehicles }: Props) {
  if (vehicles.length === 0) {
    return (
      <div className="glass rounded-2xl p-8 text-center text-sm text-text-muted">
        No vehicles on record.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {vehicles.map((v) => {
        const Icon = TYPE_ICON[v.type] ?? Car;
        return (
          <div key={v.id} className="glass rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-bg-tertiary">
                <Icon className="h-5 w-5 text-accent-cyan" />
              </div>
              <div className="min-w-0">
                <p className="font-mono text-sm font-semibold">{v.registration_number}</p>
                <p className="text-xs text-text-secondary">
                  {[v.make, v.model, v.color, v.year].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span
                className={`rounded-full px-2 py-0.5 font-semibold ${
                  v.seized ? "bg-risk-critical/15 text-risk-critical" : "bg-risk-low/10 text-risk-low"
                }`}
              >
                {v.seized ? "SEIZED" : "ACTIVE"}
              </span>
              {v.used_in_crimes?.length > 0 && (
                <span className="text-text-muted">Used in: {v.used_in_crimes.join(", ")}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
