/**
 * Investigation page — intelligent search + FIR auto-analysis.
 */
import { useSearchParams } from "react-router-dom";
import IntelligentSearch from "@/components/Search/IntelligentSearch";

export default function Investigation() {
  const [params] = useSearchParams();
  const initialQuery = params.get("q") ?? "";

  return <IntelligentSearch initialQuery={initialQuery} />;
}
