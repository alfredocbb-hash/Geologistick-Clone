import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { LoginForm } from '@/components/auth/LoginForm';

export default function Login() {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <LoginForm />;
}
