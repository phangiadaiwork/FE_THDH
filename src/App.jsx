import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import Login from './pages/Login';
import StudentDashboard from './pages/StudentDashboard';
import ExamMindMap from './pages/ExamMindMap';
import TeacherDashboard from './pages/TeacherDashboard';
import CreateExam from './pages/CreateExam';
import Stats from './pages/Stats';
import PrivateRoute from './components/PrivateRoute';

const theme = createTheme({
  palette: {
    primary: { main: '#1565c0' },
    secondary: { main: '#6a1b9a' },
    background: { default: '#f5f7fa' },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica Neue", Arial, sans-serif',
  },
  shape: { borderRadius: 10 },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/student"
            element={
              <PrivateRoute role="STUDENT">
                <StudentDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/student/exam/:id"
            element={
              <PrivateRoute role="STUDENT">
                <ExamMindMap />
              </PrivateRoute>
            }
          />
          <Route
            path="/teacher"
            element={
              <PrivateRoute role="TEACHER">
                <TeacherDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/teacher/create-exam"
            element={
              <PrivateRoute role="TEACHER">
                <CreateExam />
              </PrivateRoute>
            }
          />
          <Route
            path="/teacher/stats"
            element={
              <PrivateRoute role="TEACHER">
                <Stats />
              </PrivateRoute>
            }
          />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
