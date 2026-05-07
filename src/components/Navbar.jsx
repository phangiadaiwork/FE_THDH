import { AppBar, Toolbar, Typography, Button, Box, Chip } from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import LogoutIcon from '@mui/icons-material/Logout';
import { useNavigate } from 'react-router-dom';

function Navbar() {
  const navigate = useNavigate();
  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  })();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <AppBar position="static" elevation={2}>
      <Toolbar>
        <SchoolIcon sx={{ mr: 1.5 }} />
        <Typography variant="h6" fontWeight="bold" sx={{ flexGrow: 1 }}>
          Học liệu số – Sơ đồ tư duy
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={user.fullName || user.username}
            variant="outlined"
            sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)' }}
            size="small"
          />
          {user.className && (
            <Chip
              label={user.className}
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
              size="small"
            />
          )}
          <Button
            color="inherit"
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
            size="small"
          >
            Đăng xuất
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
}

export default Navbar;
