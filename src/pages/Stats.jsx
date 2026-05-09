import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BarChartIcon from '@mui/icons-material/BarChart';
import BubbleChartIcon from '@mui/icons-material/BubbleChart';
import PeopleIcon from '@mui/icons-material/People';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Navbar from '../components/Navbar';
import api from '../api';

const STATUS_LABEL = {
  NOT_STARTED: 'Chưa làm',
  IN_PROGRESS: 'Đang làm',
  COMPLETED: 'Hoàn thành',
};

function AverageChip({ value }) {
  if (value === null || value === undefined) return <Typography color="text.disabled">—</Typography>;
  const color = value >= 8 ? 'success' : value >= 5 ? 'warning' : 'error';
  return <Chip size="small" color={color} label={value} />;
}

export default function Stats() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [rows, setRows] = useState([]);
  const [classes, setClasses] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [selectedLessonId, setSelectedLessonId] = useState('ALL');

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/api/attempts/stats');
        setRows(data.rows || []);
        setClasses(data.classes || []);
        setLessons(data.lessons || []);
      } catch (err) {
        console.error(err);
        setError('Không thể tải thống kê.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filteredRows = useMemo(
    () => rows.filter((row) => selectedClass === 'ALL' || row.classId === selectedClass),
    [rows, selectedClass]
  );

  const lessonAggregates = useMemo(
    () =>
      lessons.map((lesson) => {
        const stats = filteredRows.map((row) => row.lessonStats.find((item) => item.examId === lesson.id)).filter(Boolean);
        const completed = stats.filter((item) => item.status === 'COMPLETED');
        const inProgress = stats.filter((item) => item.status === 'IN_PROGRESS');
        const avgScore = completed.length > 0
          ? parseFloat((completed.reduce((sum, item) => sum + (item.avgScore || 0), 0) / completed.length).toFixed(2))
          : null;

        return {
          id: lesson.id,
          label: lesson.lessonTitle,
          avgScore,
          completedCount: completed.length,
          inProgressCount: inProgress.length,
        };
      }),
    [filteredRows, lessons]
  );

  const classChartData = useMemo(
    () =>
      classes.map((studentClass) => {
        const classRows = rows.filter(
          (row) =>
            row.className === studentClass.name &&
            row.academicYearName === studentClass.academicYearName
        );
        const values = classRows.flatMap((row) =>
          row.lessonStats.map((item) => item.avgScore).filter((value) => value !== null && value !== undefined)
        );
        return {
          name: `${studentClass.name} (${studentClass.academicYearName})`,
          avgScore: values.length > 0
            ? parseFloat((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
            : 0,
        };
      }),
    [classes, rows]
  );

  const nodeChartColors = ['#8c5c22', '#b68134', '#d8a657', '#e3bc7a'];

  return (
    <>
      <Navbar />
      <Container maxWidth="xl" sx={{ mt: 4, mb: 6 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate('/teacher')}>
            Quay lại
          </Button>
          <Typography variant="h4" fontWeight={800} sx={{ color: '#5d3c15' }}>
            Thống kê học tập
          </Typography>
        </Box>

        <Tabs value={tab} onChange={(_, next) => setTab(next)} sx={{ mb: 3 }}>
          <Tab icon={<PeopleIcon />} iconPosition="start" label="Theo học sinh" />
          <Tab icon={<BubbleChartIcon />} iconPosition="start" label="Theo bài học" />
          <Tab icon={<BarChartIcon />} iconPosition="start" label="So sánh lớp" />
        </Tabs>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {loading ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Paper sx={{ p: 2, borderRadius: 4, mb: 3 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Lọc theo lớp</InputLabel>
                    <Select value={selectedClass} label="Lọc theo lớp" onChange={(e) => setSelectedClass(e.target.value)}>
                      <MenuItem value="ALL">Tất cả lớp</MenuItem>
                      {classes.map((studentClass) => (
                        <MenuItem key={studentClass.id} value={studentClass.id}>
                          {studentClass.name} - {studentClass.academicYearName}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Chọn bài học</InputLabel>
                    <Select value={selectedLessonId} label="Chọn bài học" onChange={(e) => setSelectedLessonId(e.target.value)}>
                      <MenuItem value="ALL">Tất cả bài học</MenuItem>
                      {lessons.map((lesson) => (
                        <MenuItem key={lesson.id} value={lesson.id}>
                          {lesson.lessonTitle}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Paper>

            {tab === 0 && (
              <TableContainer component={Paper} sx={{ borderRadius: 4 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Học sinh</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Lớp</TableCell>
                      {lessons
                        .filter((lesson) => selectedLessonId === 'ALL' || lesson.id === selectedLessonId)
                        .map((lesson) => (
                          <TableCell key={lesson.id} align="center" sx={{ fontWeight: 700, minWidth: 160 }}>
                            {lesson.lessonTitle}
                          </TableCell>
                        ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredRows.map((row) => (
                      <TableRow key={row.studentId} hover>
                        <TableCell>{row.fullName}</TableCell>
                        <TableCell>{row.className} ({row.academicYearName})</TableCell>
                        {row.lessonStats
                          .filter((lessonStat) => selectedLessonId === 'ALL' || lessonStat.examId === selectedLessonId)
                          .map((lessonStat) => (
                            <TableCell key={lessonStat.examId} align="center">
                              <Chip
                                size="small"
                                label={STATUS_LABEL[lessonStat.status]}
                                color={lessonStat.status === 'COMPLETED' ? 'success' : lessonStat.status === 'IN_PROGRESS' ? 'warning' : 'default'}
                                sx={{ mb: 0.5 }}
                              />
                              <Box>
                                <AverageChip value={lessonStat.avgScore} />
                              </Box>
                            </TableCell>
                          ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {tab === 1 && (
              <Grid container spacing={3}>
                <Grid item xs={12} lg={7}>
                  <Paper sx={{ p: 3, borderRadius: 4, height: '100%' }}>
                    <Typography variant="h6" fontWeight={800} sx={{ mb: 2, color: '#5d3c15' }}>
                      Điểm trung bình theo bài học
                    </Typography>
                    <ResponsiveContainer width="100%" height={340}>
                      <BarChart data={lessonAggregates.filter((lesson) => selectedLessonId === 'ALL' || lesson.id === selectedLessonId)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" interval={0} angle={-18} textAnchor="end" height={80} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="avgScore" radius={[6, 6, 0, 0]}>
                          {lessonAggregates.map((_, index) => (
                            <Cell key={index} fill={nodeChartColors[index % nodeChartColors.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Paper>
                </Grid>
                <Grid item xs={12} lg={5}>
                  <Paper sx={{ p: 3, borderRadius: 4 }}>
                    <Typography variant="h6" fontWeight={800} sx={{ mb: 2, color: '#5d3c15' }}>
                      Tóm tắt bài học
                    </Typography>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Bài học</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Hoàn thành</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Đang làm</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Điểm TB</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {lessonAggregates
                          .filter((lesson) => selectedLessonId === 'ALL' || lesson.id === selectedLessonId)
                          .map((lesson) => (
                            <TableRow key={lesson.id}>
                              <TableCell>{lesson.label}</TableCell>
                              <TableCell>{lesson.completedCount}</TableCell>
                              <TableCell>{lesson.inProgressCount}</TableCell>
                              <TableCell><AverageChip value={lesson.avgScore} /></TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </Paper>
                </Grid>
              </Grid>
            )}

            {tab === 2 && (
              <Paper sx={{ p: 3, borderRadius: 4 }}>
                <Typography variant="h6" fontWeight={800} sx={{ mb: 2, color: '#5d3c15' }}>
                  So sánh điểm trung bình giữa các lớp
                </Typography>
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart data={classChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="avgScore" fill="#8c5c22" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            )}
          </>
        )}
      </Container>
    </>
  );
}
