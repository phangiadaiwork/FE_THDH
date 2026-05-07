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
} from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../api';

function ScoreChip({ avg }) {
  if (avg === null) return <Typography variant="caption" color="text.disabled">—</Typography>;
  const color = avg >= 8 ? 'success' : avg >= 5 ? 'warning' : 'error';
  return <Chip label={avg.toFixed(2)} color={color} size="small" />;
}

export default function Stats() {
  const [allStats, setAllStats] = useState([]);
  const [classes, setClasses] = useState([]);
  const [exams, setExams] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const fetchStats = async (className = '') => {
    setLoading(true);
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
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleClassChange = (cls) => {
    setSelectedClass(cls);
    fetchStats(cls);
  };

  // Nếu server trả về stats đã lọc theo class, dùng trực tiếp.
  // Nếu không, lọc thêm phía client
  const displayStats = selectedClass
    ? allStats.filter((s) => s.className === selectedClass)
    : allStats;

  return (
    <>
      <Navbar />
      <Container maxWidth="xl" sx={{ mt: 4, mb: 6 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/teacher')}
            variant="outlined"
            size="small"
          >
            Quay lại
          </Button>
          <BarChartIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h4" fontWeight="bold">
            Thống kê kết quả học tập
          </Typography>
        </Box>

        {/* Bộ lọc */}
        <Paper elevation={2} sx={{ p: 2.5, mb: 3, borderRadius: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl sx={{ minWidth: 220 }} size="small">
            <InputLabel>Lọc theo lớp</InputLabel>
            <Select
              value={selectedClass}
              onChange={(e) => handleClassChange(e.target.value)}
              label="Lọc theo lớp"
            >
              <MenuItem value="">
                <em>Tất cả lớp</em>
              </MenuItem>
              {classes.map((cls) => (
                <MenuItem key={cls} value={cls}>
                  {cls}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="body2" color="text.secondary">
            {displayStats.length} học sinh •{' '}
            {exams.length} bài tập
          </Typography>
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ textAlign: 'center', mt: 8 }}>
            <CircularProgress />
            <Typography sx={{ mt: 2 }} color="text.secondary">
              Đang tải thống kê...
            </Typography>
          </Box>
        ) : (
          <TableContainer component={Paper} elevation={3} sx={{ borderRadius: 2 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{ fontWeight: 'bold', bgcolor: '#1565c0', color: 'white', minWidth: 160 }}
                  >
                    Họ và tên
                  </TableCell>
                  <TableCell
                    sx={{ fontWeight: 'bold', bgcolor: '#1565c0', color: 'white', minWidth: 80 }}
                  >
                    Lớp
                  </TableCell>
                  {exams.map((exam) => (
                    <TableCell
                      key={exam.id}
                      align="center"
                      sx={{
                        fontWeight: 'bold',
                        bgcolor: '#1565c0',
                        color: 'white',
                        minWidth: 150,
                        maxWidth: 200,
                      }}
                    >
                      <Tooltip title={exam.title} arrow>
                        <span
                          style={{
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: 180,
                          }}
                        >
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
                      <TableCell>
                        <Chip label={student.className || '—'} size="small" variant="outlined" />
                      </TableCell>
                      {student.examStats.map((es) => (
                        <TableCell key={es.examId} align="center">
                          {es.attemptCount > 0 ? (
                            <Box>
                              <ScoreChip avg={es.avgScore} />
                              <Typography
                                variant="caption"
                                display="block"
                                color="text.secondary"
                                sx={{ mt: 0.3 }}
                              >
                                {es.attemptCount} lần
                              </Typography>
                            </Box>
                          ) : (
                            <Typography variant="caption" color="text.disabled">
                              Chưa làm
                            </Typography>
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

        {/* Chú thích màu điểm */}
        {!loading && displayStats.length > 0 && (
          <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">Điểm trung bình:</Typography>
            <Chip label="≥ 8" color="success" size="small" />
            <Chip label="5–8" color="warning" size="small" />
            <Chip label="< 5" color="error" size="small" />
          </Box>
        )}
      </Container>
    </>
  );
}
