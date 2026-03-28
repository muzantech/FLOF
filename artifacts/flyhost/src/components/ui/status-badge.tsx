import { DeploymentStatus, ProjectStatus } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";

export function DeploymentStatusBadge({ status }: { status: DeploymentStatus }) {
  switch (status) {
    case 'ready':
      return (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-medium">
          <span className="w-1.5 h-1.5 rounded-full status-dot-ready mr-2"></span>
          Ready
        </Badge>
      );
    case 'building':
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 font-medium">
          <span className="w-1.5 h-1.5 rounded-full status-dot-building mr-2"></span>
          Building
        </Badge>
      );
    case 'error':
      return (
        <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 font-medium">
          <span className="w-1.5 h-1.5 rounded-full status-dot-error mr-2"></span>
          Error
        </Badge>
      );
    case 'queued':
      return (
        <Badge variant="outline" className="bg-gray-500/10 text-gray-400 border-gray-500/20 font-medium">
          <span className="w-1.5 h-1.5 rounded-full status-dot-queued mr-2"></span>
          Queued
        </Badge>
      );
    case 'cancelled':
      return (
        <Badge variant="outline" className="bg-gray-800 text-gray-400 border-gray-700 font-medium">
          Cancelled
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  if (status === 'active') {
    return (
      <Badge variant="outline" className="bg-white/5 border-white/10 text-white/80">
        Active
      </Badge>
    );
  }
  return <Badge variant="outline" className="opacity-50">{status}</Badge>;
}
