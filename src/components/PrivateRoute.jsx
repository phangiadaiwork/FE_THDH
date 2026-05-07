import { Navigate } from 'react-router-dom';

function PrivateRoute({ children, role }) {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');

  if (!token || !userStr) {
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
