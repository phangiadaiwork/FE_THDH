import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import Navbar from '../components/Navbar';
import api from '../api';

const GRADE_OPTIONS = ['10', '11', '12'];

const STATUS_META = {
  NOT_STARTED: { label: 'Chưa làm', color: 'default' },
  IN_PROGRESS: { label: 'Đang làm', color: 'warning' },
  COMPLETED: { label: 'Đã hoàn thành', color: 'success' },
};

function sortLessons(lessons, sortBy) {
  const cloned = [...lessons];
  return cloned.sort((a, b) => {
    if (sortBy === 'status') {
      const statusOrder = { IN_PROGRESS: 0, NOT_STARTED: 1, COMPLETED: 2 };
      return (
        statusOrder[a.attemptSummary?.status || 'NOT_STARTED'] -
          statusOrder[b.attemptSummary?.status || 'NOT_STARTED'] ||
        (a.lessonNumber ?? 999) - (b.lessonNumber ?? 999)
      );
    }

    if (sortBy === 'score') {
      return (b.attemptSummary?.bestScore ?? -1) - (a.attemptSummary?.bestScore ?? -1);
    }

    return (
      (a.lessonNumber ?? 999) - (b.lessonNumber ?? 999) ||
      a.lessonTitle.localeCompare(b.lessonTitle, 'vi')
    );
  });
}

function getActionLabel(status, attemptCount) {
  if (status === 'IN_PROGRESS') return 'Tiếp tục';
  if ((attemptCount || 0) > 0) return 'Làm lại';
  return 'Bắt đầu';
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedChapterKey, setSelectedChapterKey] = useState('');
  const [selectedLessonId, setSelectedLessonId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('default');

  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  })();

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const { data } = await api.get('/api/exams/catalog');
        const catalogLessons = data.lessons || [];
        setLessons(catalogLessons);

        const preferredGrade = user.gradeLevel || catalogLessons[0]?.gradeLevel || '12';
        setSelectedGrade(preferredGrade);
      } catch (err) {
        console.error(err);
        setError('Không thể tải học liệu. Vui lòng thử lại.');
      } finally {
        setLoading(false);
      }
    };

    fetchCatalog();
  }, [user.gradeLevel]);

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
      if (statusFilter === 'ALL') return true;
      return (lesson.attemptSummary?.status || 'NOT_STARTED') === statusFilter;
    });
    return sortLessons(filtered, sortBy);
  }, [chapters, selectedChapterKey, sortBy, statusFilter]);

  useEffect(() => {
    if (visibleLessons.length === 0) {
      setSelectedLessonId(null);
      return;
    }

    setSelectedLessonId((current) =>
      current && visibleLessons.some((lesson) => lesson.id === current)
        ? current
        : visibleLessons[0].id
    );
  }, [visibleLessons]);

  const selectedLesson = useMemo(
    () => visibleLessons.find((lesson) => lesson.id === selectedLessonId) || null,
    [selectedLessonId, visibleLessons]
  );

  return (
    <>
      <Navbar />
      <Container maxWidth="xl" sx={{ mt: { xs: 2, md: 4 }, mb: 6 }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 3.5 },
            borderRadius: 5,
            background: 'linear-gradient(135deg, #7a4f1d 0%, #c4903d 100%)',
            color: 'white',
            mb: 4,
          }}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <SchoolIcon sx={{ fontSize: 42 }} />
              <Box>
                <Typography variant="h4" fontWeight={800} sx={{ fontSize: { xs: '1.5rem', md: '2.2rem' } }}>
                  Học liệu Toán
                </Typography>
                <Typography sx={{ opacity: 0.9 }}>
                  {user.fullName} • {user.className || 'Chưa gán lớp'}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ flex: 1 }} />
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip label={`Khối ưu tiên: ${user.gradeLevel || '12'}`} sx={{ bgcolor: 'rgba(255,255,255,0.16)', color: 'white' }} />
              <Chip label={`${lessons.length} bài học`} sx={{ bgcolor: 'rgba(255,255,255,0.16)', color: 'white' }} />
            </Stack>
          </Stack>
        </Paper>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        {loading ? (
          <Box sx={{ py: 10, textAlign: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Paper sx={{ p: 2, borderRadius: 4, bgcolor: '#fffdf8', border: '1px solid #efe2ce', mb: 3 }}>
              <Grid container spacing={1.5}>
                <Grid item xs={6} sm={6} md={3}>
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

                <Grid item xs={6} sm={6} md={3}>
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

                <Grid item xs={6} sm={6} md={3}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Trạng thái</InputLabel>
                    <Select value={statusFilter} label="Trạng thái" onChange={(e) => setStatusFilter(e.target.value)}>
                      <MenuItem value="ALL">Tất cả</MenuItem>
                      <MenuItem value="NOT_STARTED">Chưa làm</MenuItem>
                      <MenuItem value="IN_PROGRESS">Đang làm</MenuItem>
                      <MenuItem value="COMPLETED">Đã hoàn thành</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={6} sm={6} md={3}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Sắp xếp</InputLabel>
                    <Select value={sortBy} label="Sắp xếp" onChange={(e) => setSortBy(e.target.value)}>
                      <MenuItem value="default">Theo số bài</MenuItem>
                      <MenuItem value="status">Ưu tiên trạng thái</MenuItem>
                      <MenuItem value="score">Điểm cao trước</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Paper>

            <Grid container spacing={3}>
              <Grid item xs={12} lg={4}>
                <Paper sx={{ p: 2, borderRadius: 4, bgcolor: '#fff', border: '1px solid #efe2ce', height: { lg: 'calc(100vh - 380px)' }, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="h6" fontWeight={800} sx={{ color: '#5d3c15', mb: 1, fontSize: { xs: '0.95rem', md: '1.05rem' } }}>
                    Danh sách bài học
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontSize: { xs: '0.75rem', md: '0.85rem' } }}>
                    {selectedGrade ? `Lớp ${selectedGrade}` : 'Chưa chọn khối lớp'}
                    {chapters.find((chapter) => chapter.key === selectedChapterKey)
                      ? ` • ${chapters.find((chapter) => chapter.key === selectedChapterKey)?.chapterTitle}`
                      : ''}
                  </Typography>

                  <Stack spacing={1} sx={{ flex: 1, overflowY: 'auto', pr: 1 }}>
                    {visibleLessons.map((lesson) => {
                      const status = lesson.attemptSummary?.status || 'NOT_STARTED';
                      const meta = STATUS_META[status];

                      return (
                        <Card
                          key={lesson.id}
                          onClick={() => setSelectedLessonId(lesson.id)}
                          sx={{
                            borderRadius: 3,
                            border: selectedLessonId === lesson.id ? '2px solid #8c5c22' : '1px solid #efe2ce',
                            background: selectedLessonId === lesson.id
                              ? 'linear-gradient(135deg, #fffaf2 0%, #ffffff 100%)'
                              : '#fff',
                            cursor: 'pointer',
                            boxShadow: 'none',
                          }}
                        >
                          <CardContent sx={{ '&:last-child': { pb: 1.5 }, p: 1.5 }}>
                            <Stack spacing={0.8}>
                              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                <Chip label={meta.label} size="small" color={meta.color} />
                                {lesson.attemptSummary?.avgScore !== null && (
                                  <Chip
                                    label={`TB ${lesson.attemptSummary.avgScore}`}
                                    size="small"
                                    color="success"
                                    variant="outlined"
                                  />
                                )}
                              </Stack>

                              <Box>
                                <Typography variant="body2" fontWeight={800} sx={{ color: '#5d3c15', fontSize: { xs: '0.85rem', md: '0.95rem' } }}>
                                  {lesson.lessonNumber ? `Bài ${lesson.lessonNumber}: ` : ''}
                                  {lesson.lessonTitle}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.3, display: 'block', fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
                                  {lesson.theoryContent?.slice(0, 100) || 'Chưa có nội dung lý thuyết.'}
                                  {lesson.theoryContent?.length > 100 ? '...' : ''}
                                </Typography>
                              </Box>

                              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                <Chip icon={<MenuBookIcon />} label="Lý thuyết" size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                                <Chip icon={<AccountTreeIcon />} label={`${lesson.nodeCount}N`} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                              </Stack>
                            </Stack>
                          </CardContent>
                        </Card>
                      );
                    })}

                    {visibleLessons.length === 0 && (
                      <Paper sx={{ p: 2, textAlign: 'center', borderRadius: 3, bgcolor: '#fffdf8' }}>
                        <Typography color="text.secondary" variant="body2">
                          Không có bài nào khớp bộ lọc hiện tại.
                        </Typography>
                      </Paper>
                    )}
                  </Stack>
                </Paper>
              </Grid>

              <Grid item xs={12} lg={8}>
                {selectedLesson ? (
                  <Paper
                    sx={{
                      p: { xs: 1.5, sm: 2, md: 3 },
                      borderRadius: 5,
                      border: '1px solid #efe2ce',
                      background: 'linear-gradient(180deg, #fffdf9 0%, #fff6ea 100%)',
                      position: { lg: 'sticky' },
                      top: { lg: 24 },
                      height: { lg: 'calc(100vh - 380px)' },
                      overflow: { lg: 'auto' },
                    }}
                  >
                    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={{ xs: 2, lg: 3 }}>
                      <Box sx={{ flex: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 1.5 }}>
                          <AutoStoriesIcon sx={{ color: '#8c5c22', mt: 0.5, flexShrink: 0, fontSize: { xs: '1.5rem', md: '1.75rem' } }} />
                          <Typography variant="h6" fontWeight={800} sx={{ color: '#5d3c15', fontSize: { xs: '1rem', md: '1.35rem' }, lineHeight: 1.3 }}>
                            {selectedLesson.lessonNumber ? `Bài ${selectedLesson.lessonNumber}: ` : ''}
                            {selectedLesson.lessonTitle}
                          </Typography>
                        </Stack>

                        <Typography variant="body2" fontWeight={700} sx={{ mb: 0.8, color: '#7a4f1d', fontSize: { xs: '0.9rem', md: '1rem' } }}>
                          Lý thuyết
                        </Typography>
                        <Typography sx={{ whiteSpace: 'pre-line', lineHeight: 1.7, fontSize: { xs: '0.85rem', md: '0.95rem' }, mb: 1.5 }}>
                          {selectedLesson.theoryContent || 'Bài này chưa có phần lý thuyết chi tiết.'}
                        </Typography>

                        <Divider sx={{ my: 1.5 }} />

                        <Typography variant="body2" fontWeight={700} sx={{ mb: 0.8, color: '#7a4f1d', fontSize: { xs: '0.9rem', md: '1rem' } }}>
                          Bài tập
                        </Typography>
                        <Typography color="text.secondary" sx={{ mb: 1.5, fontSize: { xs: '0.8rem', md: '0.9rem' } }}>
                          Nhấn vào nút bên dưới để mở cây sơ đồ tư duy và luyện tập theo đúng thứ tự DFS.
                        </Typography>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1 }}>
                          <Button
                            variant="contained"
                            startIcon={<AccountTreeIcon />}
                            onClick={() => navigate(`/student/exam/${selectedLesson.id}`)}
                            sx={{ textTransform: 'none', bgcolor: '#8c5c22', '&:hover': { bgcolor: '#724619' }, fontSize: { xs: '0.8rem', md: '0.9rem' } }}
                            size="small"
                          >
                            {getActionLabel(selectedLesson.attemptSummary?.status || 'NOT_STARTED', selectedLesson.attemptSummary?.attemptCount)}
                          </Button>

                          {selectedLesson.attemptSummary?.canReview && (
                            <Button
                              variant="outlined"
                              startIcon={<VisibilityIcon />}
                              onClick={() => navigate(`/student/exam/${selectedLesson.id}?mode=review`)}
                              sx={{ textTransform: 'none', fontSize: { xs: '0.8rem', md: '0.9rem' } }}
                              size="small"
                            >
                              Xem bài tập đã làm
                            </Button>
                          )}
                        </Stack>
                      </Box>

                      <Paper
                        elevation={0}
                        sx={{
                          width: { xs: '100%', lg: 240 },
                          p: { xs: 1.5, md: 2 },
                          borderRadius: 4,
                          bgcolor: '#fff',
                          border: '1px solid #efe2ce',
                          flexShrink: 0,
                        }}
                      >
                        <Typography variant="body2" fontWeight={800} sx={{ color: '#5d3c15', mb: 1, fontSize: { xs: '0.85rem', md: '0.95rem' } }}>
                          Tiến độ của bạn
                        </Typography>
                        <Stack spacing={0.8}>
                          <Chip label={STATUS_META[selectedLesson.attemptSummary?.status || 'NOT_STARTED'].label} color={STATUS_META[selectedLesson.attemptSummary?.status || 'NOT_STARTED'].color} size="small" />
                          <Typography sx={{ fontSize: { xs: '0.8rem', md: '0.9rem' } }}>Điểm cao nhất: <strong>{selectedLesson.attemptSummary?.bestScore ?? '—'}</strong></Typography>
                          <Typography sx={{ fontSize: { xs: '0.8rem', md: '0.9rem' } }}>Điểm trung bình: <strong>{selectedLesson.attemptSummary?.avgScore ?? '—'}</strong></Typography>
                          <Typography sx={{ fontSize: { xs: '0.8rem', md: '0.9rem' } }}>Số lần hoàn thành: <strong>{selectedLesson.attemptSummary?.attemptCount ?? 0}</strong></Typography>
                        </Stack>
                      </Paper>
                    </Stack>
                  </Paper>
                ) : (
                  <Paper sx={{ p: { xs: 2, md: 4 }, borderRadius: 5, textAlign: 'center', border: '1px solid #efe2ce', minHeight: { xs: 200, lg: 'calc(100vh - 380px)' }, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography color="text.secondary" sx={{ fontSize: { xs: '0.9rem', md: '1rem' } }}>
                      Chọn một bài bên trái để xem nội dung chi tiết.
                    </Typography>
                  </Paper>
                )}
              </Grid>
            </Grid>
          </>
        )}
      </Container>
    </>
  );
}
