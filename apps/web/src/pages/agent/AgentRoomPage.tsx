import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAgentSession } from "../../lib/agentAuth";
import { AgentAttendance } from "../attendance/AgentAttendance";

export function AgentRoomPage() {
  const navigate = useNavigate();
  const { collectionId } = useParams<{ collectionId: string }>();

  useEffect(() => {
    if (!getAgentSession()) navigate(`/painel/login?next=/painel/atendimento/${collectionId}`);
  }, [navigate, collectionId]);

  if (!collectionId || !getAgentSession()) return null;

  return <AgentAttendance collectionId={collectionId} />;
}
