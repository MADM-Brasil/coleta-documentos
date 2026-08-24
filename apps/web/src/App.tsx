import { Navigate, Route, Routes } from "react-router-dom";
import { ClientCollection } from "./pages/client/ClientCollection";
import { AttendancePage } from "./pages/attendance/AttendancePage";
import { AgentLogin } from "./pages/agent/AgentLogin";
import { AgentDashboard } from "./pages/agent/AgentDashboard";
import { AgentRoomPage } from "./pages/agent/AgentRoomPage";

export default function App() {
  return (
    <Routes>
      {/* Rota legada, mantida sem alterações para coletas já enviadas ao HubSpot/Make. */}
      <Route path="/coleta/:token" element={<ClientCollection />} />
      {/* Sala de atendimento — link único do cliente, entra como convidado sem login. */}
      <Route path="/atendimento/:collectionId" element={<AttendancePage />} />
      {/* Painel do consultor — login com senha da equipe, sem link por coleta. */}
      <Route path="/painel/login" element={<AgentLogin />} />
      <Route path="/painel" element={<AgentDashboard />} />
      <Route path="/painel/atendimento/:collectionId" element={<AgentRoomPage />} />
      <Route path="*" element={<Navigate to="/coleta/invalido" replace />} />
    </Routes>
  );
}
