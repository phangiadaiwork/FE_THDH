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
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BarChartIcon from '@mui/icons-material/BarChart';
import PeopleIcon from '@mui/icons-material/People';
import WarningIcon from '@mui/icons-material/Warning';
import AssignmentLateIcon from '@mui/icons-material/AssignmentLate';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, LabelList } from 'recharts';
import Navbar from '../components/Navbar';
import api from '../api';

export default function Stats() {
  const navigate = useNavigate();

  // Filter Data
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [filterData, setFilterData] = useState({ classes: [], lessons: [] });
  const [error, setError] = useState('');

  // Selected Filters (Step 1)
  const [selectedSchool, setSelectedSchool] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');

  // Dashboard State (Step 2)
  const [statsLoading, setStatsLoading] = useState(false);
  const [dashboardVisible, setDashboardVisible] = useState(false);
  const [rows, setRows] = useState([]);
  const [lessons, setLessons] = useState([]);
  
  // Tabs & Tab Filters
  const [tab, setTab] = useState(0);
  const [tabClassFilter, setTabClassFilter] = useState('ALL');
  const [tabLessonFilter, setTabLessonFilter] = useState('');

  // Node Stats State
  const [nodeStatsLoading, setNodeStatsLoading] = useState(false);
  const [nodeStats, setNodeStats] = useState([]);
  const [studentMistakes, setStudentMistakes] = useState([]);

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const { data } = await api.get('/api/attempts/filters');
        setFilterData(data);
        if (data.lessons && data.lessons.length > 0) {
          setTabLessonFilter(data.lessons[0].id);
        }
      } catch (err) {
        console.error(err);
        setError('Không thể tải bộ lọc.');
      } finally {
        setFiltersLoading(false);
      }
    };
    loadFilters();
  }, []);

  // Compute available filter options dynamically
  const availableSchools = useMemo(() => [...new Set(filterData.classes.map(c => c.school))], [filterData.classes]);
  const availableYears = useMemo(() => 
    [...new Set(filterData.classes.filter(c => c.school === selectedSchool).map(c => c.academicYearName))], 
  [filterData.classes, selectedSchool]);
  const availableGrades = useMemo(() => 
    [...new Set(filterData.classes.filter(c => c.school === selectedSchool && c.academicYearName === selectedYear).map(c => c.gradeLevel))], 
  [filterData.classes, selectedSchool, selectedYear]);
  const availableClassesInGrade = useMemo(() => 
    filterData.classes.filter(c => c.school === selectedSchool && c.academicYearName === selectedYear && c.gradeLevel === selectedGrade),
  [filterData.classes, selectedSchool, selectedYear, selectedGrade]);

  const handleFetchStats = async () => {
    if (!selectedSchool || !selectedYear || !selectedGrade) return;
    setStatsLoading(true);
    setError('');
    try {
      const { data } = await api.get('/api/attempts/stats', {
        params: { school: selectedSchool, academicYearName: selectedYear, gradeLevel: selectedGrade }
      });
      setRows(data.rows || []);
      setLessons(data.lessons || []);
      setDashboardVisible(true);
      setTabClassFilter('ALL');
    } catch (err) {
      console.error(err);
      setError('Không thể tải dữ liệu thống kê.');
    } finally {
      setStatsLoading(false);
    }
  };

  // Node stats fetcher
  useEffect(() => {
    if ((tab === 1 || tab === 2) && tabLessonFilter && tabLessonFilter !== 'ALL') {
      const fetchNodeStats = async () => {
        setNodeStatsLoading(true);
        try {
          const params = { examId: tabLessonFilter };
          if (tabClassFilter !== 'ALL') params.classId = tabClassFilter;
          const { data } = await api.get('/api/attempts/node-stats', { params });
          setNodeStats(data.nodeStats || []);
          setStudentMistakes(data.studentMistakes || []);
        } catch (err) {
          console.error(err);
        } finally {
          setNodeStatsLoading(false);
        }
      };
      fetchNodeStats();
    }
  }, [tab, tabLessonFilter, tabClassFilter]);

  // Tab 1: Class Comparison Data
  const classComparisonData = useMemo(() => {
    if (!dashboardVisible) return [];
    return availableClassesInGrade.map(cls => {
      const classRows = rows.filter(r => r.classId === cls.id);
      if (classRows.length === 0) return { className: cls.name, avgScore: 0 };
      
      let totalScore = 0;
      let attemptCount = 0;
      classRows.forEach(student => {
        student.lessonStats.forEach(ls => {
          if (ls.status === 'COMPLETED' && (!tabLessonFilter || tabLessonFilter === 'ALL' || ls.examId === tabLessonFilter)) {
            totalScore += ls.avgScore;
            attemptCount++;
          }
        });
      });
      return {
        className: cls.name,
        avgScore: attemptCount > 0 ? parseFloat((totalScore / attemptCount).toFixed(2)) : 0
      };
    });
  }, [dashboardVisible, availableClassesInGrade, rows, tabLessonFilter]);

  // Tab 1: Score Distribution Data
  const scoreDistribution = useMemo(() => {
    const bins = { '0-4': 0, '5-6': 0, '7-8': 0, '9-10': 0 };
    studentMistakes.forEach(s => {
      if (s.score < 5) bins['0-4']++;
      else if (s.score < 7) bins['5-6']++;
      else if (s.score < 9) bins['7-8']++;
      else bins['9-10']++;
    });
    return [
      { name: 'Yếu (0-4)', count: bins['0-4'], fill: '#d32f2f' },
      { name: 'Trung bình (5-6)', count: bins['5-6'], fill: '#ed6c02' },
      { name: 'Khá (7-8)', count: bins['7-8'], fill: '#2e7d32' },
      { name: 'Giỏi (9-10)', count: bins['9-10'], fill: '#0288d1' },
    ];
  }, [studentMistakes]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f7f1e8', pb: 8 }}>
      <Navbar />

      <Container maxWidth="xl" sx={{ mt: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
          <IconButton onClick={() => navigate('/teacher')} sx={{ bgcolor: 'white', boxShadow: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" fontWeight={800} color="#5d3c15">
            Thống kê Giáo dục
          </Typography>
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        {/* STEP 1: FILTER PANEL */}
        <Paper sx={{ p: 3, mb: 4, borderRadius: 4, border: '1px solid #eadcc5', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2, color: '#8c5c22' }}>
            Bước 1: Chọn bộ lọc dữ liệu (Bắt buộc)
          </Typography>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Trường</InputLabel>
                <Select
                  value={selectedSchool}
                  label="Trường"
                  onChange={(e) => {
                    setSelectedSchool(e.target.value);
                    setSelectedYear('');
                    setSelectedGrade('');
                    setDashboardVisible(false);
                  }}
                  disabled={filtersLoading}
                >
                  {availableSchools.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small" disabled={!selectedSchool}>
                <InputLabel>Năm học</InputLabel>
                <Select
                  value={selectedYear}
                  label="Năm học"
                  onChange={(e) => {
                    setSelectedYear(e.target.value);
                    setSelectedGrade('');
                    setDashboardVisible(false);
                  }}
                >
                  {availableYears.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small" disabled={!selectedYear}>
                <InputLabel>Khối</InputLabel>
                <Select
                  value={selectedGrade}
                  label="Khối"
                  onChange={(e) => {
                    setSelectedGrade(e.target.value);
                    setDashboardVisible(false);
                  }}
                >
                  {availableGrades.map(g => <MenuItem key={g} value={g}>{`Khối ${g}`}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button 
                variant="contained" 
                fullWidth 
                size="large"
                disabled={!selectedSchool || !selectedYear || !selectedGrade || statsLoading}
                onClick={handleFetchStats}
                sx={{ bgcolor: '#d4a256', '&:hover': { bgcolor: '#b88a44' }, height: '40px' }}
              >
                {statsLoading ? <CircularProgress size={24} color="inherit" /> : 'Xem thống kê'}
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* STEP 2: DASHBOARD */}
        {dashboardVisible && (
          <Paper sx={{ borderRadius: 4, overflow: 'hidden', border: '1px solid #eadcc5', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'white' }}>
              <Tabs value={tab} onChange={(e, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ '& .MuiTab-root': { py: 2.5, fontWeight: 600 } }}>
                <Tab icon={<BarChartIcon />} iconPosition="start" label="Tổng quan Khối & So sánh Lớp" />
                <Tab icon={<PeopleIcon />} iconPosition="start" label="Chi tiết Học sinh & Lỗi sai" />
                <Tab icon={<WarningIcon />} iconPosition="start" label="Phân tích Điểm mù kiến thức" />
              </Tabs>
            </Box>

            <Box sx={{ p: 3, bgcolor: 'white' }}>
              {/* TAB 1: OVERVIEW */}
              {tab === 0 && (
                <Box>
                  <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 3 }}>
                    <Typography variant="h6" fontWeight={700}>So sánh điểm trung bình giữa các lớp</Typography>
                    <FormControl size="small" sx={{ minWidth: 250 }}>
                      <InputLabel>Bài học (Tất cả)</InputLabel>
                      <Select value={tabLessonFilter} label="Bài học (Tất cả)" onChange={(e) => setTabLessonFilter(e.target.value)}>
                        <MenuItem value="ALL">-- Tất cả bài học --</MenuItem>
                        {lessons.map(l => <MenuItem key={l.id} value={l.id}>{l.lessonTitle}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Stack>
                  <Box sx={{ height: 400 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={classComparisonData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="className" />
                        <YAxis domain={[0, 10]} />
                        <Tooltip formatter={(value) => [`${value} điểm`, 'Điểm trung bình']} />
                        <Bar dataKey="avgScore" fill="#d4a256" radius={[4, 4, 0, 0]} maxBarSize={60}>
                          <LabelList dataKey="avgScore" position="top" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Box>
              )}

              {/* TAB 2: STUDENT DETAILS & MISTAKES */}
              {tab === 1 && (
                <Box>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} sx={{ mb: 3 }}>
                    <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>Chi tiết Học sinh & Câu trả lời sai</Typography>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                      <InputLabel>Bài học</InputLabel>
                      <Select value={tabLessonFilter} label="Bài học" onChange={(e) => setTabLessonFilter(e.target.value)}>
                        <MenuItem value="ALL" disabled>-- Chọn bài học --</MenuItem>
                        {lessons.map(l => <MenuItem key={l.id} value={l.id}>{l.lessonTitle}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                      <InputLabel>Lọc theo Lớp</InputLabel>
                      <Select value={tabClassFilter} label="Lọc theo Lớp" onChange={(e) => setTabClassFilter(e.target.value)}>
                        <MenuItem value="ALL">-- Toàn khối --</MenuItem>
                        {availableClassesInGrade.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Stack>

                  {tabLessonFilter === 'ALL' || !tabLessonFilter ? (
                    <Alert severity="info" sx={{ mb: 3 }}>Vui lòng chọn một Bài học cụ thể để xem phân tích chi tiết.</Alert>
                  ) : nodeStatsLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
                  ) : (
                    <>
                      <Grid container spacing={3} sx={{ mb: 4 }}>
                        <Grid item xs={12} md={6} lg={4}>
                          <Paper variant="outlined" sx={{ p: 2, height: '100%', borderRadius: 3 }}>
                            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2, textAlign: 'center' }}>
                              Phân bố điểm số
                            </Typography>
                            <Box sx={{ height: 250 }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={scoreDistribution} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                  <YAxis />
                                  <Tooltip />
                                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                    {scoreDistribution.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                    <LabelList dataKey="count" position="top" />
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </Box>
                          </Paper>
                        </Grid>
                      </Grid>

                      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                        <Table>
                          <TableHead sx={{ bgcolor: '#f7f1e8' }}>
                            <TableRow>
                              <TableCell width="20%"><b>Học sinh</b></TableCell>
                              <TableCell width="15%"><b>Lớp</b></TableCell>
                              <TableCell width="10%" align="center"><b>Điểm</b></TableCell>
                              <TableCell width="55%"><b>Các câu làm sai (Cần ôn tập)</b></TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {studentMistakes.length === 0 ? (
                              <TableRow><TableCell colSpan={4} align="center" sx={{ py: 3 }}>Chưa có học sinh nào làm bài này.</TableCell></TableRow>
                            ) : (
                              studentMistakes.map((s) => (
                                <TableRow key={s.studentId}>
                                  <TableCell>{s.fullName}</TableCell>
                                  <TableCell>{s.className}</TableCell>
                                  <TableCell align="center">
                                    <Chip label={s.score} color={s.score >= 8 ? 'success' : s.score >= 5 ? 'warning' : 'error'} size="small" sx={{ fontWeight: 700 }} />
                                  </TableCell>
                                  <TableCell>
                                    <Stack direction="row" flexWrap="wrap" gap={1}>
                                      {s.wrongAnswers.map(wa => (
                                        <Tooltip key={wa.nodeId} title={wa.question || 'Không có nội dung câu hỏi'}>
                                          <Chip label={wa.label} size="small" variant="outlined" color="error" />
                                        </Tooltip>
                                      ))}
                                      {s.wrongAnswers.length === 0 && (
                                        <Typography variant="body2" color="success.main" fontWeight={600}>Hoàn hảo! Không sai câu nào.</Typography>
                                      )}
                                    </Stack>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </>
                  )}
                </Box>
              )}

              {/* TAB 3: NODE STATS */}
              {tab === 2 && (
                <Box>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} sx={{ mb: 3 }}>
                    <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>Câu hỏi có tỉ lệ sai cao nhất</Typography>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                      <InputLabel>Bài học</InputLabel>
                      <Select value={tabLessonFilter} label="Bài học" onChange={(e) => setTabLessonFilter(e.target.value)}>
                        {lessons.map(l => <MenuItem key={l.id} value={l.id}>{l.lessonTitle}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                      <InputLabel>Lớp</InputLabel>
                      <Select value={tabClassFilter} label="Lớp" onChange={(e) => setTabClassFilter(e.target.value)}>
                        <MenuItem value="ALL">-- Toàn khối --</MenuItem>
                        {availableClassesInGrade.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Stack>

                  {nodeStatsLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
                  ) : (
                    <Grid container spacing={3}>
                      {nodeStats.filter(n => n.errorRate !== null).sort((a, b) => b.errorRate - a.errorRate).slice(0, 6).map((node, index) => (
                        <Grid item xs={12} md={6} lg={4} key={node.nodeId}>
                          <Card variant="outlined" sx={{ borderColor: node.errorRate > 50 ? 'error.light' : 'divider', bgcolor: node.errorRate > 50 ? '#fffafa' : '#fff' }}>
                            <CardContent>
                              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                                <Chip label={`#${index + 1}`} size="small" color={node.errorRate > 50 ? 'error' : 'default'} />
                                <Typography variant="h4" color={node.errorRate > 50 ? 'error.main' : 'text.secondary'} fontWeight={800}>
                                  {node.errorRate}% sai
                                </Typography>
                              </Stack>
                              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>{node.label}</Typography>
                              <Typography variant="body2" fontWeight={500} sx={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {node.question}
                              </Typography>
                              <Box sx={{ mt: 2, p: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
                                <Typography variant="caption" display="block" color="text.secondary">
                                  Đã làm: {node.total} | Sai: {node.incorrect} | Đúng: {node.correct}
                                </Typography>
                              </Box>
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                      {nodeStats.length === 0 && (
                        <Grid item xs={12}>
                          <Alert severity="info">Chưa có dữ liệu làm bài cho bài học này.</Alert>
                        </Grid>
                      )}
                    </Grid>
                  )}
                </Box>
              )}
            </Box>
          </Paper>
        )}
      </Container>
    </Box>
  );
}
