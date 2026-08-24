import { Navigate, Route, Routes } from "react-router-dom";
import { ClientCollection } from "./pages/client/ClientCollection";
import { AttendancePage } from "./pages/attendance/AttendancePage";

export default function App() {
  return (
    <Routes>
      {/* Rota legada, mantida sem alterações para coletas já enviadas ao HubSpot/Make. */}
      <Route path="/coleta/:token" element={<ClientCollection />} />
      {/* Sala de atendimento (vídeo + formulário) — usada por coletas criadas a partir de agora. */}
      <Route path="/atendimento/:collectionId" element={<AttendancePage />} />
      <Route path="*" element={<Navigate to="/coleta/invalido" replace />} />
    </Routes>
  );
}
