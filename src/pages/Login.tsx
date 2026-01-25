import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { LoginForm } from '@/components/auth/LoginForm';

export default function Login() {
  const { user, loading, roles, hasRole } = useAuth();

  if (loading) {
    return null;
  }

  if (user) {
    // If user has ONLY the seller role, redirect to seller portal
    const isOnlySeller = roles.length === 1 && hasRole('seller');
    if (isOnlySeller) {
      return <Navigate to="/seller" replace />;
    }
    
    // Otherwise, go to dashboard
    return <Navigate to="/dashboard" replace />;
  }

  return <LoginForm />;
}
