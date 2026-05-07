import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  Checkbox,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import BarChartIcon from '@mui/icons-material/BarChart';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import PeopleIcon from '@mui/icons-material/People';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import Navbar from '../components/Navbar';
import api from '../api';

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const [lessons, setLessons] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(null);
  const [visLesson, setVisLesson] = useState(null);
  const [visPublic, setVisPublic] = useState(true);
  const [visClasses, setVisClasses] = useState([]);
  const [visSaving, setVisSaving] = useState(false);
  const [importingStudents, setImportingStudents] = useState(false);
  const studentFileRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [examRes, statsRes] = await Promise.all([
          api.get('/api/exams'),
          api.get('/api/attempts/stats'),
        ]);
        setLessons(examRes.data || []);
        setClasses(statsRes.data.classes || []);
      } catch (err) {
        console.error(err);
        setError('Không thể tải dữ liệu bảng điều khiển.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa bài học này?')) return;
    setDeleteLoading(id);
    try {
      await api.delete(`/api/exams/${id}`);
      setLessons((prev) => prev.filter((lesson) => lesson.id !== id));
    } catch (err) {
      alert(err.response?.data?.error || 'Xóa thất bại.');
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleBulkCreate = async () => {
    const students = bulkText
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [username, password, fullName, className, school, academicYearName] = line.split(',').map((part) => part.trim());
        return { username, password, fullName, className, school, academicYearName };
      });

    setBulkLoading(true);
    try {
      await api.post('/api/students/bulk', { students });
      setBulkOpen(false);
      setBulkText('');
      const { data } = await api.get('/api/attempts/stats');
      setClasses(data.classes || []);
    } catch (err) {
      alert(err.response?.data?.error || 'Tạo tài khoản thất bại.');
    } finally {
      setBulkLoading(false);
    }
  };

  const downloadStudentTemplate = () => {
    const url = `${import.meta.env.VITE_API_BASE_URL || ''}/api/students/template`;
    const token = localStorage.getItem('token');
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'mau_hoc_sinh.xlsx';
        a.click();
      })
      .catch(console.error);
  };

  const handleImportStudents = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportingStudents(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post('/api/students/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { data } = await api.get('/api/attempts/stats');
      setClasses(data.classes || []);
    } catch (err) {
      alert(err.response?.data?.error || 'Import học sinh thất bại.');
    } finally {
      setImportingStudents(false);
      event.target.value = '';
    }
  };

  const openVisibilityDialog = (lesson) => {
    setVisLesson(lesson);
    setVisPublic(lesson.isPublic);
    setVisClasses(lesson.assignedClasses?.map((item) => item.id) || []);
  };

  const saveVisibility = async () => {
    if (!visLesson) return;
    setVisSaving(true);
    try {
      const { data } = await api.put(`/api/exams/${visLesson.id}/visibility`, {
        isPublic: visPublic,
        visibleClasses: visClasses,
      });
      setLessons((prev) => prev.map((lesson) => (lesson.id === data.id ? data : lesson)));
      setVisLesson(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Không lưu được phạm vi hiển thị.');
    } finally {
      setVisSaving(false);
    }
  };

  const totalNodes = lessons.reduce((sum, lesson) => sum + (lesson.nodeCount || 0), 0);

  return (
    <>
      <Navbar />
      <Container maxWidth="xl" sx={{ mt: { xs: 2, md: 4 }, mb: 6 }}>
        <Paper
          sx={{
            p: { xs: 2.5, md: 3.5 },
            borderRadius: 5,
            background: 'linear-gradient(135deg, #6c4315 0%, #b68134 100%)',
            color: 'white',
            mb: 4,
          }}
        >
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems={{ lg: 'center' }}>
            <Box>
              <Typography variant="h4" fontWeight={800} sx={{ fontSize: { xs: '1.6rem', md: '2.2rem' } }}>
                Quản lý học liệu số
              </Typography>
              <Typography sx={{ opacity: 0.9 }}>
                Tạo bài học, quản lý học sinh và theo dõi thống kê theo lớp/chương/bài.
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }} />
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/teacher/create-exam')} sx={{ bgcolor: 'rgba(255,255,255,0.18)' }}>
                Tạo bài học
              </Button>
              <Button variant="contained" startIcon={<ManageAccountsIcon />} onClick={() => navigate('/teacher/students')} sx={{ bgcolor: 'rgba(255,255,255,0.18)' }}>
                Quản lý học sinh
              </Button>
              <Button variant="contained" startIcon={<BarChartIcon />} onClick={() => navigate('/teacher/stats')} sx={{ bgcolor: 'rgba(255,255,255,0.18)' }}>
                Xem thống kê
              </Button>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
            <Button variant="outlined" startIcon={<PeopleIcon />} onClick={() => setBulkOpen(true)} sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.45)' }}>
              Tạo tài khoản CSV
            </Button>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={downloadStudentTemplate} sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.45)' }}>
              Tải mẫu học sinh
            </Button>
            <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => studentFileRef.current?.click()} sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.45)' }}>
              {importingStudents ? 'Đang import' : 'Import học sinh'}
            </Button>
            <input ref={studentFileRef} type="file" accept=".xlsx,.xls" hidden onChange={handleImportStudents} />
          </Stack>
        </Paper>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid item xs={12} md={4}>
            <Card sx={{ borderRadius: 4 }}>
              <CardContent>
                <Typography color="text.secondary">Bài học</Typography>
                <Typography variant="h4" fontWeight={800}>{lessons.length}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ borderRadius: 4 }}>
              <CardContent>
                <Typography color="text.secondary">Node bài tập</Typography>
                <Typography variant="h4" fontWeight={800}>{totalNodes}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ borderRadius: 4 }}>
              <CardContent>
                <Typography color="text.secondary">Lớp học đang quản lý</Typography>
                <Typography variant="h4" fontWeight={800}>{classes.length}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Typography variant="h5" fontWeight={800} sx={{ mb: 2, color: '#5d3c15' }}>
          Danh sách bài học
        </Typography>

        {loading ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={2.5}>
            {lessons.map((lesson) => (
              <Grid item xs={12} md={6} xl={4} key={lesson.id}>
                <Card sx={{ borderRadius: 4, height: '100%', border: '1px solid #efdfc6' }}>
                  <CardContent>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
                      <Chip label={`Lớp ${lesson.gradeLevel}`} size="small" sx={{ bgcolor: '#fff0d9' }} />
                      <Chip label={lesson.chapterTitle} size="small" sx={{ bgcolor: '#fff0d9' }} />
                    </Stack>

                    <Typography variant="h6" fontWeight={800} sx={{ color: '#5d3c15' }}>
                      {lesson.lessonNumber ? `Bài ${lesson.lessonNumber}: ` : ''}
                      {lesson.lessonTitle}
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 1, minHeight: 48 }}>
                      {lesson.theoryContent?.slice(0, 120) || 'Chưa có phần lý thuyết.'}
                      {lesson.theoryContent?.length > 120 ? '...' : ''}
                    </Typography>

                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
                      <Chip icon={<AccountTreeIcon />} label={`${lesson.nodeCount} node`} size="small" variant="outlined" />
                      <Chip icon={<VisibilityIcon />} label={lesson.isPublic ? 'Công khai' : `${lesson.assignedClasses?.length || 0} lớp`} size="small" variant="outlined" />
                    </Stack>
                  </CardContent>
                  <Divider />
                  <CardActions sx={{ justifyContent: 'space-between', px: 2 }}>
                    <Button size="small" onClick={() => openVisibilityDialog(lesson)}>
                      Phạm vi hiển thị
                    </Button>
                    <Tooltip title="Xóa bài học">
                      <IconButton color="error" onClick={() => handleDelete(lesson.id)} disabled={deleteLoading === lesson.id}>
                        {deleteLoading === lesson.id ? <CircularProgress size={18} /> : <DeleteIcon />}
                      </IconButton>
                    </Tooltip>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>

      <Dialog open={bulkOpen} onClose={() => setBulkOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Tạo tài khoản học sinh bằng CSV</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Mỗi dòng theo mẫu: username,password,họ tên,lớp,trường,năm học
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={10}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder="hs12a1,123456,Nguyễn Văn A,12A1,THPT Lê Lợi,2025-2026"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkOpen(false)}>Đóng</Button>
          <Button variant="contained" onClick={handleBulkCreate} disabled={bulkLoading || !bulkText.trim()}>
            {bulkLoading ? <CircularProgress size={18} color="inherit" /> : 'Tạo tài khoản'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(visLesson)} onClose={() => setVisLesson(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Phạm vi hiển thị</DialogTitle>
        <DialogContent>
          <Typography fontWeight={700} sx={{ mb: 2 }}>
            {visLesson?.lessonTitle}
          </Typography>
          <FormControlLabel
            control={<Switch checked={visPublic} onChange={(e) => setVisPublic(e.target.checked)} />}
            label="Hiển thị công khai cho mọi học sinh"
            sx={{ mb: 1.5 }}
          />

          {!visPublic && (
            <Stack spacing={1}>
              {classes.map((studentClass) => (
                <FormControlLabel
                  key={studentClass.id}
                  control={
                    <Checkbox
                      checked={visClasses.includes(studentClass.id)}
                      onChange={() =>
                        setVisClasses((prev) =>
                          prev.includes(studentClass.id)
                            ? prev.filter((item) => item !== studentClass.id)
                            : [...prev, studentClass.id]
                        )
                      }
                    />
                  }
                  label={`${studentClass.name} • ${studentClass.academicYearName} • ${studentClass.school || 'Chưa gán trường'}`}
                />
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVisLesson(null)}>Hủy</Button>
          <Button variant="contained" onClick={saveVisibility} disabled={visSaving}>
            {visSaving ? <CircularProgress size={18} color="inherit" /> : 'Lưu'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
