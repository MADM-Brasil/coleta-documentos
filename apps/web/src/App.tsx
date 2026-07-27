import { Navigate, Route, Routes } from "react-router-dom";
import { ClientCollection } from "./pages/client/ClientCollection";

export default function App() {
  return (
    <Routes>
      <Route path="/coleta/:token" element={<ClientCollection />} />
      <Route path="*" element={<Navigate to="/coleta/invalido" replace />} />
    </Routes>
  );
}
