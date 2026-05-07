import { AppBar, Toolbar, Typography, Button, Box, Chip, IconButton } from '@mui/material';
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
      <Toolbar sx={{ minHeight: { xs: 52, sm: 64 } }}>
        <SchoolIcon sx={{ mr: 1, fontSize: { xs: 20, sm: 24 } }} />
        {/* Full title on sm+, short on xs */}
        <Typography
          component="h1"
          fontWeight="bold"
          noWrap
          sx={{
            flexGrow: 1,
            fontSize: { xs: '0.95rem', sm: '1.1rem', md: '1.25rem' },
            lineHeight: 1.2,
          }}
        >
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            Học liệu số – Sơ đồ tư duy
          </Box>
          <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
            Học liệu số
          </Box>
        </Typography>

        {/* User info + logout */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 }, flexShrink: 0 }}>
          {/* Name chip — hidden on xs */}
          <Chip
            label={user.fullName || user.username}
            variant="outlined"
            sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)', display: { xs: 'none', sm: 'flex' } }}
            size="small"
          />
          {/* Class chip — hidden on xs */}
          {user.className && (
            <Chip
              label={user.className}
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', display: { xs: 'none', md: 'flex' } }}
              size="small"
            />
          )}
          {/* Icon-only logout on xs */}
          <IconButton
            color="inherit"
            onClick={handleLogout}
            size="small"
            sx={{ display: { xs: 'flex', sm: 'none' } }}
            aria-label="Đăng xuất"
          >
            <LogoutIcon fontSize="small" />
          </IconButton>
          {/* Text button on sm+ */}
          <Button
            color="inherit"
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
            size="small"
            sx={{ display: { xs: 'none', sm: 'flex' } }}
          >
            Đăng xuất
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
}

export default Navbar;
