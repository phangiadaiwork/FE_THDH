import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import LockResetIcon from '@mui/icons-material/LockReset';
import SearchIcon from '@mui/icons-material/Search';
import PeopleIcon from '@mui/icons-material/People';
import Navbar from '../components/Navbar';
import api from '../api';

export default function StudentManagement() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('');

  // Edit dialog
  const [editStudent, setEditStudent] = useState(null);
  const [editForm, setEditForm] = useState({ username: '', fullName: '', className: '', school: '', academicYearName: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Reset password dialog
  const [resetStudent, setResetStudent] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetSaving, setResetSaving] = useState(false);
  const [resetError, setResetError] = useState('');

  const [deleteLoading, setDeleteLoading] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/students')
      .then(({ data }) => setStudents(data))
      .catch(() => setError('Không thể tải danh sách học sinh'))
      .finally(() => setLoading(false));
  }, []);

  const classes = [...new Set(students.map((s) => s.className).filter(Boolean))].sort();

  const filtered = students.filter((s) => {
    const matchSearch =
      !search ||
      s.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      s.username?.toLowerCase().includes(search.toLowerCase());
    const matchClass = !filterClass || s.className === filterClass;
    return matchSearch && matchClass;
  });

  // ── Xóa học sinh ────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa học sinh này?')) return;
    setDeleteLoading(id);
    try {
      await api.delete(`/api/students/${id}`);
      setStudents((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      alert(err.response?.data?.error || 'Xóa thất bại');
    } finally {
      setDeleteLoading(null);
    }
  };

  // ── Mở dialog chỉnh sửa ─────────────────────────────────────────────────
  const openEdit = (student) => {
    setEditStudent(student);
    setEditForm({
      username: student.username,
      fullName: student.fullName,
      className: student.className || '',
      school: student.school || '',
      academicYearName: student.academicYearName || '',
    });
    setEditError('');
  };

  const handleEditSave = async () => {
    setEditSaving(true);
    setEditError('');
    try {
      const { data } = await api.put(`/api/students/${editStudent.id}`, editForm);
      setStudents((prev) => prev.map((s) => s.id === data.id ? { ...s, ...data } : s));
      setEditStudent(null);
    } catch (err) {
      setEditError(err.response?.data?.error || 'Cập nhật thất bại');
    } finally {
      setEditSaving(false);
    }
  };

  // ── Đặt lại mật khẩu ────────────────────────────────────────────────────
  const openReset = (student) => {
    setResetStudent(student);
    setNewPassword('');
    setResetError('');
  };

  const handleResetPassword = async () => {
    setResetSaving(true);
    setResetError('');
    try {
      await api.put(`/api/students/${resetStudent.id}/reset-password`, { newPassword });
      setResetStudent(null);
      alert('Đã đặt lại mật khẩu thành công!');
    } catch (err) {
      setResetError(err.response?.data?.error || 'Đặt lại mật khẩu thất bại');
    } finally {
      setResetSaving(false);
    }
  };

  return (
    <>
      <Navbar />
      <Container maxWidth="xl" sx={{ mt: 4, mb: 6 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/teacher')} variant="outlined" size="small">
            Quay lại
          </Button>
          <PeopleIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h4" fontWeight="bold">Quản lý học sinh</Typography>
          <Chip label={`${students.length} học sinh`} color="primary" />
        </Box>

        {/* Bộ lọc */}
        <Paper elevation={2} sx={{ p: 2, mb: 3, borderRadius: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Tìm tên hoặc username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 250 }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
            }}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Lọc theo lớp</InputLabel>
            <Select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} label="Lọc theo lớp">
              <MenuItem value=""><em>Tất cả lớp</em></MenuItem>
              {classes.map((cls) => <MenuItem key={cls} value={cls}>{cls}</MenuItem>)}
            </Select>
          </FormControl>
          <Typography variant="body2" color="text.secondary">
            Hiển thị {filtered.length}/{students.length}
          </Typography>
        </Paper>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {loading ? (
          <Box sx={{ textAlign: 'center', mt: 6 }}><CircularProgress /></Box>
        ) : (
          <TableContainer component={Paper} elevation={3} sx={{ borderRadius: 2 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  {['#', 'Username', 'Họ và tên', 'Lớp', 'Năm học', 'Trường', 'Ngày tạo', 'Thao tác'].map((h) => (
                    <TableCell key={h} sx={{ fontWeight: 'bold', bgcolor: '#1565c0', color: 'white' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">Không có dữ liệu</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((student, i) => (
                    <TableRow key={student.id} hover>
                      <TableCell sx={{ color: 'text.secondary', width: 40 }}>{i + 1}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: 13 }}>{student.username}</TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{student.fullName}</TableCell>
                      <TableCell>
                        <Chip label={student.className || '—'} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: 13 }}>{student.academicYearName || '—'}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: 13 }}>{student.school || '—'}</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {new Date(student.createdAt).toLocaleDateString('vi-VN')}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Tooltip title="Chỉnh sửa thông tin">
                          <IconButton size="small" color="primary" onClick={() => openEdit(student)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Đặt lại mật khẩu">
                          <IconButton size="small" color="warning" onClick={() => openReset(student)}>
                            <LockResetIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Xóa học sinh">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDelete(student.id)}
                            disabled={deleteLoading === student.id}
                          >
                            {deleteLoading === student.id ? <CircularProgress size={16} /> : <DeleteIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Container>

      {/* Dialog chỉnh sửa */}
      <Dialog open={Boolean(editStudent)} onClose={() => setEditStudent(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Chỉnh sửa: {editStudent?.fullName}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Username" value={editForm.username} onChange={(e) => setEditForm((p) => ({ ...p, username: e.target.value }))} size="small" fullWidth />
          <TextField label="Họ và tên" value={editForm.fullName} onChange={(e) => setEditForm((p) => ({ ...p, fullName: e.target.value }))} size="small" fullWidth />
          <TextField label="Lớp" value={editForm.className} onChange={(e) => setEditForm((p) => ({ ...p, className: e.target.value }))} size="small" fullWidth />
          <TextField label="Năm học" value={editForm.academicYearName} onChange={(e) => setEditForm((p) => ({ ...p, academicYearName: e.target.value }))} size="small" fullWidth helperText="Ví dụ: 2025-2026" />
          <TextField label="Trường" value={editForm.school} onChange={(e) => setEditForm((p) => ({ ...p, school: e.target.value }))} size="small" fullWidth />
          {editError && <Alert severity="error">{editError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditStudent(null)}>Hủy</Button>
          <Button variant="contained" onClick={handleEditSave} disabled={editSaving}>
            {editSaving ? <CircularProgress size={18} /> : 'Lưu'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog đặt lại mật khẩu */}
      <Dialog open={Boolean(resetStudent)} onClose={() => setResetStudent(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Đặt lại mật khẩu: {resetStudent?.fullName}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            fullWidth
            label="Mật khẩu mới"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            size="small"
            helperText="Ít nhất 6 ký tự"
          />
          {resetError && <Alert severity="error" sx={{ mt: 1 }}>{resetError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetStudent(null)}>Hủy</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleResetPassword}
            disabled={resetSaving || newPassword.length < 6}
          >
            {resetSaving ? <CircularProgress size={18} /> : 'Đặt lại'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
