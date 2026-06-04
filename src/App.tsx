import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AdminLoginPage, AdminPage, getStoredAdminSession } from "./components/admin";
import { PublicPortalPage } from "./features/publicPortal/PublicPortalPage";

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const normalizedPath = location.pathname.replace(/\/+$/, "") || "/";
  const isAdmin = normalizedPath === "/admin";
  const isAdminLogin = normalizedPath === "/admin/login";

  useEffect(() => {
    if (isAdmin && !getStoredAdminSession()) {
      navigate("/admin/login", { replace: true });
    }
  }, [isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) {
      document.title = "Administración · Fernando Luna";
    }
  }, [isAdmin]);

  if (isAdmin) {
    if (!getStoredAdminSession()) {
      return null;
    }

    return <AdminPage />;
  }

  if (isAdminLogin) {
    return <AdminLoginPage />;
  }

  return <PublicPortalPage />;
}

export default App;
