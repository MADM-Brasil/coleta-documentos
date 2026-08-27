import { Navigate, Route, Routes } from "react-router-dom";
import { ClientCollection } from "./pages/client/ClientCollection";
import { AttendancePage } from "./pages/attendance/AttendancePage";
import { AgentLogin } from "./pages/agent/AgentLogin";
import { AgentRoomPage } from "./pages/agent/AgentRoomPage";

export default function App() {
  return (
    <Routes>
      {/* Rota legada, mantida sem alterações para coletas já enviadas ao HubSpot/Make. */}
      <Route path="/coleta/:token" element={<ClientCollection />} />
      {/* Sala de atendimento — link único do cliente, entra como convidado sem login. */}
      <Route path="/atendimento/:collectionId" element={<AttendancePage />} />
      {/* Consultor entra numa sala específica (link mandado pelo Make), com login por
          senha da equipe — não existe painel geral listando todas as salas ativas. */}
      <Route path="/painel/login" element={<AgentLogin />} />
      <Route path="/painel/atendimento/:collectionId" element={<AgentRoomPage />} />
      <Route path="*" element={<Navigate to="/coleta/invalido" replace />} />
    </Routes>
  );
}
