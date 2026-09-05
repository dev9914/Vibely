import { Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { Loader2 } from "lucide-react";
import { selectIsAuthenticated, selectIsLoading } from "../store/authSlice";

interface ProtectedRouteProps {
    children: React.ReactNode;
    requireAuth?: boolean; // true = must be logged in, false = must be logged out (guest only)
}

/**
 * ProtectedRoute Component
 * 
 * Handles route protection with two modes:
 * - requireAuth=true (default): Only authenticated users can access
 * - requireAuth=false: Only guests can access (redirects to home if logged in)
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
    children, 
    requireAuth = true 
}) => {
    const location = useLocation();
    const isAuthenticated = useSelector(selectIsAuthenticated);
    const isLoading = useSelector(selectIsLoading);

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
            </div>
        );
    }

    // Protected route - user must be authenticated
    if (requireAuth && !isAuthenticated) {
        // Save the attempted location for redirect after login
        return <Navigate to="/signin" state={{ from: location }} replace />;
    }

    // Guest-only route - user must NOT be authenticated
    if (!requireAuth && isAuthenticated) {
        // Redirect to home if already logged in
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;