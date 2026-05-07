import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import BarChartIcon from '@mui/icons-material/BarChart';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import PeopleIcon from '@mui/icons-material/People';
import Navbar from '../components/Navbar';
import api from '../api';

function TeacherDashboard() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get('/api/exams')
      .then(({ data }) => setExams(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleDeleteExam = async (examId) => {
    if (!window.confirm('Bạn có chắc muốn xóa bài tập này?')) return;
    setDeleteLoading(examId);
    try {
      await api.delete(`/api/exams/${examId}`);
      setExams((prev) => prev.filter((e) => e.id !== examId));
    } catch (err) {
      alert(err.response?.data?.error || 'Xóa thất bại');
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleBulkCreate = async () => {
    const lines = bulkText.trim().split('\n').filter((l) => l.trim());
    if (lines.length === 0) return;

    const students = lines.map((line) => {
      const [username, password, fullName, className, school] = line
        .split(',')
        .map((p) => p.trim());
      return { username, password, fullName, className, school };
    });

    setBulkLoading(true);
    try {
      const { data } = await api.post('/api/students/bulk', { students });
      setBulkResult(data);
    } catch (err) {
      alert(err.response?.data?.error || 'Tạo tài khoản thất bại');
    } finally {
      setBulkLoading(false);
    }
  };

  const closeBulkDialog = () => {
    setBulkOpen(false);
    setBulkText('');
    setBulkResult(null);
  };

  return (
    <>
      <Navbar />
      <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
        {/* Header */}
        <Box
          sx={{
            background: 'linear-gradient(135deg, #1565c0 0%, #6a1b9a 100%)',
            borderRadius: 3,
            p: 3,
            mb: 4,
            color: 'white',
          }}
        >
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Bảng điều khiển
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.85 }}>
            Quản lý bài tập sơ đồ tư duy và học sinh
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mt: 2.5, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/teacher/create-exam')}
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}
            >
              Tạo bài tập mới
            </Button>
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              onClick={() => setBulkOpen(true)}
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}
            >
              Tạo tài khoản học sinh
            </Button>
            <Button
              variant="contained"
              startIcon={<BarChartIcon />}
              onClick={() => navigate('/teacher/stats')}
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}
            >
              Xem thống kê
            </Button>
          </Box>
        </Box>

        {/* Stats summary */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={4}>
            <Card elevation={2} sx={{ borderRadius: 2, textAlign: 'center', p: 2 }}>
              <AccountTreeIcon color="primary" sx={{ fontSize: 36 }} />
              <Typography variant="h4" fontWeight="bold">{exams.length}</Typography>
              <Typography color="text.secondary">Bài tập</Typography>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card elevation={2} sx={{ borderRadius: 2, textAlign: 'center', p: 2 }}>
              <PeopleIcon color="secondary" sx={{ fontSize: 36 }} />
              <Typography variant="h4" fontWeight="bold">
                {exams.reduce((s, e) => s + (e._count?.nodes || 0), 0)}
              </Typography>
              <Typography color="text.secondary">Tổng số node</Typography>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card elevation={2} sx={{ borderRadius: 2, textAlign: 'center', p: 2 }}>
              <BarChartIcon sx={{ fontSize: 36, color: '#2e7d32' }} />
              <Typography variant="h4" fontWeight="bold">
                {exams.filter((e) => e._count?.nodes > 0).length}
              </Typography>
              <Typography color="text.secondary">Bài có node</Typography>
            </Card>
          </Grid>
        </Grid>

        <Typography variant="h5" fontWeight="bold" gutterBottom>
          Danh sách bài tập
        </Typography>

        {loading ? (
          <Box sx={{ textAlign: 'center', mt: 6 }}><CircularProgress /></Box>
        ) : exams.length === 0 ? (
          <Box sx={{ textAlign: 'center', mt: 6 }}>
            <AccountTreeIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Chưa có bài tập nào. Hãy tạo bài tập mới!
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {exams.map((exam) => (
              <Grid item xs={12} sm={6} md={4} key={exam.id}>
                <Card elevation={3} sx={{ borderRadius: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <AccountTreeIcon color="primary" sx={{ mt: 0.3, flexShrink: 0 }} />
                      <Typography variant="h6" fontWeight="bold" lineHeight={1.3}>
                        {exam.title}
                      </Typography>
                    </Box>
                    <Box sx={{ mt: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {exam._count?.nodes !== undefined && (
                        <Chip label={`${exam._count.nodes} node`} size="small" color="primary" variant="outlined" />
                      )}
                      <Chip
                        label={new Date(exam.createdAt).toLocaleDateString('vi-VN')}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  </CardContent>
                  <Divider />
                  <CardActions sx={{ justifyContent: 'flex-end' }}>
                    <Tooltip title="Xóa bài tập">
                      <IconButton
                        color="error"
                        onClick={() => handleDeleteExam(exam.id)}
                        disabled={deleteLoading === exam.id}
                      >
                        {deleteLoading === exam.id ? (
                          <CircularProgress size={20} />
                        ) : (
                          <DeleteIcon />
                        )}
                      </IconButton>
                    </Tooltip>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>

      {/* Dialog tạo tài khoản học sinh hàng loạt */}
      <Dialog open={bulkOpen} onClose={closeBulkDialog} maxWidth="md" fullWidth>
        <DialogTitle>Tạo tài khoản học sinh hàng loạt</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Mỗi dòng theo định dạng: <strong>username,password,họ tên,lớp,trường</strong>
          </Alert>
          <TextField
            fullWidth
            multiline
            rows={10}
            label="Danh sách học sinh"
            placeholder={`hs001,matkhau123,Nguyễn Văn A,10A1,THPT Lê Lợi\nhs002,matkhau456,Trần Thị B,10A1,THPT Lê Lợi\nhs003,matkhau789,Lê Văn C,10A2,THPT Lê Lợi`}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
          />
          {bulkResult && (
            <Box sx={{ mt: 2 }}>
              {bulkResult.created.length > 0 && (
                <Alert severity="success">
                  Tạo thành công {bulkResult.created.length} tài khoản
                </Alert>
              )}
              {bulkResult.errors.length > 0 && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  Lỗi ({bulkResult.errors.length}):{' '}
                  {bulkResult.errors.map((e) => `${e.username}: ${e.error}`).join(' | ')}
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeBulkDialog}>Đóng</Button>
          <Button
            variant="contained"
            onClick={handleBulkCreate}
            disabled={!bulkText.trim() || bulkLoading}
          >
            {bulkLoading ? <CircularProgress size={20} /> : 'Tạo tài khoản'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default TeacherDashboard;
