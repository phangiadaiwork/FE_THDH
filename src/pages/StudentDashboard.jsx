import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Box,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import SchoolIcon from '@mui/icons-material/School';
import ContinueIcon from '@mui/icons-material/PlayCircle';
import Navbar from '../components/Navbar';
import api from '../api';

function StudentDashboard() {
  const [exams, setExams] = useState([]);
  const [myAttempts, setMyAttempts] = useState({});
  const [inProgressIds, setInProgressIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const user = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  })();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [examsRes, attemptsRes] = await Promise.all([
          api.get('/api/exams'),
          api.get('/api/attempts/my'),
        ]);
        setExams(examsRes.data);

        const avgMap = {};
        attemptsRes.data.avgByExam && Object.entries(attemptsRes.data.avgByExam).forEach(([eid, avg]) => {
          avgMap[parseInt(eid)] = avg;
        });
        const countMap = {};
        if (attemptsRes.data.attempts) {
          attemptsRes.data.attempts.forEach((a) => {
            countMap[a.examId] = (countMap[a.examId] || 0) + 1;
          });
        }
        setMyAttempts({ avg: avgMap, count: countMap });

        if (attemptsRes.data.inProgressExamIds) {
          setInProgressIds(new Set(attemptsRes.data.inProgressExamIds));
        }
      } catch (err) {
        setError('Không thể tải dữ liệu. Vui lòng thử lại.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <>
      <Navbar />
      <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
        {/* Header */}
        <Box
          sx={{
            background: 'linear-gradient(135deg, #1565c0 0%, #6a1b9a 100%)',
            borderRadius: 3,
            p: 3,
            mb: 4,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <SchoolIcon sx={{ fontSize: 48 }} />
          <Box>
            <Typography variant="h5" fontWeight="bold">
              Xin chào, {user.fullName}!
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.85 }}>
              Lớp: {user.className} {user.school && `• ${user.school}`}
            </Typography>
          </Box>
        </Box>

        <Typography variant="h5" fontWeight="bold" gutterBottom>
          Danh sách bài tập ({exams.length})
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {loading ? (
          <Box sx={{ textAlign: 'center', mt: 8 }}>
            <CircularProgress />
            <Typography sx={{ mt: 2 }} color="text.secondary">Đang tải bài tập...</Typography>
          </Box>
        ) : exams.length === 0 ? (
          <Box sx={{ textAlign: 'center', mt: 6 }}>
            <AccountTreeIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Chưa có bài tập nào. Hãy chờ giáo viên tạo bài tập!
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {exams.map((exam) => {
              const attemptCount = myAttempts.count?.[exam.id] || 0;
              const avgScore = myAttempts.avg?.[exam.id];
              const isInProgress = inProgressIds.has(exam.id);

              return (
                <Grid item xs={12} sm={6} md={4} key={exam.id}>
                  <Card
                    elevation={3}
                    sx={{
                      borderRadius: 2,
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 },
                      position: 'relative',
                      overflow: 'visible',
                    }}
                  >
                    {isInProgress && (
                      <Chip
                        label="Đang làm dở"
                        color="warning"
                        size="small"
                        sx={{
                          position: 'absolute',
                          top: -10,
                          right: 12,
                          fontWeight: 'bold',
                          fontSize: 11,
                        }}
                      />
                    )}
                    <CardContent sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1.5 }}>
                        <AccountTreeIcon color="primary" sx={{ mt: 0.3 }} />
                        <Typography variant="h6" fontWeight="bold" lineHeight={1.3}>
                          {exam.title}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip label="Sơ đồ tư duy" color="primary" size="small" variant="outlined" />
                        {exam._count?.nodes && (
                          <Chip label={`${exam._count.nodes} node`} size="small" />
                        )}
                      </Box>
                      {attemptCount > 0 && (
                        <Box sx={{ mt: 1.5, p: 1, bgcolor: '#e3f2fd', borderRadius: 1 }}>
                          <Typography variant="caption" color="primary.main" fontWeight="bold">
                            Đã làm {attemptCount} lần • Điểm TB: {avgScore}
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                    <CardActions sx={{ p: 2, pt: 0 }}>
                      <Button
                        variant="contained"
                        startIcon={isInProgress ? <ContinueIcon /> : <PlayArrowIcon />}
                        onClick={() => navigate(`/student/exam/${exam.id}`)}
                        fullWidth
                        color={isInProgress ? 'warning' : 'primary'}
                      >
                        {isInProgress ? 'Tiếp tục' : attemptCount > 0 ? 'Làm lại' : 'Bắt đầu'}
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Container>
    </>
  );
}

export default StudentDashboard;
