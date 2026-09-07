/**
 * Criminal Profile page — tabbed interface for a single criminal.
 */
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import CriminalProfileView from "@/components/Criminal/CriminalProfile";

export default function CriminalProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-text-secondary transition hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      {id ? <CriminalProfileView criminalId={id} /> : <p>Criminal not found</p>}
    </div>
  );
}
