import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { videoApi } from "../../lib/videoApi";
import { extractErrorMessage } from "../../lib/api";
import { AgentAttendance } from "./AgentAttendance";
import { ClientAttendance } from "./ClientAttendance";
import type { Role } from "./types";

export function AttendancePage() {
  const { collectionId } = useParams<{ collectionId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [role, setRole] = useState<Role | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!collectionId || !token) {
      setError("Link inválido.");
      return;
    }
    videoApi
      .post(`/${collectionId}/token`, { token })
      .then(({ data }) => setRole(data.role))
      .catch((err) => setError(extractErrorMessage(err, "Não foi possível abrir este atendimento.")));
  }, [collectionId, token]);

  if (error) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-white p-6">
        <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
          <ShieldCheck className="h-10 w-10 text-red-400" />
          <p className="font-semibold text-red-700">Não foi possível abrir o atendimento</p>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!role || !collectionId) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    );
  }

  return role === "AGENT" ? (
    <AgentAttendance collectionId={collectionId} token={token} />
  ) : (
    <ClientAttendance collectionId={collectionId} token={token} />
  );
}
