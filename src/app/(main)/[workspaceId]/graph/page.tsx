"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/server/trpc/client";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type D3ZoomEvent } from "d3-zoom";
import "d3-transition";
import { Loader2, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

type GraphNode = SimulationNodeDatum & {
  id: string;
  title: string;
  icon: string | null;
};

type GraphLink = SimulationLinkDatum<GraphNode> & {
  source: string | GraphNode;
  target: string | GraphNode;
};

export default function GraphPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const { data: graphData, isLoading } = trpc.search.getPageGraph.useQuery(
    { workspaceId },
    { enabled: !!workspaceId },
  );

  // Measure container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // D3 simulation
  useEffect(() => {
    if (!graphData || !svgRef.current) return;

    const svg = select(svgRef.current);
    svg.selectAll("*").remove();

    const { width, height } = dimensions;

    const nodes: GraphNode[] = graphData.nodes.map((n) => ({
      ...n,
      x: Math.random() * width,
      y: Math.random() * height,
    }));

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    const links: GraphLink[] = graphData.edges
      .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))
      .map((e) => ({ source: e.source, target: e.target }));

    // Zoom behavior
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        gContainer.attr("transform", event.transform.toString());
      });

    svg.call(zoomBehavior);

    const gContainer = svg.append("g");

    // Links
    const linkSelection = gContainer
      .append("g")
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke", "var(--border-default)")
      .attr("stroke-width", 1)
      .attr("stroke-opacity", 0.6);

    // Nodes
    const nodeGroup = gContainer
      .append("g")
      .selectAll("g")
      .data(nodes)
      .enter()
      .append("g")
      .style("cursor", "pointer")
      .on("click", (_event, d) => {
        router.push(`/${workspaceId}/${d.id}`);
      })
      .on("mouseenter", (_event, d) => {
        setHoveredNode(d.id);
      })
      .on("mouseleave", () => {
        setHoveredNode(null);
      });

    // Node circles
    nodeGroup
      .append("circle")
      .attr("r", 8)
      .attr("fill", "#2383e2")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    // Node labels
    nodeGroup
      .append("text")
      .text((d) => d.title.length > 20 ? d.title.slice(0, 20) + "..." : d.title)
      .attr("x", 14)
      .attr("y", 4)
      .attr("font-size", "11px")
      .attr("fill", "var(--text-primary)")
      .attr("pointer-events", "none");

    // Simulation
    const simulation = forceSimulation(nodes)
      .force(
        "link",
        forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance(100),
      )
      .force("charge", forceManyBody().strength(-200))
      .force("center", forceCenter(width / 2, height / 2))
      .force("collide", forceCollide(30))
      .on("tick", () => {
        linkSelection
          .attr("x1", (d) => (d.source as GraphNode).x ?? 0)
          .attr("y1", (d) => (d.source as GraphNode).y ?? 0)
          .attr("x2", (d) => (d.target as GraphNode).x ?? 0)
          .attr("y2", (d) => (d.target as GraphNode).y ?? 0);

        nodeGroup.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
      });

    return () => {
      simulation.stop();
    };
  }, [graphData, dimensions, workspaceId, router]);

  const handleZoomIn = useCallback(() => {
    if (!svgRef.current) return;
    const svg = select(svgRef.current);
    const zoomBehavior = zoom<SVGSVGElement, unknown>().scaleExtent([0.1, 4]);
    svg.transition().duration(300).call(zoomBehavior.scaleBy, 1.5);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!svgRef.current) return;
    const svg = select(svgRef.current);
    const zoomBehavior = zoom<SVGSVGElement, unknown>().scaleExtent([0.1, 4]);
    svg.transition().duration(300).call(zoomBehavior.scaleBy, 0.67);
  }, []);

  const handleResetZoom = useCallback(() => {
    if (!svgRef.current) return;
    const svg = select(svgRef.current);
    const zoomBehavior = zoom<SVGSVGElement, unknown>().scaleExtent([0.1, 4]);
    svg.transition().duration(300).call(zoomBehavior.transform, zoomIdentity);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--text-tertiary)" }} />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden">
      {/* Zoom controls */}
      <div
        className="absolute top-4 right-4 flex flex-col gap-1 rounded-lg p-1 z-10"
        style={{
          backgroundColor: "var(--bg-primary)",
          border: "1px solid var(--border-default)",
          boxShadow: "var(--shadow-popup)",
        }}
      >
        <button
          onClick={handleZoomIn}
          className="p-1.5 rounded hover:bg-notion-bg-hover"
          style={{ color: "var(--text-secondary)" }}
          title="Zoom in"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-1.5 rounded hover:bg-notion-bg-hover"
          style={{ color: "var(--text-secondary)" }}
          title="Zoom out"
        >
          <ZoomOut size={16} />
        </button>
        <button
          onClick={handleResetZoom}
          className="p-1.5 rounded hover:bg-notion-bg-hover"
          style={{ color: "var(--text-secondary)" }}
          title="Reset zoom"
        >
          <Maximize2 size={16} />
        </button>
      </div>

      {/* Stats */}
      <div
        className="absolute bottom-4 left-4 text-xs px-3 py-1.5 rounded-lg z-10"
        style={{
          backgroundColor: "var(--bg-primary)",
          border: "1px solid var(--border-default)",
          color: "var(--text-tertiary)",
        }}
      >
        {graphData?.nodes.length ?? 0} pages &middot; {graphData?.edges.length ?? 0} links
      </div>

      {/* Tooltip */}
      {hoveredNode && graphData && (
        <div
          className="absolute top-4 left-4 px-3 py-2 rounded-lg text-sm z-10"
          style={{
            backgroundColor: "var(--bg-primary)",
            border: "1px solid var(--border-default)",
            boxShadow: "var(--shadow-popup)",
            color: "var(--text-primary)",
          }}
        >
          {graphData.nodes.find((n) => n.id === hoveredNode)?.title ?? "Untitled"}
        </div>
      )}

      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ backgroundColor: "var(--bg-primary)" }}
      />
    </div>
  );
}
