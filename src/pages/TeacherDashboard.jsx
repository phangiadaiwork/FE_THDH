import { useEffect, useMemo, useRef, useState } from 'react';
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
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
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
import EditIcon from '@mui/icons-material/Edit';
import Navbar from '../components/Navbar';
import api from '../api';

const GRADE_OPTIONS = ['10', '11', '12'];
const ADD_OPTION_VALUES = {
  className: '__add_class__',
  school: '__add_school__',
  academicYearName: '__add_academic_year__',
};

function sortLessons(lessons, sortBy) {
  const cloned = [...lessons];
  return cloned.sort((a, b) => {
    if (sortBy === 'chapter') {
      return (a.chapterDisplayOrder ?? 999) - (b.chapterDisplayOrder ?? 999) || a.chapterTitle.localeCompare(b.chapterTitle, 'vi');
    }

    if (sortBy === 'score') {
      const scoreA = a.avgScore ?? -1;
      const scoreB = b.avgScore ?? -1;
      return scoreB - scoreA;
    }

    return (a.lessonNumber ?? 999) - (b.lessonNumber ?? 999) || a.lessonTitle.localeCompare(b.lessonTitle, 'vi');
  });
}

function getApiErrorMessage(error, fallbackMessage) {
  const responseData = error?.response?.data;

  if (responseData?.error) {
    return responseData.error;
  }

  if (Array.isArray(responseData?.errors) && responseData.errors.length > 0) {
    return responseData.errors
      .map((item) => {
        if (item?.username && item?.error) {
          return `${item.username}: ${item.error}`;
        }

        return item?.error || item?.message || String(item);
      })
      .join('; ');
  }

  return error?.message || fallbackMessage;
}

function getBulkErrorsMessage(responseData) {
  if (!Array.isArray(responseData?.errors) || responseData.errors.length === 0) {
    return '';
  }

  return responseData.errors
    .map((item) => {
      const prefix = item?.username || `Dòng ${item?.rowNumber || '?'}`;
      return item?.error ? `${prefix}: ${item.error}` : prefix;
    })
    .join('; ');
}

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const [lessons, setLessons] = useState([]);
  const [classes, setClasses] = useState([]);
  const [classOptions, setClassOptions] = useState([]);
  const [schoolOptions, setSchoolOptions] = useState([]);
  const [academicYearOptions, setAcademicYearOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    className: '',
    school: '',
    academicYearName: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(null);
  const [visLesson, setVisLesson] = useState(null);
  const [visPublic, setVisPublic] = useState(true);
  const [visClasses, setVisClasses] = useState([]);
  const [visSaving, setVisSaving] = useState(false);
  const [importingStudents, setImportingStudents] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [optionDialogOpen, setOptionDialogOpen] = useState(false);
  const [optionDialogField, setOptionDialogField] = useState('');
  const [optionDialogLabel, setOptionDialogLabel] = useState('');
  const [optionDialogValue, setOptionDialogValue] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('12');
  const [selectedChapterKey, setSelectedChapterKey] = useState('');
  const [sortBy, setSortBy] = useState('default');
  const [searchQuery, setSearchQuery] = useState('');
  const studentFileRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [examRes, statsRes] = await Promise.all([
          api.get('/api/exams'),
          api.get('/api/attempts/stats'),
        ]);
        const exams = examRes.data || [];
        setLessons(exams);
        setClasses(statsRes.data.classes || []);
        const preferredGrade = exams[0]?.gradeLevel || '12';
        setSelectedGrade(preferredGrade);
      } catch (err) {
        console.error(err);
        setError('Không thể tải dữ liệu bảng điều khiển.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    const nextClassOptions = Array.from(new Set(classes.map((item) => item.name).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'vi'));
    const nextSchoolOptions = Array.from(new Set(classes.map((item) => item.school).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'vi'));
    const nextYearOptions = Array.from(new Set(classes.map((item) => item.academicYearName).filter(Boolean))).sort((a, b) => b.localeCompare(a, 'vi'));

    setClassOptions((prev) => Array.from(new Set([...prev.filter(Boolean), ...nextClassOptions])).sort((a, b) => a.localeCompare(b, 'vi')));
    setSchoolOptions((prev) => Array.from(new Set([...prev.filter(Boolean), ...nextSchoolOptions])).sort((a, b) => a.localeCompare(b, 'vi')));
    setAcademicYearOptions((prev) => Array.from(new Set([...prev.filter(Boolean), ...nextYearOptions])).sort((a, b) => b.localeCompare(a, 'vi')));
  }, [classes]);

  const gradeStats = useMemo(
    () =>
      GRADE_OPTIONS.map((gradeLevel) => {
        const lessonsInGrade = lessons.filter((lesson) => lesson.gradeLevel === gradeLevel);
        const chapterCount = new Set(lessonsInGrade.map((lesson) => lesson.chapterCode)).size;
        return {
          gradeLevel,
          lessonCount: lessonsInGrade.length,
          chapterCount,
        };
      }),
    [lessons]
  );

  const chapters = useMemo(() => {
    const lessonPool = lessons.filter((lesson) => lesson.gradeLevel === selectedGrade);
    const grouped = lessonPool.reduce((acc, lesson) => {
      const key = `${lesson.gradeLevel}-${lesson.chapterCode}`;
      if (!acc[key]) {
        acc[key] = {
          key,
          chapterCode: lesson.chapterCode,
          chapterTitle: lesson.chapterTitle,
          gradeLevel: lesson.gradeLevel,
          lessons: [],
        };
      }
      acc[key].lessons.push(lesson);
      return acc;
    }, {});

    return Object.values(grouped)
      .map((chapter) => ({
        ...chapter,
        lessons: sortLessons(chapter.lessons, 'default'),
      }))
      .sort((a, b) => {
        const firstA = a.lessons[0];
        const firstB = b.lessons[0];
        return (
          (firstA?.chapterDisplayOrder ?? 999) - (firstB?.chapterDisplayOrder ?? 999) ||
          a.chapterTitle.localeCompare(b.chapterTitle, 'vi')
        );
      });
  }, [lessons, selectedGrade]);

  useEffect(() => {
    if (!selectedGrade) return;
    const firstChapter = chapters[0]?.key || '';
    setSelectedChapterKey((current) =>
      current && chapters.some((chapter) => chapter.key === current) ? current : firstChapter
    );
  }, [chapters, selectedGrade]);

  const visibleLessons = useMemo(() => {
    const chapter = chapters.find((item) => item.key === selectedChapterKey);
    const lessonPool = chapter?.lessons || [];
    const filtered = lessonPool.filter((lesson) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          lesson.lessonTitle.toLowerCase().includes(query) ||
          (lesson.theoryContent && lesson.theoryContent.toLowerCase().includes(query))
        );
      }
      return true;
    });
    return sortLessons(filtered, sortBy);
  }, [chapters, selectedChapterKey, sortBy, searchQuery]);

  const openAddOptionDialog = (field, label) => {
    setOptionDialogField(field);
    setOptionDialogLabel(label);
    setOptionDialogValue('');
    setOptionDialogOpen(true);
  };

  const handleAddOptionValue = () => {
    const nextValue = optionDialogValue.trim();
    if (!nextValue) return;

    if (optionDialogField === 'className') {
      setClassOptions((prev) => Array.from(new Set([...prev, nextValue])).sort((a, b) => a.localeCompare(b, 'vi')));
    }

    if (optionDialogField === 'school') {
      setSchoolOptions((prev) => Array.from(new Set([...prev, nextValue])).sort((a, b) => a.localeCompare(b, 'vi')));
    }

    if (optionDialogField === 'academicYearName') {
      setAcademicYearOptions((prev) => Array.from(new Set([...prev, nextValue])).sort((a, b) => b.localeCompare(a, 'vi')));
    }

    setFormData((prev) => ({ ...prev, [optionDialogField]: nextValue }));
    setOptionDialogOpen(false);
  };

  const handleSelectChange = (field, value) => {
    if (field === 'className' && value === ADD_OPTION_VALUES.className) {
      openAddOptionDialog('className', 'Thêm lớp mới');
      return;
    }

    if (field === 'school' && value === ADD_OPTION_VALUES.school) {
      openAddOptionDialog('school', 'Thêm trường mới');
      return;
    }

    if (field === 'academicYearName' && value === ADD_OPTION_VALUES.academicYearName) {
      openAddOptionDialog('academicYearName', 'Thêm năm học mới');
      return;
    }

    setFormData((prev) => ({ ...prev, [field]: value }));
  };

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

  const handleAddStudent = async () => {
    setFormError('');

    if (!formData.username.trim() || !formData.password.trim() || !formData.fullName.trim() || !formData.className.trim()) {
      setFormError('Vui lòng điền đầy đủ thông tin: tài khoản, mật khẩu, họ tên, lớp.');
      return;
    }

    setFormLoading(true);
    try {
      const { data } = await api.post('/api/students/bulk', {
        students: [formData],
      });

      const bulkErrorsMessage = getBulkErrorsMessage(data);
      if (bulkErrorsMessage) {
        setFormError(bulkErrorsMessage);
        return;
      }

      setFormOpen(false);
      setFormData({
        username: '',
        password: '',
        fullName: '',
        className: '',
        school: '',
        academicYearName: '',
      });
      const { data: statsData } = await api.get('/api/attempts/stats');
      setClasses(statsData.classes || []);
    } catch (err) {
      const errorMessage = getApiErrorMessage(err, 'Tạo tài khoản thất bại.');
      setFormError(errorMessage);
    } finally {
      setFormLoading(false);
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
    setImportError('');
    setImportSuccess('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data: importData } = await api.post('/api/students/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const bulkErrorsMessage = getBulkErrorsMessage(importData);
      if (bulkErrorsMessage) {
        setImportError(bulkErrorsMessage);
        return;
      }

      const { data: statsData } = await api.get('/api/attempts/stats');
      setClasses(statsData.classes || []);
      setImportSuccess('Import học sinh thành công!');
      setTimeout(() => setImportSuccess(''), 4000);
    } catch (err) {
      const errorMessage = getApiErrorMessage(err, 'Import học sinh thất bại.');
      setImportError(errorMessage);
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
            <Button variant="outlined" startIcon={<PeopleIcon />} onClick={() => setFormOpen(true)} sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.45)' }}>
              Nhập học sinh
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
        {importError && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setImportError('')}>{importError}</Alert>}
        {importSuccess && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setImportSuccess('')}>{importSuccess}</Alert>}

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
          <>
            <Paper sx={{ p: 2, borderRadius: 4, bgcolor: '#fffdf8', border: '1px solid #efe2ce', mb: 3 }}>
              <Grid container spacing={1.5}>
                <Grid item xs={6} sm={6} md={4}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Khối lớp</InputLabel>
                    <Select
                      value={selectedGrade}
                      label="Khối lớp"
                      onChange={(e) => setSelectedGrade(e.target.value)}
                    >
                      {gradeStats.map((grade) => (
                        <MenuItem key={grade.gradeLevel} value={grade.gradeLevel}>
                          Lớp {grade.gradeLevel} ({grade.lessonCount} bài)
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={6} sm={6} md={4}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Danh mục chương</InputLabel>
                    <Select
                      value={selectedChapterKey}
                      label="Danh mục chương"
                      onChange={(e) => setSelectedChapterKey(e.target.value)}
                    >
                      {chapters.length === 0 ? (
                        <MenuItem value="" disabled>
                          Chưa có chương nào
                        </MenuItem>
                      ) : (
                        chapters.map((chapter) => (
                          <MenuItem key={chapter.key} value={chapter.key}>
                            {chapter.chapterTitle} ({chapter.lessons.length} bài)
                          </MenuItem>
                        ))
                      )}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Sắp xếp</InputLabel>
                    <Select value={sortBy} label="Sắp xếp" onChange={(e) => setSortBy(e.target.value)}>
                      <MenuItem value="default">Theo số bài</MenuItem>
                      <MenuItem value="chapter">Theo chương</MenuItem>
                      <MenuItem value="score">Điểm trung bình</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <input
                    type="text"
                    placeholder="Tìm kiếm bài học..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #d9c1a0',
                      fontSize: '0.85rem',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                    }}
                  />
                </Grid>
              </Grid>
            </Paper>

            <Grid container spacing={2.5}>
              {visibleLessons.map((lesson) => (
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
                    <Box>
                      <Tooltip title="Sửa bài học">
                        <IconButton color="primary" onClick={() => navigate(`/teacher/edit-exam/${lesson.id}`)}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Xóa bài học">
                        <IconButton color="error" onClick={() => handleDelete(lesson.id)} disabled={deleteLoading === lesson.id}>
                          {deleteLoading === lesson.id ? <CircularProgress size={18} /> : <DeleteIcon />}
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>

          {visibleLessons.length === 0 && (
            <Paper sx={{ p: 3, textAlign: 'center', borderRadius: 4, bgcolor: '#fffdf8', border: '1px solid #efe2ce' }}>
              <Typography color="text.secondary">
                Không có bài nào khớp bộ lọc hiện tại.
              </Typography>
            </Paper>
          )}
          </>
        )}
      </Container>

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nhập học sinh mới</DialogTitle>
        <DialogContent>
          {formError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {formError}
            </Alert>
          )}
          <Stack spacing={1.5} sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Tài khoản"
              size="small"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="hs12a1"
            />
            <TextField
              fullWidth
              label="Mật khẩu"
              type="password"
              size="small"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="123456"
            />
            <TextField
              fullWidth
              label="Họ tên"
              size="small"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              placeholder="Nguyễn Văn A"
            />
            <FormControl fullWidth size="small">
              <InputLabel>Lớp</InputLabel>
              <Select
                value={formData.className}
                label="Lớp"
                onChange={(e) => handleSelectChange('className', e.target.value)}
              >
                {classOptions.length === 0 ? (
                  <MenuItem value="" disabled>
                    Chưa có lớp nào
                  </MenuItem>
                ) : (
                  classOptions.map((className) => (
                    <MenuItem key={className} value={className}>
                      {className}
                    </MenuItem>
                  ))
                )}
                <MenuItem value={ADD_OPTION_VALUES.className} sx={{ color: '#8c5c22', fontWeight: 700 }}>
                  <AddIcon fontSize="small" sx={{ mr: 1 }} />
                  Thêm lớp mới...
                </MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Trường</InputLabel>
              <Select
                value={formData.school}
                label="Trường"
                onChange={(e) => handleSelectChange('school', e.target.value)}
              >
                {schoolOptions.length === 0 ? (
                  <MenuItem value="" disabled>
                    Chưa có trường nào
                  </MenuItem>
                ) : (
                  schoolOptions.map((school) => (
                    <MenuItem key={school} value={school}>
                      {school}
                    </MenuItem>
                  ))
                )}
                <MenuItem value={ADD_OPTION_VALUES.school} sx={{ color: '#8c5c22', fontWeight: 700 }}>
                  <AddIcon fontSize="small" sx={{ mr: 1 }} />
                  Thêm trường mới...
                </MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Năm học</InputLabel>
              <Select
                value={formData.academicYearName}
                label="Năm học"
                onChange={(e) => handleSelectChange('academicYearName', e.target.value)}
              >
                {academicYearOptions.length === 0 ? (
                  <MenuItem value="" disabled>
                    Chưa có năm học nào
                  </MenuItem>
                ) : (
                  academicYearOptions.map((academicYearName) => (
                    <MenuItem key={academicYearName} value={academicYearName}>
                      {academicYearName}
                    </MenuItem>
                  ))
                )}
                <MenuItem value={ADD_OPTION_VALUES.academicYearName} sx={{ color: '#8c5c22', fontWeight: 700 }}>
                  <AddIcon fontSize="small" sx={{ mr: 1 }} />
                  Thêm năm học mới...
                </MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>Hủy</Button>
          <Button variant="contained" onClick={handleAddStudent} disabled={formLoading}>
            {formLoading ? <CircularProgress size={18} color="inherit" /> : 'Thêm học sinh'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={optionDialogOpen} onClose={() => setOptionDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{optionDialogLabel}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            value={optionDialogValue}
            onChange={(e) => setOptionDialogValue(e.target.value)}
            placeholder={`Nhập ${optionDialogLabel.toLowerCase()}`}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOptionDialogOpen(false)}>Hủy</Button>
          <Button variant="contained" onClick={handleAddOptionValue} disabled={!optionDialogValue.trim()}>
            Thêm
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
