import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  FormControl,
  RadioGroup,
  FormControlLabel,
  Radio,
  Tooltip,
  IconButton,
  Divider,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ReplayIcon from '@mui/icons-material/Replay';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import LockIcon from '@mui/icons-material/Lock';
import CloseIcon from '@mui/icons-material/Close';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import Navbar from '../components/Navbar';
import api from '../api';

// ─── Màu theo trạng thái node ──────────────────────────────────────────────
const STATUS_STYLE = {
  locked:    { bg: '#f5f5f5', border: '#bdbdbd', shadow: 'none', opacity: 0.4, cursor: 'not-allowed' },
  current:   { bg: '#fff8e1', border: '#f9a825', shadow: '0 4px 14px rgba(249,168,37,0.5)', opacity: 1, cursor: 'pointer' },
  correct:   { bg: '#e8f5e9', border: '#43a047', shadow: '0 2px 8px rgba(67,160,71,0.3)', opacity: 1, cursor: 'pointer' },
  incorrect: { bg: '#fce4ec', border: '#e53935', shadow: '0 2px 8px rgba(229,57,53,0.3)', opacity: 1, cursor: 'pointer' },
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
        transition: 'all 0.25s',
        cursor: s.cursor,
        opacity: s.opacity,
        userSelect: 'none',
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
        <Chip label="▶ Nhấn để trả lời" size="small" color="warning" sx={{ mt: 0.3, height: 20, fontSize: 10 }} />
      )}
      {data.status === 'locked' && <LockIcon sx={{ color: '#bdbdbd', fontSize: 16, mt: 0.3 }} />}
      <Handle type="source" position={Position.Bottom} style={{ background: s.border }} />
    </div>
  );
}

const nodeTypes = { mindMapNode: MindMapNode };

// ─── Helpers ─────────────────────────────────────────────────────────────────
function buildTree(flatNodes) {
  const map = {};
  flatNodes.forEach((n) => { map[n.id] = { ...n, children: [] }; });
  let root = null;
  flatNodes.forEach((n) => {
    if (!n.parentId) root = map[n.id];
    else if (map[n.parentId]) map[n.parentId].children.push(map[n.id]);
  });
  Object.values(map).forEach((n) => n.children.sort((a, b) => a.order - b.order));
  return { root, nodeMap: map };
}

function calcPositions(root) {
  const positions = {};
  const H_GAP = 210, V_GAP = 130;
  function countLeaves(n) {
    return n.children.length === 0 ? 1 : n.children.reduce((s, c) => s + countLeaves(c), 0);
  }
  function assign(node, depth, startX) {
    const leaves = countLeaves(node);
    positions[node.id] = { x: startX + (leaves * H_GAP) / 2 - 90, y: depth * V_GAP };
    let cx = startX;
    node.children.forEach((child) => { assign(child, depth + 1, cx); cx += countLeaves(child) * H_GAP; });
  }
  if (root) assign(root, 0, 0);
  return positions;
}

function getDFSOrder(root) {
  const order = [];
  function dfs(n) { order.push(n.id); n.children.forEach(dfs); }
  if (root) dfs(root);
  return order;
}

// ────────────────────────────────────────────────────────────────────────────
export default function ExamMindMap() {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [exam, setExam] = useState(null);
  const [nodeMap, setNodeMap] = useState({});
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);

  const [dfsOrder, setDfsOrder] = useState([]);
  const [dfsQueue, setDfsQueue] = useState([]);
  const [nodeStatuses, setNodeStatuses] = useState({});
  const [totalNodes, setTotalNodes] = useState(0);

  const [nodeAnswerMap, setNodeAnswerMap] = useState({});

  const attemptIdRef = useRef(null);
  const scoreRef = useRef(0);
  const [scoreDisplay, setScoreDisplay] = useState(0);

  const [dialogNodeId, setDialogNodeId] = useState(null);
  const [answer, setAnswer] = useState('');
  const [answerResult, setAnswerResult] = useState(null);
  const [answerPending, setAnswerPending] = useState(false);
  const [resetting, setResetting] = useState(false);
  const blockRef = useRef(false); // chống double-click / double-submit

  const [finished, setFinished] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [rfInstance, setRfInstance] = useState(null);
  const actionBusy = answerPending || submitting || resetting;

  // displayNodes = rfNodes (structure/vị trí) + nodeStatuses (màu sắc)
  // Phải khai báo SAU tất cả state để tránh TDZ (Temporal Dead Zone)
  const displayNodes = useMemo(() =>
    rfNodes.map((n) => ({
      ...n,
      data: { ...n.data, status: nodeStatuses[parseInt(n.id)] || 'locked' },
    })),
    [rfNodes, nodeStatuses]
  );

  // ── Build map lên React Flow ──────────────────────────────────────────────
  const buildMap = useCallback((flatNodes, positions, initStatuses, queue) => {
    setRfNodes(flatNodes.map((n) => ({
      id: String(n.id),
      type: 'mindMapNode',
      position: positions[n.id] || { x: 0, y: 0 },
      data: { label: n.label, points: n.points, status: initStatuses[n.id] },
    })));
    setRfEdges(flatNodes.filter((n) => n.parentId).map((n) => ({
      id: `e${n.parentId}-${n.id}`,
      source: String(n.parentId),
      target: String(n.id),
      markerEnd: { type: MarkerType.ArrowClosed, color: '#90caf9' },
      style: { stroke: '#90caf9', strokeWidth: 2 },
    })));
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
    const statuses = {};
    flatNodes.forEach((n) => { statuses[n.id] = 'locked'; });
    if (order.length > 0) statuses[order[0]] = 'current';
    scoreRef.current = 0;
    setScoreDisplay(0);
    setNodeAnswerMap({});
    setAnswer('');
    setAnswerResult(null);
    setDialogNodeId(null);
    setFinished(false);
    setSubmitResult(null);
    buildMap(flatNodes, positions, statuses, order);
  }, [buildMap]);

  const restoreProgress = useCallback((flatNodes, nodeAnswers) => {
    const { root, nodeMap: nm } = buildTree(flatNodes);
    setNodeMap(nm);
    if (!root) return;
    const positions = calcPositions(root);
    const order = getDFSOrder(root);
    setDfsOrder(order);
    setTotalNodes(order.length);

    const answeredMap = {};
    nodeAnswers.forEach((na) => { answeredMap[na.nodeId] = na; });
    const answeredIds = new Set(nodeAnswers.map((na) => na.nodeId));

    let restoredScore = 0;
    flatNodes.forEach((n) => { if (answeredMap[n.id]?.isCorrect) restoredScore += n.points; });
    scoreRef.current = restoredScore;
    setScoreDisplay(restoredScore);

    const remaining = order.filter((nid) => !answeredIds.has(nid));
    const statuses = {};
    flatNodes.forEach((n) => { statuses[n.id] = 'locked'; });
    nodeAnswers.forEach((na) => { statuses[na.nodeId] = na.isCorrect ? 'correct' : 'incorrect'; });
    if (remaining.length > 0) statuses[remaining[0]] = 'current';

    // Rebuild nodeAnswerMap từ server data
    const restoredAnswerMap = {};
    nodeAnswers.forEach((na) => { restoredAnswerMap[na.nodeId] = { answer: na.answer, isCorrect: na.isCorrect }; });
    setNodeAnswerMap(restoredAnswerMap);

    setAnswer('');
    setAnswerResult(null);
    setDialogNodeId(null);
    setFinished(false);
    setSubmitResult(null);
    buildMap(flatNodes, positions, statuses, remaining);
  }, [buildMap]);

  // ── Fetch & init ──────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const { data: examData } = await api.get(`/api/exams/${id}`);
        setExam(examData);
        const progressRes = await api.get(`/api/attempts/progress?examId=${id}`);
        const progress = progressRes.data;
        if (progress?.nodeAnswers?.length > 0) {
          attemptIdRef.current = progress.attemptId;
          restoreProgress(examData.nodes, progress.nodeAnswers);
        } else {
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

  // ── Click node ────────────────────────────────────────────────────────────
  const onNodeClick = useCallback((_evt, node) => {
    const nid = parseInt(node.id);
    const status = nodeStatuses[nid];
    if (status === 'locked') return;

    setDialogNodeId(nid);
    if (status === 'current') {
      blockRef.current = false;
      setAnswer('');
      setAnswerResult(null);
    }
  }, [nodeStatuses]);

  const closeDialog = () => {
    setDialogNodeId(null);
    // Không reset answer/answerResult để giữ trạng thái khi mở lại
  };

  // ── Lấy node đang hiển thị trong dialog ───────────────────────────────────
  const dialogNode = dialogNodeId ? nodeMap[dialogNodeId] : null;
  const dialogStatus = dialogNodeId ? nodeStatuses[dialogNodeId] : null;
  const isReviewMode = dialogStatus === 'correct' || dialogStatus === 'incorrect';
  const isAnswerMode = dialogStatus === 'current';
  const hasOptions = Array.isArray(dialogNode?.options) && dialogNode.options.length > 0;
  const reviewData = dialogNodeId ? nodeAnswerMap[dialogNodeId] : null;

  // ── Helper: cập nhật status — displayNodes (useMemo) tự sync lên map ──
  const applyNodeStatus = useCallback((nodeId, status) => {
    setNodeStatuses((prev) => ({ ...prev, [nodeId]: status }));
  }, []);

  // ── Core submit: dùng chung cho text input và option click ──────────────
  const submitAnswer = useCallback(async (ans) => {
    if (!dialogNode || !ans.trim() || !isAnswerMode || blockRef.current || answerPending) return;
    blockRef.current = true;
    setAnswerPending(true);

    const correct = ans.trim().toUpperCase() === dialogNode.correctAnswer.trim().toUpperCase();
    const currentNodeId = dialogNodeId;

    if (correct) {
      scoreRef.current += dialogNode.points;
      setScoreDisplay(scoreRef.current);
    }
    applyNodeStatus(currentNodeId, correct ? 'correct' : 'incorrect');
    setAnswer(ans.trim());
    setAnswerResult(correct ? 'correct' : 'incorrect');
    setNodeAnswerMap((prev) => ({ ...prev, [currentNodeId]: { answer: ans.trim(), isCorrect: correct } }));

    try {
      if (attemptIdRef.current) {
        await api.post('/api/attempts/answer', {
          attemptId: attemptIdRef.current,
          nodeId: currentNodeId,
          answer: ans.trim(),
          isCorrect: correct,
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setAnswerPending(false);
      blockRef.current = false;
    }
  }, [dialogNode, dialogNodeId, isAnswerMode, applyNodeStatus, answerPending]);

  const handleAnswer = () => submitAnswer(answer);

  // Trắc nghiệm: chọn radio rồi bấm "Trả lời"
  const handleSelectOption = (letter) => setAnswer(letter);

  // ── Tiếp tục sang node kế tiếp ────────────────────────────────────────────
  const handleContinue = () => {
    if (actionBusy || (blockRef.current && answerResult === null)) return; // guard khi chưa trả lời / đang bận
    blockRef.current = false; // reset cho câu tiếp theo

    const remaining = dfsQueue.slice(1);
    setDfsQueue(remaining);
    setAnswer('');
    setAnswerResult(null);

    if (remaining.length > 0) {
      const nextId = remaining[0];
      applyNodeStatus(nextId, 'current');
      setDialogNodeId(nextId);
    } else {
      setDialogNodeId(null);
      setFinished(true);
      completeAttempt(scoreRef.current);
    }
  };


  // ── Hoàn thành bài ────────────────────────────────────────────────────────
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
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Làm lại ───────────────────────────────────────────────────────────────
  const handleReset = async () => {
    if (!exam) return;
    setResetting(true);
    try {
      const { data } = await api.post('/api/attempts/start', { examId: parseInt(id) });
      attemptIdRef.current = data.attemptId;
      initFresh(exam.nodes);
    } catch (err) {
      console.error(err);
    } finally {
      setResetting(false);
    }
  };

  const currentQueueNodeId = dfsQueue[0] ?? null;
  const answeredCount = totalNodes - dfsQueue.length;
  const progress = totalNodes > 0 ? Math.round((answeredCount / totalNodes) * 100) : 0;

  const handleGoToCurrent = useCallback(() => {
    if (!rfInstance || !currentQueueNodeId) return;
    const node = rfNodes.find((n) => parseInt(n.id) === currentQueueNodeId);
    if (node) {
      rfInstance.setCenter(node.position.x + 90, node.position.y + 40, { zoom: 1.5, duration: 450 });
    }
  }, [rfInstance, currentQueueNodeId, rfNodes]); // rfNodes dùng để lấy position (không phải displayNodes)

  const handleCloseAndFocus = useCallback(() => {
    closeDialog();
    handleGoToCurrent();
  }, [handleGoToCurrent]);

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
      <Paper elevation={1} square sx={{ px: { xs: 1.5, sm: 3 }, py: 1, display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 }, flexWrap: 'wrap' }}>
        <IconButton size="small" onClick={() => navigate('/student')} sx={{ flexShrink: 0 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography
          variant="subtitle2"
          fontWeight="bold"
          noWrap
          sx={{ flex: 1, minWidth: 0, fontSize: { xs: '0.8rem', sm: '1rem' } }}
        >
          {exam?.title}
        </Typography>
        <Chip label={`${scoreDisplay} điểm`} color="primary" variant="outlined" size="small" />
        <Chip label={`${answeredCount}/${totalNodes}`} color="secondary" variant="outlined" size="small" />
        <Tooltip title={!finished && dfsQueue.length > 0 ? 'Phải hoàn thành bài hiện tại trước' : ''}>
          <span>
            <IconButton
              size="small"
              onClick={handleReset}
              disabled={actionBusy || (!finished && dfsQueue.length > 0)}
              color="default"
            >
              <ReplayIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Paper>

      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{ height: 5 }}
        color={progress === 100 ? 'success' : 'primary'}
      />

      <Box sx={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={displayNodes}
          edges={rfEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          onInit={setRfInstance}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnScroll
          minZoom={0.3}
          maxZoom={2}
        >
          <Controls showInteractive={false} />
          <Background color="#e0e0e0" gap={20} />
        </ReactFlow>

        {/* Nhóm nút điều hướng góc phải dưới */}
        <Box sx={{ position: 'absolute', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, zIndex: 10 }}>
          {/* FAB mở câu hỏi hiện tại */}
          {!finished && currentQueueNodeId && dialogNodeId === null && (
            <Button
              variant="contained"
              color="warning"
              startIcon={<PlayArrowIcon />}
              onClick={() => { setAnswer(''); setAnswerResult(null); setDialogNodeId(currentQueueNodeId); }}
              sx={{ boxShadow: '0 4px 14px rgba(0,0,0,0.3)', borderRadius: 3, maxWidth: 260 }}
            >
              ▶ {nodeMap[currentQueueNodeId]?.label || 'Câu hỏi hiện tại'}
            </Button>
          )}
          {/* Nút đến câu đang làm */}
          {!finished && currentQueueNodeId && (
            <Tooltip title="Đến câu đang làm" placement="left">
              <IconButton
                onClick={handleGoToCurrent}
                sx={{ bgcolor: 'white', boxShadow: 2, '&:hover': { bgcolor: '#fff8e1' } }}
                size="small"
              >
                <CenterFocusStrongIcon color="warning" />
              </IconButton>
            </Tooltip>
          )}
          {/* Nút reset về kích cỡ mặc định */}
          <Tooltip title="Về kích cỡ mặc định" placement="left">
            <IconButton
              onClick={() => rfInstance?.fitView({ padding: 0.3, duration: 400 })}
              sx={{ bgcolor: 'white', boxShadow: 2, '&:hover': { bgcolor: '#f5f5f5' } }}
              size="small"
            >
              <ZoomOutMapIcon color="action" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* ── Dialog câu hỏi / xem lại ───────────────────────────────────── */}
      <Dialog
        open={Boolean(dialogNodeId) && !finished}
        onClose={closeDialog}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        transitionDuration={{ enter: 150, exit: 100 }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" sx={{ flex: 1, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
              {dialogNode?.label}
            </Typography>
            <Chip
              label={`${dialogNode?.points} điểm`}
              color={isReviewMode ? (reviewData?.isCorrect ? 'success' : 'error') : 'primary'}
              size="small"
            />
            {isAnswerMode && (
              <Chip
                label={`${answeredCount + 1}/${totalNodes}`}
                variant="outlined"
                size="small"
              />
            )}
            {isReviewMode && (
              <Chip
                label={reviewData?.isCorrect ? 'Đúng' : 'Sai'}
                color={reviewData?.isCorrect ? 'success' : 'error'}
                size="small"
                variant="outlined"
              />
            )}
            {isMobile && (
              <IconButton size="small" onClick={closeDialog} sx={{ ml: 0.5 }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          {/* Câu hỏi */}
          <Typography variant="body1" sx={{ mb: 2, fontWeight: 500 }}>
            {dialogNode?.question}
          </Typography>

          {/* ── Chế độ trả lời (node hiện tại) ── */}
          {isAnswerMode && answerResult === null && (
            hasOptions ? (
              <FormControl fullWidth>
                <RadioGroup
                  value={answer}
                  onChange={(e) => handleSelectOption(e.target.value)}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 1,
                  }}
                >
                  {dialogNode.options.map((opt, i) => {
                    const letter = opt.charAt(0);
                    const checked = answer === letter;
                    return (
                      <FormControlLabel
                        key={i}
                        value={letter}
                        control={<Radio />}
                        disabled={actionBusy}
                        label={opt}
                        sx={{
                          m: 0,
                          px: 1.5,
                          py: 0.75,
                          border: '1px solid',
                          borderColor: checked ? '#f9a825' : '#e0e0e0',
                          borderRadius: 2,
                          bgcolor: checked ? '#fff8e1' : 'white',
                          transition: 'all 0.18s ease',
                          '&:hover': {
                            bgcolor: checked ? '#fff3cd' : '#fafafa',
                            borderColor: '#f9a825',
                          },
                        }}
                      />
                    );
                  })}
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
                key={dialogNodeId}
                placeholder="Nhập câu trả lời rồi nhấn Enter..."
                disabled={actionBusy}
              />
            )
          )}

          {/* Kết quả sau khi trả lời (chế độ trả lời) */}
          {isAnswerMode && answerResult === 'correct' && (
            <Alert severity="success" icon={<CheckCircleIcon />}>
              <strong>Chính xác!</strong> +{dialogNode?.points} điểm
            </Alert>
          )}
          {isAnswerMode && answerResult === 'incorrect' && (
            <Box>
              <Alert severity="error" sx={{ mb: 1 }}>
                <strong>Chưa đúng!</strong> Bạn trả lời: <em>{answer}</em><br />
                Đáp án đúng:{' '}
                <strong>
                  {hasOptions
                    ? dialogNode.options.find((o) => o.startsWith(dialogNode.correctAnswer)) || dialogNode.correctAnswer
                    : dialogNode?.correctAnswer}
                </strong>
              </Alert>
              {dialogNode?.hint && (
                <Alert severity="info" icon={<LightbulbIcon />}>
                  <strong>Gợi ý:</strong> {dialogNode.hint}
                </Alert>
              )}
            </Box>
          )}

          {/* ── Chế độ xem lại (node đã trả lời) ── */}
          {isReviewMode && (
            <Box>
              <Divider sx={{ mb: 2 }} />
              {reviewData?.isCorrect ? (
                <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 1.5 }}>
                  <strong>Bạn đã trả lời đúng!</strong> Câu trả lời: <em>{reviewData.answer}</em>
                </Alert>
              ) : (
                <Alert severity="error" icon={<CancelIcon />} sx={{ mb: 1.5 }}>
                  <strong>Bạn đã trả lời sai.</strong> Câu trả lời của bạn: <em>{reviewData?.answer}</em>
                  <br />
                  Đáp án đúng:{' '}
                  <strong>
                    {hasOptions
                      ? dialogNode.options?.find((o) => o.startsWith(dialogNode.correctAnswer)) || dialogNode.correctAnswer
                      : dialogNode?.correctAnswer}
                  </strong>
                </Alert>
              )}
              {/* Hiển thị đáp án trắc nghiệm */}
              {hasOptions && (
                <Box sx={{ mb: 1.5 }}>
                  {dialogNode.options.map((opt, i) => {
                    const letter = opt.charAt(0);
                    const isCorrect = letter === dialogNode.correctAnswer;
                    const isChosen = letter === reviewData?.answer;
                    return (
                      <Box
                        key={i}
                        sx={{
                          p: 1,
                          mb: 0.5,
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: isCorrect ? '#43a047' : isChosen ? '#e53935' : '#e0e0e0',
                          bgcolor: isCorrect ? '#e8f5e9' : isChosen ? '#fce4ec' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                        }}
                      >
                        <Typography variant="body2">{opt}</Typography>
                        {isCorrect && <CheckCircleIcon sx={{ color: '#43a047', fontSize: 16, ml: 'auto' }} />}
                        {isChosen && !isCorrect && <CancelIcon sx={{ color: '#e53935', fontSize: 16, ml: 'auto' }} />}
                      </Box>
                    );
                  })}
                </Box>
              )}
              {dialogNode?.hint && (
                <Alert severity="info" icon={<LightbulbIcon />}>
                  <strong>Gợi ý:</strong> {dialogNode.hint}
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          {isAnswerMode && answerResult === null && (
            <>
              <Button variant="outlined" onClick={handleCloseAndFocus} disabled={actionBusy}>
                Xem sơ đồ
              </Button>
              <Button
                variant="contained"
                onClick={handleAnswer}
                disabled={!answer.trim() || actionBusy}
                size="large"
                sx={{ flex: 1 }}
              >
                {answerPending ? 'Đang xử lý...' : 'Trả lời'}
              </Button>
            </>
          )}
          {isAnswerMode && answerResult !== null && (
            <>
              <Button variant="outlined" onClick={handleCloseAndFocus} disabled={actionBusy}>
                Xem sơ đồ
              </Button>
              <Button
                variant="contained"
                onClick={handleContinue}
                size="large"
                sx={{ flex: 1 }}
                color={dfsQueue.length > 1 ? 'primary' : 'success'}
                disabled={actionBusy}
              >
                {dfsQueue.length > 1 ? 'Câu tiếp theo →' : 'Nộp bài'}
              </Button>
            </>
          )}
          {isReviewMode && dialogNodeId === currentQueueNodeId && (
            <>
              <Button variant="outlined" onClick={handleCloseAndFocus} disabled={actionBusy}>
                Xem sơ đồ
              </Button>
              <Button
                variant="contained"
                onClick={handleContinue}
                size="large"
                sx={{ flex: 1 }}
                color={dfsQueue.length > 1 ? 'primary' : 'success'}
                disabled={actionBusy}
              >
                {dfsQueue.length > 1 ? 'Câu tiếp theo →' : 'Nộp bài'}
              </Button>
            </>
          )}
          {isReviewMode && dialogNodeId !== currentQueueNodeId && (
            <Button variant="outlined" onClick={handleCloseAndFocus} fullWidth disabled={actionBusy}>
              Xem sơ đồ
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* ── Dialog kết quả ────────────────────────────────────────────────── */}
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
              <Typography variant="body2" color="text.secondary" gutterBottom>Điểm lần này</Typography>
              <Box sx={{ mt: 2, p: 2, bgcolor: '#f3e5f5', borderRadius: 2 }}>
                <Typography variant="h4" color="secondary" fontWeight="bold">{submitResult.avgScore}</Typography>
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
