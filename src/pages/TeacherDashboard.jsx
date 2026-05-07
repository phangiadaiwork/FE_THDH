import { useState, useEffect, useRef } from 'react';
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
  FormGroup,
  FormControlLabel,
  Checkbox,
  Switch,
  Stack,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import BarChartIcon from '@mui/icons-material/BarChart';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import PeopleIcon from '@mui/icons-material/People';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import Navbar from '../components/Navbar';
import api from '../api';

function TeacherDashboard() {
  const [exams, setExams] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Bulk create dialog
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Excel import student
  const [importingStudents, setImportingStudents] = useState(false);
  const studentFileRef = useRef(null);

  // Delete exam
  const [deleteLoading, setDeleteLoading] = useState(null);

  // Visibility dialog
  const [visExam, setVisExam] = useState(null);
  const [visPublic, setVisPublic] = useState(true);
  const [visClasses, setVisClasses] = useState([]);
  const [visSaving, setVisSaving] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [examsRes, statsRes] = await Promise.all([
          api.get('/api/exams'),
          api.get('/api/attempts/stats'),
        ]);
        setExams(examsRes.data);
        setClasses(statsRes.data.classes || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
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
      const [username, password, fullName, className, school] = line.split(',').map((p) => p.trim());
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

  // Tải template Excel học sinh
  const downloadStudentTemplate = () => {
    const url = `${import.meta.env.VITE_API_BASE_URL || ''}/api/students/template`;
    const token = localStorage.getItem('token');
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'mau_hoc_sinh.xlsx';
        a.click();
      })
      .catch(console.error);
  };

  // Import học sinh từ Excel
  const handleImportStudents = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingStudents(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/api/students/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      alert(`Tạo thành công ${data.created.length} tài khoản${data.errors.length > 0 ? `, ${data.errors.length} lỗi` : ''}`);
    } catch (err) {
      alert(err.response?.data?.error || 'Import thất bại');
    } finally {
      setImportingStudents(false);
      e.target.value = '';
    }
  };

  // Mở dialog cài visibility
  const openVisDialog = (exam) => {
    setVisExam(exam);
    setVisPublic(exam.isPublic ?? true);
    setVisClasses(exam.visibleClasses || []);
  };

  const toggleVisClass = (cls) => {
    setVisClasses((prev) =>
      prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls]
    );
  };

  const saveVisibility = async () => {
    if (!visExam) return;
    setVisSaving(true);
    try {
      const { data } = await api.put(`/api/exams/${visExam.id}/visibility`, {
        isPublic: visPublic,
        visibleClasses: visClasses,
      });
      setExams((prev) => prev.map((e) => e.id === data.id ? { ...e, ...data } : e));
      setVisExam(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Lưu thất bại');
    } finally {
      setVisSaving(false);
    }
  };

  const closeBulkDialog = () => { setBulkOpen(false); setBulkText(''); setBulkResult(null); };

  return (
    <>
      <Navbar />
      <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
        {/* Header */}
        <Box sx={{ background: 'linear-gradient(135deg, #1565c0 0%, #6a1b9a 100%)', borderRadius: 3, p: 3, mb: 4, color: 'white' }}>
          <Typography variant="h4" fontWeight="bold" gutterBottom>Bảng điều khiển</Typography>
          <Typography variant="body1" sx={{ opacity: 0.85 }}>Quản lý bài tập sơ đồ tư duy và học sinh</Typography>
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
              Tạo tài khoản (CSV)
            </Button>
            <Button
              variant="contained"
              startIcon={<ManageAccountsIcon />}
              onClick={() => navigate('/teacher/students')}
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}
            >
              Quản lý học sinh
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

          {/* Excel import học sinh */}
          <Box sx={{ display: 'flex', gap: 1.5, mt: 1.5, flexWrap: 'wrap' }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={downloadStudentTemplate}
              sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)', '&:hover': { borderColor: 'white' } }}
            >
              Tải mẫu Excel học sinh
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={importingStudents ? <CircularProgress size={14} sx={{ color: 'white' }} /> : <UploadFileIcon />}
              onClick={() => studentFileRef.current?.click()}
              disabled={importingStudents}
              sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)', '&:hover': { borderColor: 'white' } }}
            >
              Import học sinh từ Excel
            </Button>
            <input ref={studentFileRef} type="file" accept=".xlsx,.xls" hidden onChange={handleImportStudents} />
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

        <Typography variant="h5" fontWeight="bold" gutterBottom>Danh sách bài tập</Typography>

        {loading ? (
          <Box sx={{ textAlign: 'center', mt: 6 }}><CircularProgress /></Box>
        ) : exams.length === 0 ? (
          <Box sx={{ textAlign: 'center', mt: 6 }}>
            <AccountTreeIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
            <Typography color="text.secondary" sx={{ mt: 1 }}>Chưa có bài tập nào. Hãy tạo bài tập mới!</Typography>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {exams.map((exam) => (
              <Grid item xs={12} sm={6} md={4} key={exam.id}>
                <Card elevation={3} sx={{ borderRadius: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <AccountTreeIcon color="primary" sx={{ mt: 0.3, flexShrink: 0 }} />
                      <Typography variant="h6" fontWeight="bold" lineHeight={1.3}>{exam.title}</Typography>
                    </Box>
                    <Box sx={{ mt: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {exam._count?.nodes !== undefined && (
                        <Chip label={`${exam._count.nodes} node`} size="small" color="primary" variant="outlined" />
                      )}
                      <Chip label={new Date(exam.createdAt).toLocaleDateString('vi-VN')} size="small" variant="outlined" />
                      {exam.isPublic ? (
                        <Chip label="Công khai" size="small" color="success" icon={<VisibilityIcon />} />
                      ) : (
                        <Chip label={`${(exam.visibleClasses || []).length} lớp`} size="small" color="warning" icon={<VisibilityOffIcon />} />
                      )}
                    </Box>
                  </CardContent>
                  <Divider />
                  <CardActions sx={{ justifyContent: 'flex-end', gap: 0.5 }}>
                    <Tooltip title="Cài đặt hiển thị theo lớp">
                      <IconButton size="small" onClick={() => openVisDialog(exam)} color="primary">
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Xóa bài tập">
                      <IconButton color="error" onClick={() => handleDeleteExam(exam.id)} disabled={deleteLoading === exam.id}>
                        {deleteLoading === exam.id ? <CircularProgress size={20} /> : <DeleteIcon />}
                      </IconButton>
                    </Tooltip>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>

      {/* Dialog tạo tài khoản CSV */}
      <Dialog open={bulkOpen} onClose={closeBulkDialog} maxWidth="md" fullWidth>
        <DialogTitle>Tạo tài khoản học sinh (CSV)</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Mỗi dòng: <strong>username,password,họ tên,lớp,trường</strong>
          </Alert>
          <TextField
            fullWidth multiline rows={10}
            label="Danh sách học sinh"
            placeholder={`hs001,matkhau123,Nguyễn Văn A,10A1,THPT Lê Lợi\nhs002,matkhau456,Trần Thị B,10A1,THPT Lê Lợi`}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
          />
          {bulkResult && (
            <Box sx={{ mt: 2 }}>
              {bulkResult.created.length > 0 && (
                <Alert severity="success">Tạo thành công {bulkResult.created.length} tài khoản</Alert>
              )}
              {bulkResult.errors.length > 0 && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  Lỗi ({bulkResult.errors.length}): {bulkResult.errors.map((e) => `${e.username}: ${e.error}`).join(' | ')}
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeBulkDialog}>Đóng</Button>
          <Button variant="contained" onClick={handleBulkCreate} disabled={!bulkText.trim() || bulkLoading}>
            {bulkLoading ? <CircularProgress size={20} /> : 'Tạo tài khoản'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog cài đặt hiển thị bài tập */}
      <Dialog open={Boolean(visExam)} onClose={() => setVisExam(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Cài đặt hiển thị: {visExam?.title}</DialogTitle>
        <DialogContent>
          <FormControlLabel
            control={<Switch checked={visPublic} onChange={(e) => setVisPublic(e.target.checked)} />}
            label="Hiển thị cho tất cả học sinh (công khai)"
            sx={{ mb: 1, display: 'block' }}
          />
          {!visPublic && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Chọn lớp được phép làm bài:
              </Typography>
              {classes.length === 0 ? (
                <Typography variant="caption" color="text.disabled">Chưa có lớp nào</Typography>
              ) : (
                <FormGroup>
                  {classes.map((cls) => (
                    <FormControlLabel
                      key={cls}
                      control={
                        <Checkbox
                          checked={visClasses.includes(cls)}
                          onChange={() => toggleVisClass(cls)}
                          size="small"
                        />
                      }
                      label={cls}
                    />
                  ))}
                </FormGroup>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVisExam(null)}>Hủy</Button>
          <Button variant="contained" onClick={saveVisibility} disabled={visSaving}>
            {visSaving ? <CircularProgress size={18} /> : 'Lưu'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default TeacherDashboard;
