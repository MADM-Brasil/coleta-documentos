import { Navigate, Route, Routes } from "react-router-dom";
import { ClientCollection } from "./pages/client/ClientCollection";
import { ConsultantWatch } from "./pages/consultant/ConsultantWatch";

export default function App() {
  return (
    <Routes>
      <Route path="/coleta/:token" element={<ClientCollection />} />
      <Route path="/acompanhar/:token" element={<ConsultantWatch />} />
      <Route path="*" element={<Navigate to="/coleta/invalido" replace />} />
    </Routes>
  );
}
