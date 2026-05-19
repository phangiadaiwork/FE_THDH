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
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import OndemandVideoIcon from '@mui/icons-material/OndemandVideo';
import Navbar from '../components/Navbar';
import MathText from '../components/MathText';
import api from '../api';

const GRADE_OPTIONS = ['10', '11', '12'];

function extractYouTubeId(url = '') {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const patterns = [
    /(?:youtube\.com\/watch\?[^#]*?\bv=)([A-Za-z0-9_-]{11})/,
    /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/live\/)([A-Za-z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m) return m[1];
  }
  return '';
}

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

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>?/gm, '');
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
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileViewDetail, setMobileViewDetail] = useState(false);

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
      if (statusFilter === 'ALL') {
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          return (
            lesson.lessonTitle.toLowerCase().includes(query) ||
            (lesson.theoryContent && stripHtml(lesson.theoryContent).toLowerCase().includes(query))
          );
        }
        return true;
      }
      const statusMatch = (lesson.attemptSummary?.status || 'NOT_STARTED') === statusFilter;
      if (!statusMatch) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          lesson.lessonTitle.toLowerCase().includes(query) ||
          (lesson.theoryContent && stripHtml(lesson.theoryContent).toLowerCase().includes(query))
        );
      }
      return true;
    });
    return sortLessons(filtered, sortBy);
  }, [chapters, selectedChapterKey, sortBy, statusFilter, searchQuery]);

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
                            <MathText>{chapter.chapterTitle}</MathText> ({chapter.lessons.length} bài)
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
              <Grid item xs={12} lg={4} sx={{ display: { xs: mobileViewDetail ? 'none' : 'block', lg: 'block' } }}>
                <Paper sx={{ p: 2, borderRadius: 4, bgcolor: '#fff', border: '1px solid #efe2ce', height: { xs: 'auto', lg: 'calc(100vh - 100px)' }, maxHeight: { xs: '600px', lg: 'none' }, position: { lg: 'sticky' }, top: { lg: 24 }, display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="h6" fontWeight={800} sx={{ color: '#5d3c15', mb: 0.5, fontSize: { xs: '0.95rem', md: '1.05rem' } }}>
                    Danh sách bài học
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: { xs: '0.7rem', md: '0.8rem' } }}>
                    {selectedGrade ? `Lớp ${selectedGrade}` : 'Chưa chọn khối lớp'}
                    {chapters.find((chapter) => chapter.key === selectedChapterKey)
                      ? <> • <MathText>{chapters.find((chapter) => chapter.key === selectedChapterKey)?.chapterTitle}</MathText></>
                      : ''}
                  </Typography>

                  <Box sx={{ mb: 1.5 }}>
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
                  </Box>

                  <Stack spacing={1} sx={{ flex: 1, overflowY: 'auto', pr: 1, WebkitOverflowScrolling: 'touch' }}>
                    {visibleLessons.map((lesson) => {
                      const status = lesson.attemptSummary?.status || 'NOT_STARTED';
                      const meta = STATUS_META[status];

                      return (
                        <Card
                          key={lesson.id}
                          onClick={() => {
                            setSelectedLessonId(lesson.id);
                            if (window.innerWidth < 1200) setMobileViewDetail(true);
                          }}
                          sx={{
                            borderRadius: 3,
                            border: selectedLessonId === lesson.id ? '2px solid #8c5c22' : '1px solid #efe2ce',
                            background: selectedLessonId === lesson.id
                              ? 'linear-gradient(135deg, #fffaf2 0%, #ffffff 100%)'
                              : '#fff',
                            cursor: 'pointer',
                            boxShadow: 'none',
                            flexShrink: 0,
                          }}
                        >
                          <CardContent sx={{ '&:last-child': { pb: 1.5 }, p: 1.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Box sx={{ flex: 1, pr: 1 }}>
                                <Stack spacing={0.6}>
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

                                  <Typography variant="body2" component="span" fontWeight={800} sx={{ color: '#5d3c15', fontSize: { xs: '0.95rem', md: '1rem' } }}>
                                    <MathText>{lesson.lessonTitle}</MathText>
                                  </Typography>
                                </Stack>
                              </Box>

                              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', ml: 1 }}>
                                <Button
                                  variant="contained"
                                  startIcon={status === 'IN_PROGRESS' ? <AutorenewIcon /> : status === 'COMPLETED' ? <RestartAltIcon /> : <PlayArrowIcon />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/student/exam/${lesson.id}`);
                                  }}
                                  sx={{ textTransform: 'none', bgcolor: '#8c5c22', '&:hover': { bgcolor: '#724619' }, fontSize: '0.78rem' }}
                                  size="small"
                                >
                                  {getActionLabel(status, lesson.attemptSummary?.attemptCount)}
                                </Button>

                                {lesson.attemptSummary?.canReview && (
                                  <Button
                                    variant="outlined"
                                    startIcon={<VisibilityIcon />}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/student/exam/${lesson.id}?mode=review`);
                                    }}
                                    sx={{ textTransform: 'none', fontSize: '0.78rem' }}
                                    size="small"
                                  >
                                    Xem
                                  </Button>
                                )}
                              </Box>
                            </Box>
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

              <Grid item xs={12} lg={8} sx={{ display: { xs: mobileViewDetail ? 'block' : 'none', lg: 'block' } }}>
                {selectedLesson ? (
                  <Paper
                    sx={{
                      p: { xs: 1.5, sm: 2, md: 3 },
                      borderRadius: 5,
                      border: '1px solid #efe2ce',
                      background: 'linear-gradient(180deg, #fffdf9 0%, #fff6ea 100%)',
                    }}
                  >
                    {mobileViewDetail && (
                      <Button
                        onClick={() => setMobileViewDetail(false)}
                        sx={{ mb: 1.5, textTransform: 'none', color: '#8c5c22', fontSize: '0.9rem' }}
                      >
                        ← Quay lại
                      </Button>
                    )}
                    <Stack
                      direction={{ xs: 'column', lg: 'row' }}
                      spacing={{ xs: 2, lg: 3 }}
                      alignItems={{ lg: 'flex-start' }}
                    >
                      <Box sx={{ flex: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 1.5 }}>
                          <AutoStoriesIcon sx={{ color: '#8c5c22', mt: 0.5, flexShrink: 0, fontSize: { xs: '1.5rem', md: '1.75rem' } }} />
                          <Typography variant="h6" component="span" fontWeight={800} sx={{ color: '#5d3c15', fontSize: { xs: '1rem', md: '1.35rem' }, lineHeight: 1.3 }}>
                            <MathText>{selectedLesson.lessonTitle}</MathText>
                          </Typography>
                        </Stack>

                        {(() => {
                          const hasTheoryText = Boolean(selectedLesson.theoryContent && String(selectedLesson.theoryContent).replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim());
                          const hasTheoryPdf = Boolean(selectedLesson.theoryPdf);
                          const hasTheoryVideos = Array.isArray(selectedLesson.theoryVideos) && selectedLesson.theoryVideos.some((v) => extractYouTubeId(typeof v === 'string' ? v : v?.url || ''));
                          const hasAnyTheory = hasTheoryText || hasTheoryPdf || hasTheoryVideos;
                          return (
                            <>
                              <Typography variant="body2" fontWeight={700} sx={{ mb: 0.8, color: '#7a4f1d', fontSize: { xs: '0.9rem', md: '1rem' } }}>
                                Lý thuyết
                              </Typography>
                              {hasTheoryText ? (
                                <Typography component="div" sx={{ whiteSpace: 'pre-line', lineHeight: 1.7, fontSize: { xs: '0.85rem', md: '0.95rem' }, mb: 1.5 }}>
                                  <MathText component="div">{selectedLesson.theoryContent}</MathText>
                                </Typography>
                              ) : !hasAnyTheory ? (
                                <Typography component="div" sx={{ lineHeight: 1.7, fontSize: { xs: '0.85rem', md: '0.95rem' }, mb: 1.5, color: 'text.secondary' }}>
                                  Bài này chưa có phần lý thuyết chi tiết.
                                </Typography>
                              ) : null}
                            </>
                          );
                        })()}

                        {selectedLesson.theoryPdf && (
                          <Box sx={{ mt: 2, height: { xs: '80vh', md: '1200px' }, width: '100%', mb: 2, borderRadius: 2, overflow: 'hidden', border: '1px solid #e0e0e0' }}>
                            <iframe
                              src={selectedLesson.theoryPdf.startsWith('http') || selectedLesson.theoryPdf.startsWith('data:') ? selectedLesson.theoryPdf : `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}${selectedLesson.theoryPdf}`}
                              width="100%"
                              height="100%"
                              style={{ border: 'none' }}
                              title="Tài liệu lý thuyết (PDF)"
                            />
                          </Box>
                        )}

                        {Array.isArray(selectedLesson.theoryVideos) && selectedLesson.theoryVideos.length > 0 && (
                          <Box sx={{ mt: 2, mb: 2 }}>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.2 }}>
                              <OndemandVideoIcon sx={{ color: '#c4302b' }} />
                              <Typography variant="body2" fontWeight={700} sx={{ color: '#7a4f1d', fontSize: { xs: '0.9rem', md: '1rem' } }}>
                                Video bài giảng
                              </Typography>
                            </Stack>
                            <Stack spacing={2}>
                              {selectedLesson.theoryVideos.map((item, idx) => {
                                const rawUrl = typeof item === 'string' ? item : item?.url || '';
                                const title = typeof item === 'object' && item?.title ? item.title : `Video ${idx + 1}`;
                                const videoId = extractYouTubeId(rawUrl);
                                if (!videoId) return null;
                                return (
                                  <Box key={idx}>
                                    <Typography variant="caption" sx={{ color: '#5d3c15', fontWeight: 600 }}>
                                      {title}
                                    </Typography>
                                    <Box sx={{ mt: 0.5, position: 'relative', pt: '56.25%', borderRadius: 2, overflow: 'hidden', border: '1px solid #efe2ce', bgcolor: '#000' }}>
                                      <iframe
                                        src={`https://www.youtube.com/embed/${videoId}`}
                                        title={title}
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                                      />
                                    </Box>
                                  </Box>
                                );
                              })}
                            </Stack>
                          </Box>
                        )}

                        <Divider sx={{ my: 1.5 }} />

                        <Typography variant="body2" fontWeight={700} sx={{ mb: 0.8, color: '#7a4f1d', fontSize: { xs: '0.9rem', md: '1rem' } }}>
                          Bài tập
                        </Typography>
                        <Typography color="text.secondary" sx={{ mb: 1.5, fontSize: { xs: '0.8rem', md: '0.9rem' } }}>
                          Nhấn vào nút bên dưới để mở cây sơ đồ tư duy và luyện tập theo đúng thứ tự DFS.
                        </Typography>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1, mt: 2 }}>
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
                          alignSelf: { lg: 'flex-start' },
                          position: { lg: 'sticky' },
                          top: { lg: 0 },
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
