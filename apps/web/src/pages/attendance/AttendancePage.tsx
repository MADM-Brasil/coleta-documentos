import { useParams, useSearchParams } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { ClientAttendance } from "./ClientAttendance";

// Link único do cliente: entra direto como convidado, sem login e sem passar por
// nenhuma verificação de papel — o consultor acessa a mesma sala pelo painel (/painel).
export function AttendancePage() {
  const { collectionId } = useParams<{ collectionId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  if (!collectionId || !token) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-white p-6">
        <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
          <ShieldCheck className="h-10 w-10 text-red-400" />
          <p className="font-semibold text-red-700">Link inválido</p>
          <p className="text-sm text-red-600">Confira se o link que você recebeu está completo.</p>
        </div>
      </div>
    );
  }

  return <ClientAttendance collectionId={collectionId} token={token} />;
}
