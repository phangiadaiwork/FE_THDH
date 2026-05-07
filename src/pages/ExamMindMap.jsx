import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Alert,
  Chip,
  CircularProgress,
  LinearProgress,
  Paper,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  Tooltip,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ReplayIcon from '@mui/icons-material/Replay';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import LockIcon from '@mui/icons-material/Lock';
import Navbar from '../components/Navbar';
import api from '../api';

// ─── Màu theo trạng thái node ──────────────────────────────────────────────
const STATUS_STYLE = {
  locked:    { bg: '#f5f5f5', border: '#bdbdbd', shadow: 'none', opacity: 0.45 },
  pending:   { bg: '#ffffff', border: '#90caf9', shadow: '0 2px 6px rgba(0,0,0,0.1)', opacity: 1 },
  current:   { bg: '#fff8e1', border: '#f9a825', shadow: '0 4px 12px rgba(249,168,37,0.4)', opacity: 1 },
  correct:   { bg: '#e8f5e9', border: '#43a047', shadow: '0 2px 8px rgba(67,160,71,0.3)', opacity: 1 },
  incorrect: { bg: '#fce4ec', border: '#e53935', shadow: '0 2px 8px rgba(229,57,53,0.3)', opacity: 1 },
};

// ─── Custom Node ────────────────────────────────────────────────────────────
function MindMapNode({ data }) {
  const s = STATUS_STYLE[data.status] || STATUS_STYLE.locked;
  return (
    <div
      style={{
        background: s.bg,
        border: `2px solid ${s.border}`,
        boxShadow: s.shadow,
        borderRadius: 10,
        padding: '10px 14px',
        minWidth: 130,
        maxWidth: 190,
        textAlign: 'center',
        transition: 'all 0.3s',
        cursor: 'default',
        opacity: s.opacity,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: s.border }} />
      <Typography variant="caption" fontWeight="bold" display="block" sx={{ mb: 0.3 }}>
        {data.label}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block">
        {data.points} điểm
      </Typography>
      {data.status === 'correct' && <CheckCircleIcon sx={{ color: '#43a047', fontSize: 18, mt: 0.3 }} />}
      {data.status === 'incorrect' && <CancelIcon sx={{ color: '#e53935', fontSize: 18, mt: 0.3 }} />}
      {data.status === 'current' && (
        <Chip label="▶ Hiện tại" size="small" color="warning" sx={{ mt: 0.3, height: 20, fontSize: 10 }} />
      )}
      {data.status === 'locked' && <LockIcon sx={{ color: '#bdbdbd', fontSize: 16, mt: 0.3 }} />}
      <Handle type="source" position={Position.Bottom} style={{ background: s.border }} />
    </div>
  );
}

const nodeTypes = { mindMapNode: MindMapNode };

// ─── Xây dựng cây từ danh sách phẳng ────────────────────────────────────────
function buildTree(flatNodes) {
  const map = {};
  flatNodes.forEach((n) => { map[n.id] = { ...n, children: [] }; });

  let root = null;
  flatNodes.forEach((n) => {
    if (n.parentId === null || n.parentId === undefined) {
      root = map[n.id];
    } else if (map[n.parentId]) {
      map[n.parentId].children.push(map[n.id]);
    }
  });

  Object.values(map).forEach((n) => {
    n.children.sort((a, b) => a.order - b.order);
  });

  return { root, nodeMap: map };
}

// ─── Tính vị trí layout cây ─────────────────────────────────────────────────
function calcPositions(root) {
  const positions = {};
  const H_GAP = 210;
  const V_GAP = 130;

  function countLeaves(node) {
    if (node.children.length === 0) return 1;
    return node.children.reduce((s, c) => s + countLeaves(c), 0);
  }

  function assign(node, depth, startX) {
    const leaves = countLeaves(node);
    const width = leaves * H_GAP;
    positions[node.id] = { x: startX + width / 2 - 90, y: depth * V_GAP };
    let cx = startX;
    node.children.forEach((child) => {
      const cl = countLeaves(child);
      assign(child, depth + 1, cx);
      cx += cl * H_GAP;
    });
  }

  if (root) assign(root, 0, 0);
  return positions;
}

// ─── DFS (pre-order) ─────────────────────────────────────────────────────────
function getDFSOrder(root) {
  const order = [];
  function dfs(node) {
    order.push(node.id);
    node.children.forEach((c) => dfs(c));
  }
  if (root) dfs(root);
  return order;
}

// ────────────────────────────────────────────────────────────────────────────
export default function ExamMindMap() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [exam, setExam] = useState(null);
  const [nodeMap, setNodeMap] = useState({});
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);

  // DFS state
  const [dfsOrder, setDfsOrder] = useState([]);
  const [dfsQueue, setDfsQueue] = useState([]);
  const [nodeStatuses, setNodeStatuses] = useState({});
  const [totalNodes, setTotalNodes] = useState(0);

  // Attempt tracking
  const attemptIdRef = useRef(null);
  const scoreRef = useRef(0);
  const [scoreDisplay, setScoreDisplay] = useState(0);

  // Dialog câu hỏi
  const [answer, setAnswer] = useState('');
  const [answerResult, setAnswerResult] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(true);


  // Kết quả cuối
  const [finished, setFinished] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // ── Khởi tạo mind map (không restore progress) ───────────────────────────
  const buildMap = useCallback((flatNodes, positions, initStatuses, queue) => {
    setRfNodes(
      flatNodes.map((n) => ({
        id: String(n.id),
        type: 'mindMapNode',
        position: positions[n.id] || { x: 0, y: 0 },
        data: { label: n.label, points: n.points, status: initStatuses[n.id] },
      }))
    );
    setRfEdges(
      flatNodes
        .filter((n) => n.parentId)
        .map((n) => ({
          id: `e${n.parentId}-${n.id}`,
          source: String(n.parentId),
          target: String(n.id),
          markerEnd: { type: MarkerType.ArrowClosed, color: '#90caf9' },
          style: { stroke: '#90caf9', strokeWidth: 2 },
        }))
    );
    setNodeStatuses(initStatuses);
    setDfsQueue(queue);
  }, [setRfNodes, setRfEdges]);

  const initFresh = useCallback((flatNodes) => {
    const { root, nodeMap: nm } = buildTree(flatNodes);
    setNodeMap(nm);
    if (!root) return;

    const positions = calcPositions(root);
    const order = getDFSOrder(root);
    setDfsOrder(order);
    setTotalNodes(order.length);

    const initStatuses = {};
    flatNodes.forEach((n) => { initStatuses[n.id] = 'locked'; });
    if (order.length > 0) initStatuses[order[0]] = 'current';

    scoreRef.current = 0;
    setScoreDisplay(0);
    setAnswer('');
    setAnswerResult(null);
    setFinished(false);
    setSubmitResult(null);

    buildMap(flatNodes, positions, initStatuses, order);
  }, [buildMap]);

  const restoreProgress = useCallback((flatNodes, nodeAnswers) => {
    const { root, nodeMap: nm } = buildTree(flatNodes);
    setNodeMap(nm);
    if (!root) return;

    const positions = calcPositions(root);
    const order = getDFSOrder(root);
    setDfsOrder(order);
    setTotalNodes(order.length);

    // Tập nodeId đã trả lời
    const answeredMap = {};
    nodeAnswers.forEach((na) => { answeredMap[na.nodeId] = na; });
    const answeredIds = new Set(nodeAnswers.map((na) => na.nodeId));

    // Tính lại điểm từ progress
    let restoredScore = 0;
    flatNodes.forEach((n) => {
      if (answeredMap[n.id]?.isCorrect) restoredScore += n.points;
    });
    scoreRef.current = restoredScore;
    setScoreDisplay(restoredScore);

    // Tìm node kế tiếp chưa trả lời theo DFS
    const remainingQueue = order.filter((nid) => !answeredIds.has(nid));

    const initStatuses = {};
    flatNodes.forEach((n) => { initStatuses[n.id] = 'locked'; });
    nodeAnswers.forEach((na) => {
      initStatuses[na.nodeId] = na.isCorrect ? 'correct' : 'incorrect';
    });
    if (remainingQueue.length > 0) initStatuses[remainingQueue[0]] = 'current';

    setAnswer('');
    setAnswerResult(null);
    setFinished(false);
    setSubmitResult(null);

    buildMap(flatNodes, positions, initStatuses, remainingQueue);
  }, [buildMap]);

  // ── Fetch dữ liệu & kiểm tra progress ───────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const { data: examData } = await api.get(`/api/exams/${id}`);
        setExam(examData);

        const progressRes = await api.get(`/api/attempts/progress?examId=${id}`);
        const progress = progressRes.data;

        if (progress && progress.nodeAnswers?.length > 0) {
          // Bắt buộc tiếp tục (không cho chọn)
          attemptIdRef.current = progress.attemptId;
          restoreProgress(examData.nodes, progress.nodeAnswers);
        } else {
          // Bắt đầu mới
          const { data: startData } = await api.post('/api/attempts/start', { examId: parseInt(id) });
          attemptIdRef.current = startData.attemptId;
          initFresh(examData.nodes);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [id, initFresh, restoreProgress]);

  // ── Cập nhật màu node ────────────────────────────────────────────────────
  useEffect(() => {
    setRfNodes((prev) =>
      prev.map((n) => ({
        ...n,
        data: { ...n.data, status: nodeStatuses[parseInt(n.id)] || 'locked' },
      }))
    );
  }, [nodeStatuses, setRfNodes]);


  // ── Xử lý trả lời ───────────────────────────────────────────────────────
  const currentNodeId = dfsQueue[0] ?? null;
  const currentNode = currentNodeId ? nodeMap[currentNodeId] : null;
  const hasOptions = Array.isArray(currentNode?.options) && currentNode.options.length > 0;

  const handleAnswer = async () => {
    if (!currentNode || !answer.trim()) return;

    const correct =
      answer.trim().toUpperCase() === currentNode.correctAnswer.trim().toUpperCase() ||
      answer.trim().toLowerCase() === currentNode.correctAnswer.trim().toLowerCase();

    if (correct) {
      scoreRef.current += currentNode.points;
      setScoreDisplay(scoreRef.current);
      setNodeStatuses((prev) => ({ ...prev, [currentNodeId]: 'correct' }));
    } else {
      setNodeStatuses((prev) => ({ ...prev, [currentNodeId]: 'incorrect' }));
    }

    setAnswerResult(correct ? 'correct' : 'incorrect');

    // Lưu câu trả lời lên server
    if (attemptIdRef.current) {
      api.post('/api/attempts/answer', {
        attemptId: attemptIdRef.current,
        nodeId: currentNodeId,
        answer: answer.trim(),
        isCorrect: correct,
      }).catch(console.error);
    }
  };

  // ── Tiếp tục sang node kế tiếp ──────────────────────────────────────────
  const handleContinue = () => {
    const remaining = dfsQueue.slice(1);
    setDfsQueue(remaining);
    setAnswer('');
    setAnswerResult(null);
    setDialogOpen(true); // Mở dialog cho câu tiếp theo

    if (remaining.length > 0) {
      const nextId = remaining[0];
      setNodeStatuses((prev) => ({ ...prev, [nextId]: 'current' }));
    } else {
      setFinished(true);
      completeAttempt(scoreRef.current);
    }
  };

  // ── Hoàn thành bài ──────────────────────────────────────────────────────
  const completeAttempt = async (finalScore) => {
    setSubmitting(true);
    try {
      if (attemptIdRef.current) {
        const { data } = await api.post('/api/attempts/complete', {
          attemptId: attemptIdRef.current,
          score: finalScore,
        });
        setSubmitResult(data);
      }
    } catch (err) {
      console.error('Complete error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Reset bài ────────────────────────────────────────────────────────────
  const handleReset = async () => {
    if (!exam) return;
    try {
      const { data } = await api.post('/api/attempts/start', { examId: parseInt(id) });
      attemptIdRef.current = data.attemptId;
      initFresh(exam.nodes);
    } catch (err) {
      console.error(err);
    }
  };

  const progress =
    totalNodes > 0
      ? Math.round(((totalNodes - dfsQueue.length) / totalNodes) * 100)
      : 0;

  if (loading) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={48} />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f5f7fa' }}>
      <Navbar />

      {/* Info bar */}
      <Paper elevation={1} square sx={{ px: 3, py: 1.5, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate('/student')} variant="outlined">
          Quay lại
        </Button>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ flex: 1, minWidth: 150 }}>
          {exam?.title}
        </Typography>
        <Chip label={`Điểm: ${scoreDisplay}`} color="primary" variant="outlined" />
        <Chip label={`${totalNodes - dfsQueue.length}/${totalNodes} node`} color="secondary" variant="outlined" />
        <Tooltip title={!finished && dfsQueue.length > 0 ? "Phải hoàn thành bài hiện tại trước" : ""}>
          <span>
            <Button
              size="small"
              startIcon={<ReplayIcon />}
              onClick={handleReset}
              variant="text"
              disabled={!finished && dfsQueue.length > 0}
            >
              Làm lại
            </Button>
          </span>
        </Tooltip>
      </Paper>

      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{ height: 6 }}
        color={progress === 100 ? 'success' : 'primary'}
      />

      <Box sx={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnScroll
          minZoom={0.3}
          maxZoom={2}
        >
          <Controls showInteractive={false} />
          <Background color="#e0e0e0" gap={20} />
        </ReactFlow>

        {/* Floating button to reopen dialog if closed */}
        {!finished && dfsQueue.length > 0 && !dialogOpen && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<PlayArrowIcon />}
            onClick={() => setDialogOpen(true)}
            sx={{
              position: 'absolute',
              bottom: 24,
              right: 24,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              zIndex: 10,
            }}
          >
            Mở câu hỏi
          </Button>
        )}
      </Box>

      {/* ── Dialog câu hỏi ─────────────────────────────────────────────── */}
      <Dialog
        open={!finished && dfsQueue.length > 0 && dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" sx={{ flex: 1 }}>
            {currentNode?.label}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip label={`+${currentNode?.points} điểm`} color="primary" size="small" />
            <Chip
              label={`${totalNodes - dfsQueue.length + 1}/${totalNodes}`}
              variant="outlined"
              size="small"
            />
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          <Typography variant="body1" sx={{ mb: 2.5, fontWeight: 500 }}>
            {currentNode?.question}
          </Typography>

          {answerResult === null && (
            hasOptions ? (
              <FormControl fullWidth>
                <RadioGroup
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                >
                  {currentNode.options.map((opt, i) => (
                    <FormControlLabel
                      key={i}
                      value={opt.charAt(0)}
                      control={<Radio />}
                      label={opt}
                      sx={{
                        mb: 0.5,
                        border: '1px solid #e0e0e0',
                        borderRadius: 1,
                        mx: 0,
                        px: 1,
                        '&:hover': { bgcolor: '#f5f5f5' },
                      }}
                    />
                  ))}
                </RadioGroup>
              </FormControl>
            ) : (
              <TextField
                fullWidth
                label="Câu trả lời của bạn"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAnswer()}
                autoFocus
                key={currentNodeId}
                placeholder="Nhập câu trả lời rồi nhấn Enter hoặc Trả lời..."
              />
            )
          )}

          {answerResult === 'correct' && (
            <Alert severity="success" icon={<CheckCircleIcon />} sx={{ fontSize: '1rem' }}>
              <strong>Chính xác!</strong> Bạn nhận được <strong>+{currentNode?.points} điểm</strong>.
            </Alert>
          )}

          {answerResult === 'incorrect' && (
            <Box>
              <Alert severity="error" sx={{ mb: 1.5 }}>
                <strong>Chưa đúng!</strong> Đáp án đúng là:{' '}
                <strong>
                  {hasOptions
                    ? currentNode.options.find((o) => o.startsWith(currentNode.correctAnswer)) || currentNode.correctAnswer
                    : currentNode?.correctAnswer}
                </strong>
              </Alert>
              {currentNode?.hint && (
                <Alert severity="info" icon={<LightbulbIcon />}>
                  <strong>Gợi ý:</strong> {currentNode.hint}
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          {answerResult === null ? (
            <Button
              variant="contained"
              onClick={handleAnswer}
              disabled={!answer.trim()}
              size="large"
              fullWidth
            >
              Trả lời
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleContinue}
              size="large"
              fullWidth
              color={dfsQueue.length > 1 ? 'primary' : 'success'}
            >
              {dfsQueue.length > 1 ? 'Tiếp tục →' : 'Nộp bài'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* ── Dialog kết quả ─────────────────────────────────────────────── */}
      <Dialog open={finished} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ textAlign: 'center', pt: 3 }}>
          <EmojiEventsIcon sx={{ fontSize: 56, color: '#f9a825' }} />
          <Typography variant="h5" fontWeight="bold" sx={{ mt: 1 }}>
            Kết quả bài thi
          </Typography>
        </DialogTitle>

        <DialogContent>
          {submitting ? (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <CircularProgress />
              <Typography sx={{ mt: 2 }} color="text.secondary">Đang lưu kết quả...</Typography>
            </Box>
          ) : submitResult ? (
            <Box sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="h2" color="primary" fontWeight="bold">
                {submitResult.attempt.score}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Điểm lần này
              </Typography>
              <Box sx={{ mt: 2, p: 2, bgcolor: '#f3e5f5', borderRadius: 2 }}>
                <Typography variant="h4" color="secondary" fontWeight="bold">
                  {submitResult.avgScore}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Điểm trung bình ({submitResult.attemptCount} lần làm)
                </Typography>
              </Box>
            </Box>
          ) : null}
        </DialogContent>

        <DialogActions sx={{ justifyContent: 'center', gap: 2, pb: 3 }}>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate('/student')}>
            Về trang chủ
          </Button>
          <Button variant="contained" startIcon={<ReplayIcon />} onClick={handleReset}>
            Làm lại từ đầu
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
