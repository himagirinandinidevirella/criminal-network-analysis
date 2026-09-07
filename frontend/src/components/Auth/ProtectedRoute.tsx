/**
 * ProtectedRoute — redirects unauthenticated users to /login.
 * Optionally restricts by role.
 */
import { Navigate, useLocation } from "react-router-dom";
import type { Role } from "@/types/api.types";
import { getStoredUser } from "@/services/auth";

interface Props {
  children: React.ReactNode;
  roles?: Role[];
}

export default function ProtectedRoute({ children, roles }: Props) {
  const location = useLocation();
  const token = localStorage.getItem("crimenet_access_token");
  const user = getStoredUser();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && user && !roles.includes(user.role)) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary text-text-secondary">
        You do not have permission to access this page.
      </div>
    );
  }

  return <>{children}</>;
}
