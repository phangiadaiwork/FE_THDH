import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Chip,
  TableContainer,
  Alert,
  Button,
  Tooltip,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  LinearProgress,
} from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BubbleChartIcon from '@mui/icons-material/BubbleChart';
import PeopleIcon from '@mui/icons-material/People';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import Navbar from '../components/Navbar';
import api from '../api';

function ScoreChip({ avg }) {
  if (avg === null) return <Typography variant="caption" color="text.disabled">—</Typography>;
  const color = avg >= 8 ? 'success' : avg >= 5 ? 'warning' : 'error';
  return <Chip label={avg.toFixed ? avg.toFixed(2) : avg} color={color} size="small" />;
}

function ErrorRateBar({ rate }) {
  if (rate === null) return <Typography variant="caption" color="text.disabled">—</Typography>;
  const color = rate >= 60 ? '#d32f2f' : rate >= 30 ? '#f57c00' : '#388e3c';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 100 }}>
      <Box sx={{ flex: 1 }}>
        <LinearProgress
          variant="determinate"
          value={Math.min(rate, 100)}
          sx={{ height: 8, borderRadius: 4, bgcolor: '#e0e0e0', '& .MuiLinearProgress-bar': { bgcolor: color } }}
        />
      </Box>
      <Typography variant="caption" sx={{ color, fontWeight: 'bold', minWidth: 36 }}>
        {rate}%
      </Typography>
    </Box>
  );
}

export default function Stats() {
  const [tab, setTab] = useState(0);

  // Tab 1: Thống kê học sinh
  const [allStats, setAllStats] = useState([]);
  const [classes, setClasses] = useState([]);
  const [exams, setExams] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(true);

  // Tab 2: Thống kê node
  const [selectedExam, setSelectedExam] = useState('');
  const [nodeStatsClass, setNodeStatsClass] = useState('');
  const [nodeStats, setNodeStats] = useState(null);
  const [loadingNodes, setLoadingNodes] = useState(false);

  const [error, setError] = useState('');
  const navigate = useNavigate();

  const fetchStudentStats = async (className = '') => {
    setLoadingStudents(true);
    setError('');
    try {
      const { data } = await api.get(
        `/api/attempts/stats${className ? `?className=${encodeURIComponent(className)}` : ''}`
      );
      setAllStats(data.stats || []);
      setClasses(data.classes || []);
      setExams(data.exams || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể tải thống kê');
    } finally {
      setLoadingStudents(false);
    }
  };

  const fetchNodeStats = async (examId, className = '') => {
    if (!examId) return;
    setLoadingNodes(true);
    setError('');
    try {
      const params = new URLSearchParams({ examId });
      if (className) params.append('className', className);
      const { data } = await api.get(`/api/attempts/node-stats?${params}`);
      setNodeStats(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể tải thống kê node');
    } finally {
      setLoadingNodes(false);
    }
  };

  useEffect(() => { fetchStudentStats(); }, []);

  const handleClassChange = (cls) => {
    setSelectedClass(cls);
    fetchStudentStats(cls);
  };

  useEffect(() => {
    if (selectedExam) fetchNodeStats(selectedExam, nodeStatsClass);
  }, [selectedExam, nodeStatsClass]);

  const displayStats = selectedClass ? allStats.filter((s) => s.className === selectedClass) : allStats;

  // ── Dữ liệu biểu đồ so sánh lớp ─────────────────────────────────────────
  const classChartData = classes.map((cls) => {
    const clsStudents = allStats.filter((s) => s.className === cls);
    const examData = {};
    exams.forEach((exam) => {
      const scores = clsStudents
        .map((s) => s.examStats.find((es) => es.examId === exam.id)?.avgScore)
        .filter((v) => v !== null && v !== undefined);
      examData[`exam_${exam.id}`] = scores.length > 0
        ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))
        : null;
    });
    return { name: cls, ...examData };
  });

  const COLORS = ['#1565c0', '#6a1b9a', '#2e7d32', '#e65100', '#00838f', '#ad1457'];

  return (
    <>
      <Navbar />
      <Container maxWidth="xl" sx={{ mt: 4, mb: 6 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/teacher')} variant="outlined" size="small">
            Quay lại
          </Button>
          <BarChartIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h4" fontWeight="bold">Thống kê kết quả học tập</Typography>
        </Box>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
          <Tab icon={<PeopleIcon />} iconPosition="start" label="Điểm học sinh" />
          <Tab icon={<BubbleChartIcon />} iconPosition="start" label="Phân tích câu hỏi" />
          <Tab icon={<BarChartIcon />} iconPosition="start" label="So sánh lớp" />
        </Tabs>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* ── TAB 0: Thống kê điểm học sinh ──────────────────────────────── */}
        {tab === 0 && (
          <>
            <Paper elevation={2} sx={{ p: 2.5, mb: 3, borderRadius: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
              <FormControl sx={{ minWidth: 220 }} size="small">
                <InputLabel>Lọc theo lớp</InputLabel>
                <Select value={selectedClass} onChange={(e) => handleClassChange(e.target.value)} label="Lọc theo lớp">
                  <MenuItem value=""><em>Tất cả lớp</em></MenuItem>
                  {classes.map((cls) => <MenuItem key={cls} value={cls}>{cls}</MenuItem>)}
                </Select>
              </FormControl>
              <Typography variant="body2" color="text.secondary">
                {displayStats.length} học sinh • {exams.length} bài tập
              </Typography>
            </Paper>

            {loadingStudents ? (
              <Box sx={{ textAlign: 'center', mt: 8 }}><CircularProgress /></Box>
            ) : (
              <TableContainer component={Paper} elevation={3} sx={{ borderRadius: 2 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: '#1565c0', color: 'white', minWidth: 160 }}>Họ và tên</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: '#1565c0', color: 'white', minWidth: 80 }}>Lớp</TableCell>
                      {exams.map((exam) => (
                        <TableCell key={exam.id} align="center" sx={{ fontWeight: 'bold', bgcolor: '#1565c0', color: 'white', minWidth: 150 }}>
                          <Tooltip title={exam.title} arrow>
                            <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                              {exam.title}
                            </span>
                          </Tooltip>
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {displayStats.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2 + exams.length} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">Không có dữ liệu</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayStats.map((student) => (
                        <TableRow key={student.studentId} hover>
                          <TableCell sx={{ fontWeight: 500 }}>{student.fullName}</TableCell>
                          <TableCell><Chip label={student.className || '—'} size="small" variant="outlined" /></TableCell>
                          {student.examStats.map((es) => (
                            <TableCell key={es.examId} align="center">
                              {es.attemptCount > 0 ? (
                                <Box>
                                  <ScoreChip avg={es.avgScore} />
                                  <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.3 }}>
                                    {es.attemptCount} lần
                                  </Typography>
                                </Box>
                              ) : (
                                <Typography variant="caption" color="text.disabled">Chưa làm</Typography>
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {!loadingStudents && displayStats.length > 0 && (
              <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">Điểm trung bình:</Typography>
                <Chip label="≥ 8" color="success" size="small" />
                <Chip label="5–8" color="warning" size="small" />
                <Chip label="< 5" color="error" size="small" />
              </Box>
            )}
          </>
        )}

        {/* ── TAB 1: Phân tích câu hỏi ──────────────────────────────────── */}
        {tab === 1 && (
          <>
            <Paper elevation={2} sx={{ p: 2.5, mb: 3, borderRadius: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <FormControl sx={{ minWidth: 260 }} size="small">
                <InputLabel>Chọn bài tập</InputLabel>
                <Select value={selectedExam} onChange={(e) => setSelectedExam(e.target.value)} label="Chọn bài tập">
                  <MenuItem value=""><em>-- Chọn bài tập --</em></MenuItem>
                  {exams.map((exam) => <MenuItem key={exam.id} value={exam.id}>{exam.title}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl sx={{ minWidth: 180 }} size="small">
                <InputLabel>Lọc theo lớp</InputLabel>
                <Select value={nodeStatsClass} onChange={(e) => setNodeStatsClass(e.target.value)} label="Lọc theo lớp">
                  <MenuItem value=""><em>Tất cả lớp</em></MenuItem>
                  {classes.map((cls) => <MenuItem key={cls} value={cls}>{cls}</MenuItem>)}
                </Select>
              </FormControl>
            </Paper>

            {!selectedExam ? (
              <Box sx={{ textAlign: 'center', mt: 6 }}>
                <BubbleChartIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
                <Typography color="text.secondary" sx={{ mt: 1 }}>Chọn bài tập để xem phân tích câu hỏi</Typography>
              </Box>
            ) : loadingNodes ? (
              <Box sx={{ textAlign: 'center', mt: 6 }}><CircularProgress /></Box>
            ) : nodeStats ? (
              <>
                {/* Biểu đồ tỉ lệ sai theo node */}
                {nodeStats.nodeStats.filter((n) => n.total > 0).length > 0 && (
                  <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                      Tỉ lệ trả lời sai theo câu hỏi (%)
                    </Typography>
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart
                        data={nodeStats.nodeStats.filter((n) => n.total > 0).map((n) => ({
                          name: n.label.length > 12 ? n.label.slice(0, 12) + '…' : n.label,
                          fullName: n.label,
                          'Tỉ lệ sai': n.errorRate,
                          total: n.total,
                        }))}
                        margin={{ top: 5, right: 20, left: 0, bottom: 60 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                        <ReTooltip
                          formatter={(value, name, props) => [`${value}%`, 'Tỉ lệ sai']}
                          labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                        />
                        <Bar dataKey="Tỉ lệ sai" radius={[4, 4, 0, 0]}>
                          {nodeStats.nodeStats.filter((n) => n.total > 0).map((n, i) => (
                            <Cell key={i} fill={n.errorRate >= 60 ? '#d32f2f' : n.errorRate >= 30 ? '#f57c00' : '#388e3c'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <Box sx={{ mt: 1, display: 'flex', gap: 2 }}>
                      <Chip label="≥ 60% sai" size="small" sx={{ bgcolor: '#d32f2f', color: 'white' }} />
                      <Chip label="30–60% sai" size="small" sx={{ bgcolor: '#f57c00', color: 'white' }} />
                      <Chip label="< 30% sai" size="small" sx={{ bgcolor: '#388e3c', color: 'white' }} />
                    </Box>
                  </Paper>
                )}

                {/* Bảng chi tiết */}
                <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {['Câu hỏi (node)', 'Tổng lượt', 'Đúng', 'Sai', 'Tỉ lệ sai'].map((h) => (
                          <TableCell key={h} sx={{ fontWeight: 'bold', bgcolor: '#1565c0', color: 'white' }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {nodeStats.nodeStats.map((n) => (
                        <TableRow key={n.nodeId} hover>
                          <TableCell sx={{ fontWeight: 500 }}>{n.label}</TableCell>
                          <TableCell>{n.total || '—'}</TableCell>
                          <TableCell>
                            {n.total > 0 ? <Chip label={n.correct} color="success" size="small" /> : '—'}
                          </TableCell>
                          <TableCell>
                            {n.total > 0 ? <Chip label={n.incorrect} color="error" size="small" /> : '—'}
                          </TableCell>
                          <TableCell sx={{ minWidth: 160 }}>
                            <ErrorRateBar rate={n.errorRate} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            ) : null}
          </>
        )}

        {/* ── TAB 2: So sánh lớp ──────────────────────────────────────────── */}
        {tab === 2 && (
          <>
            {loadingStudents ? (
              <Box sx={{ textAlign: 'center', mt: 6 }}><CircularProgress /></Box>
            ) : classChartData.length === 0 ? (
              <Box sx={{ textAlign: 'center', mt: 6 }}>
                <Typography color="text.secondary">Không có dữ liệu lớp</Typography>
              </Box>
            ) : (
              <>
                {/* Biểu đồ so sánh lớp theo từng bài */}
                {exams.slice(0, 4).map((exam) => {
                  const chartData = classChartData
                    .filter((d) => d[`exam_${exam.id}`] !== null)
                    .map((d) => ({ name: d.name, 'Điểm TB': d[`exam_${exam.id}`] }));

                  if (chartData.length === 0) return null;
                  return (
                    <Paper key={exam.id} elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
                      <Typography variant="h6" fontWeight="bold" gutterBottom>
                        {exam.title} — So sánh điểm trung bình theo lớp
                      </Typography>
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <ReTooltip />
                          <Bar dataKey="Điểm TB" radius={[4, 4, 0, 0]}>
                            {chartData.map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </Paper>
                  );
                })}

                {/* Bảng so sánh tổng hợp */}
                <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
                  <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
                    <Typography variant="subtitle1" fontWeight="bold">Bảng điểm trung bình theo lớp và bài tập</Typography>
                  </Box>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold', bgcolor: '#1565c0', color: 'white' }}>Lớp</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', bgcolor: '#1565c0', color: 'white' }}>Học sinh</TableCell>
                          {exams.map((exam) => (
                            <TableCell key={exam.id} align="center" sx={{ fontWeight: 'bold', bgcolor: '#1565c0', color: 'white', minWidth: 140 }}>
                              <Tooltip title={exam.title}><span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120, display: 'block' }}>{exam.title}</span></Tooltip>
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {classes.map((cls) => {
                          const clsStudents = allStats.filter((s) => s.className === cls);
                          return (
                            <TableRow key={cls} hover>
                              <TableCell><Chip label={cls} size="small" color="primary" /></TableCell>
                              <TableCell>{clsStudents.length}</TableCell>
                              {exams.map((exam) => {
                                const scores = clsStudents
                                  .map((s) => s.examStats.find((es) => es.examId === exam.id)?.avgScore)
                                  .filter((v) => v !== null && v !== undefined);
                                const avg = scores.length > 0
                                  ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))
                                  : null;
                                return (
                                  <TableCell key={exam.id} align="center">
                                    <ScoreChip avg={avg} />
                                    {scores.length > 0 && (
                                      <Typography variant="caption" display="block" color="text.secondary">
                                        {scores.length} hs
                                      </Typography>
                                    )}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </>
            )}
          </>
        )}
      </Container>
    </>
  );
}
