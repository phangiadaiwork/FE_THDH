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

function GradeCard({ selected, title, lessonCount, chapterCount, onClick }) {
  return (
    <Card
      onClick={onClick}
      sx={{
        cursor: 'pointer',
        height: '100%',
        borderRadius: 4,
        border: selected ? '2px solid #9c6b2f' : '1px solid #e6dccd',
        background: selected
          ? 'linear-gradient(135deg, #fff9f0 0%, #f7ebd5 100%)'
          : 'linear-gradient(135deg, #fffdf8 0%, #f7f1e7 100%)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          transform: 'translateY(-3px)',
          boxShadow: 6,
        },
      }}
    >
      <CardContent>
        <Typography variant="h6" fontWeight={700} sx={{ color: '#6b4b1f', mb: 1 }}>
          {title}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip label={`${chapterCount} chương`} size="small" sx={{ bgcolor: '#fff3db' }} />
          <Chip label={`${lessonCount} bài`} size="small" sx={{ bgcolor: '#fff3db' }} />
        </Stack>
      </CardContent>
    </Card>
  );
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
            <Typography variant="h5" fontWeight={800} sx={{ mb: 2, color: '#56391a' }}>
              Chọn khối lớp
            </Typography>

            <Grid container spacing={2} sx={{ mb: 4 }}>
              {gradeStats.map((grade) => (
                <Grid item xs={12} md={4} key={grade.gradeLevel}>
                  <GradeCard
                    selected={selectedGrade === grade.gradeLevel}
                    title={`Lớp ${grade.gradeLevel}`}
                    lessonCount={grade.lessonCount}
                    chapterCount={grade.chapterCount}
                    onClick={() => setSelectedGrade(grade.gradeLevel)}
                  />
                </Grid>
              ))}
            </Grid>

            <Grid container spacing={3}>
              <Grid item xs={12} lg={4}>
                <Paper sx={{ p: 2.5, borderRadius: 4, bgcolor: '#fffdf8', border: '1px solid #efe2ce' }}>
                  <Typography variant="h6" fontWeight={800} sx={{ color: '#6b4b1f', mb: 2 }}>
                    Danh mục chương
                  </Typography>

                  <Stack spacing={1.2}>
                    {chapters.length === 0 && (
                      <Typography color="text.secondary">
                        Khối này chưa có bài học được seed.
                      </Typography>
                    )}

                    {chapters.map((chapter) => (
                      <Button
                        key={chapter.key}
                        fullWidth
                        onClick={() => setSelectedChapterKey(chapter.key)}
                        variant={chapter.key === selectedChapterKey ? 'contained' : 'outlined'}
                        sx={{
                          justifyContent: 'space-between',
                          textTransform: 'none',
                          borderRadius: 3,
                          py: 1.2,
                          bgcolor: chapter.key === selectedChapterKey ? '#8c5c22' : 'transparent',
                          borderColor: '#d9c1a0',
                          color: chapter.key === selectedChapterKey ? 'white' : '#6b4b1f',
                          '&:hover': {
                            bgcolor: chapter.key === selectedChapterKey ? '#7b4f1e' : '#faf2e5',
                            borderColor: '#c4903d',
                          },
                        }}
                      >
                        <Box sx={{ textAlign: 'left' }}>
                          <Typography fontWeight={700}>{chapter.chapterTitle}</Typography>
                          <Typography variant="caption" sx={{ opacity: 0.85 }}>
                            {chapter.lessons.length} bài
                          </Typography>
                        </Box>
                      </Button>
                    ))}
                  </Stack>
                </Paper>
              </Grid>

              <Grid item xs={12} lg={8}>
                <Paper sx={{ p: 2.5, borderRadius: 4, bgcolor: '#fff', border: '1px solid #efe2ce', mb: 3 }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                      <InputLabel>Trạng thái</InputLabel>
                      <Select value={statusFilter} label="Trạng thái" onChange={(e) => setStatusFilter(e.target.value)}>
                        <MenuItem value="ALL">Tất cả</MenuItem>
                        <MenuItem value="NOT_STARTED">Chưa làm</MenuItem>
                        <MenuItem value="IN_PROGRESS">Đang làm</MenuItem>
                        <MenuItem value="COMPLETED">Đã hoàn thành</MenuItem>
                      </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ minWidth: 200 }}>
                      <InputLabel>Sắp xếp</InputLabel>
                      <Select value={sortBy} label="Sắp xếp" onChange={(e) => setSortBy(e.target.value)}>
                        <MenuItem value="default">Theo số bài</MenuItem>
                        <MenuItem value="status">Ưu tiên trạng thái</MenuItem>
                        <MenuItem value="score">Điểm cao trước</MenuItem>
                      </Select>
                    </FormControl>
                  </Stack>
                </Paper>

                <Grid container spacing={2.2}>
                  {visibleLessons.map((lesson) => {
                    const status = lesson.attemptSummary?.status || 'NOT_STARTED';
                    const meta = STATUS_META[status];

                    return (
                      <Grid item xs={12} key={lesson.id}>
                        <Card
                          onClick={() => setSelectedLessonId(lesson.id)}
                          sx={{
                            borderRadius: 4,
                            border: selectedLessonId === lesson.id ? '2px solid #8c5c22' : '1px solid #efe2ce',
                            background: selectedLessonId === lesson.id
                              ? 'linear-gradient(135deg, #fffaf2 0%, #ffffff 100%)'
                              : '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          <CardContent>
                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                              <Box sx={{ flex: 1 }}>
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
                                  <Chip label={lesson.chapterTitle} size="small" sx={{ bgcolor: '#f5ead8' }} />
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

                                <Typography variant="h6" fontWeight={800} sx={{ color: '#5d3c15', mb: 0.5 }}>
                                  {lesson.lessonNumber ? `Bài ${lesson.lessonNumber}: ` : ''}
                                  {lesson.lessonTitle}
                                </Typography>
                                <Typography color="text.secondary" sx={{ mb: 1.5 }}>
                                  {lesson.theoryContent?.slice(0, 160) || 'Chưa có nội dung lý thuyết.'}
                                  {lesson.theoryContent?.length > 160 ? '...' : ''}
                                </Typography>

                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                  <Chip icon={<MenuBookIcon />} label="Lý thuyết" size="small" variant="outlined" />
                                  <Chip icon={<AccountTreeIcon />} label={`${lesson.nodeCount} node bài tập`} size="small" variant="outlined" />
                                </Stack>
                              </Box>

                              <Stack spacing={1} justifyContent="center" sx={{ minWidth: { md: 170 } }}>
                                <Button
                                  variant="contained"
                                  startIcon={status === 'IN_PROGRESS' ? <AutorenewIcon /> : status === 'COMPLETED' ? <RestartAltIcon /> : <PlayArrowIcon />}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    navigate(`/student/exam/${lesson.id}`);
                                  }}
                                  sx={{ textTransform: 'none', bgcolor: '#8c5c22', '&:hover': { bgcolor: '#724619' } }}
                                >
                                  {getActionLabel(status, lesson.attemptSummary?.attemptCount)}
                                </Button>

                                {lesson.attemptSummary?.canReview && (
                                  <Button
                                    variant="outlined"
                                    startIcon={<VisibilityIcon />}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      navigate(`/student/exam/${lesson.id}?mode=review`);
                                    }}
                                    sx={{ textTransform: 'none' }}
                                  >
                                    Xem bài tập
                                  </Button>
                                )}
                              </Stack>
                            </Stack>
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}

                  {visibleLessons.length === 0 && (
                    <Grid item xs={12}>
                      <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 4 }}>
                        <Typography color="text.secondary">
                          Không có bài nào khớp bộ lọc hiện tại.
                        </Typography>
                      </Paper>
                    </Grid>
                  )}
                </Grid>
              </Grid>
            </Grid>

            {selectedLesson && (
              <Paper
                sx={{
                  mt: 4,
                  p: { xs: 2, md: 3.5 },
                  borderRadius: 5,
                  border: '1px solid #efe2ce',
                  background: 'linear-gradient(180deg, #fffdf9 0%, #fff6ea 100%)',
                }}
              >
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                      <AutoStoriesIcon sx={{ color: '#8c5c22' }} />
                      <Typography variant="h5" fontWeight={800} sx={{ color: '#5d3c15' }}>
                        {selectedLesson.lessonNumber ? `Bài ${selectedLesson.lessonNumber}: ` : ''}
                        {selectedLesson.lessonTitle}
                      </Typography>
                    </Stack>

                    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1, color: '#7a4f1d' }}>
                      Lý thuyết
                    </Typography>
                    <Typography sx={{ whiteSpace: 'pre-line', lineHeight: 1.8 }}>
                      {selectedLesson.theoryContent || 'Bài này chưa có phần lý thuyết chi tiết.'}
                    </Typography>

                    <Divider sx={{ my: 2.5 }} />

                    <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1, color: '#7a4f1d' }}>
                      Bài tập
                    </Typography>
                    <Typography color="text.secondary" sx={{ mb: 2 }}>
                      Nhấn vào nút bên dưới để mở cây sơ đồ tư duy và luyện tập theo đúng thứ tự DFS.
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2}>
                      <Button
                        variant="contained"
                        startIcon={<AccountTreeIcon />}
                        onClick={() => navigate(`/student/exam/${selectedLesson.id}`)}
                        sx={{ textTransform: 'none', bgcolor: '#8c5c22', '&:hover': { bgcolor: '#724619' } }}
                      >
                        {getActionLabel(selectedLesson.attemptSummary?.status || 'NOT_STARTED', selectedLesson.attemptSummary?.attemptCount)}
                      </Button>

                      {selectedLesson.attemptSummary?.canReview && (
                        <Button
                          variant="outlined"
                          startIcon={<VisibilityIcon />}
                          onClick={() => navigate(`/student/exam/${selectedLesson.id}?mode=review`)}
                          sx={{ textTransform: 'none' }}
                        >
                          Xem bài tập đã làm
                        </Button>
                      )}
                    </Stack>
                  </Box>

                  <Paper
                    elevation={0}
                    sx={{
                      width: { xs: '100%', md: 280 },
                      p: 2.5,
                      borderRadius: 4,
                      bgcolor: '#fff',
                      border: '1px solid #efe2ce',
                    }}
                  >
                    <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#5d3c15', mb: 1.5 }}>
                      Tiến độ của bạn
                    </Typography>
                    <Stack spacing={1.2}>
                      <Chip label={STATUS_META[selectedLesson.attemptSummary?.status || 'NOT_STARTED'].label} color={STATUS_META[selectedLesson.attemptSummary?.status || 'NOT_STARTED'].color} />
                      <Typography>Điểm cao nhất: {selectedLesson.attemptSummary?.bestScore ?? '—'}</Typography>
                      <Typography>Điểm trung bình: {selectedLesson.attemptSummary?.avgScore ?? '—'}</Typography>
                      <Typography>Số lần hoàn thành: {selectedLesson.attemptSummary?.attemptCount ?? 0}</Typography>
                    </Stack>
                  </Paper>
                </Stack>
              </Paper>
            )}
          </>
        )}
      </Container>
    </>
  );
}
