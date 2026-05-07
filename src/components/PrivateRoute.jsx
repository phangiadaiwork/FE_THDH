import { Navigate } from 'react-router-dom';

const clearAuth = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

const isTokenExpired = (token) => {
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return true;
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded));
    if (!payload.exp) return true;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
};

function PrivateRoute({ children, role }) {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');

  if (!token || !userStr || isTokenExpired(token)) {
    clearAuth();
    return <Navigate to="/login" replace />;
  }

  try {
    const user = JSON.parse(userStr);
    if (role && user.role !== role) {
      return <Navigate to="/login" replace />;
    }
    return children;
  } catch {
    return <Navigate to="/login" replace />;
  }
}

export default PrivateRoute;
