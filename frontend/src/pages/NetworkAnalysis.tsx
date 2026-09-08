import ErrorState from "@/components/Common/ErrorState";
import { useSearchParams } from "react-router-dom";
/**
 * Network Analysis page — the core interactive criminal network explorer.
 */
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store";
import { fetchFullGraph, fetchCommunities } from "@/store/networkSlice";
import CriminalNetworkMap from "@/components/NetworkGraph/CriminalNetworkMap";
import NodeDetailsPanel from "@/components/NetworkGraph/NodeDetailsPanel";
import PathFinder from "@/components/NetworkGraph/PathFinder";
import CommunityView from "@/components/NetworkGraph/CommunityView";
import WhatIfSimulator from "@/components/NetworkGraph/WhatIfSimulator";
import { registerGraphExtensions } from "@/hooks/useNetworkGraph";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/Common/Tabs";

export default function NetworkAnalysis() {
  const dispatch = useDispatch<AppDispatch>();
  const graph = useSelector((state: RootState) => state.network.graph);
  const error = useSelector((state: RootState) => state.network.error);
  const [params] = useSearchParams();
  const loading = useSelector((state: RootState) => state.network.loading);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    params.get("node"),
  );
  useEffect(() => {
    setSelectedNodeId(params.get("node"));
  }, [params]);
  const filtersRef = useRef<Record<string, unknown>>({});

  useEffect(() => {
    registerGraphExtensions();
    dispatch(fetchFullGraph({}));
    dispatch(fetchCommunities());
  }, [dispatch]);

  const handleFilterChange = (filters: Record<string, unknown>) => {
    filtersRef.current = { ...filtersRef.current, ...filters };
    dispatch(fetchFullGraph(filtersRef.current));
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Network Analysis</h1>
        <p className="text-sm text-text-secondary">
          Interactive knowledge graph of persons, organizations, vehicles,
          accounts &amp; locations
        </p>
      </div>

      {error && (
        <ErrorState
          message={error}
          onRetry={() => dispatch(fetchFullGraph(filtersRef.current))}
        />
      )}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {/* Graph canvas */}
        <div className="xl:col-span-3">
          <CriminalNetworkMap
            graph={graph}
            loading={loading}
            selectedNodeId={selectedNodeId}
            onNodeSelect={setSelectedNodeId}
            onFilterChange={handleFilterChange}
          />
        </div>

        {/* Right rail: details + tools */}
        <div className="space-y-4">
          <NodeDetailsPanel nodeId={selectedNodeId} />

          <Tabs defaultValue="path">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="path">Path</TabsTrigger>
              <TabsTrigger value="community">Gangs</TabsTrigger>
              <TabsTrigger value="whatif">What-If</TabsTrigger>
            </TabsList>
            <TabsContent value="path">
              <PathFinder />
            </TabsContent>
            <TabsContent value="community">
              <CommunityView />
            </TabsContent>
            <TabsContent value="whatif">
              <WhatIfSimulator />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
