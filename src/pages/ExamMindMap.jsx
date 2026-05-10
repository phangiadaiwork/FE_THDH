import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
import MathText from '../components/MathText';
import api from '../api';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

function NodeImage({ src, alt, sx }) {
  if (!src) return null;
  return (
    <Box
      component="img"
      src={`${API_BASE}${src}`}
      alt={alt || ''}
      sx={{
        maxWidth: '100%',
        maxHeight: 240,
        borderRadius: 2,
        border: '1px solid #e0e0e0',
        objectFit: 'contain',
        display: 'block',
        my: 1,
        ...sx,
      }}
    />
  );
}

// ─── Màu theo trạng thái node ──────────────────────────────────────────────
const STATUS_STYLE = {
  locked:    { bg: '#f5f5f5', border: '#bdbdbd', shadow: 'none', opacity: 0.4, cursor: 'not-allowed' },
  current:   { bg: '#fff8e1', border: '#f9a825', shadow: '0 4px 14px rgba(249,168,37,0.5)', opacity: 1, cursor: 'pointer' },
  correct:   { bg: '#e8f5e9', border: '#43a047', shadow: '0 2px 8px rgba(67,160,71,0.3)', opacity: 1, cursor: 'pointer' },
  incorrect: { bg: '#fce4ec', border: '#e53935', shadow: '0 2px 8px rgba(229,57,53,0.3)', opacity: 1, cursor: 'pointer' },
};

// ─── Custom Node (có responsive) ────────────────────────────────────────────
function MindMapNode({ data }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const s = STATUS_STYLE[data.status] || STATUS_STYLE.locked;
  return (
    <div
      style={{
        background: s.bg,
        border: `2px solid ${s.border}`,
        boxShadow: s.shadow,
        borderRadius: 10,
        padding: isMobile ? '6px 10px' : '10px 14px',
        minWidth: isMobile ? 110 : 130,
        maxWidth: isMobile ? 160 : 190,
        textAlign: 'center',
        transition: 'all 0.25s',
        cursor: s.cursor,
        opacity: s.opacity,
        userSelect: 'none',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: s.border }} />
      <Typography
        variant="caption"
        fontWeight="bold"
        display="block"
        sx={{ mb: 0.3, fontSize: isMobile ? '0.65rem' : '0.75rem' }}
      >
        {data.label}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        display="block"
        sx={{ fontSize: isMobile ? '0.6rem' : '0.7rem' }}
      >
        {data.points} điểm
      </Typography>
      {data.status === 'correct' && <CheckCircleIcon sx={{ color: '#43a047', fontSize: isMobile ? 16 : 18, mt: 0.3 }} />}
      {data.status === 'incorrect' && <CancelIcon sx={{ color: '#e53935', fontSize: isMobile ? 16 : 18, mt: 0.3 }} />}
      {data.status === 'current' && (
        <Chip label="▶ Nhấn để trả lời" size="small" color="warning" sx={{ mt: 0.3, height: 20, fontSize: 10 }} />
      )}
      {data.status === 'locked' && <LockIcon sx={{ color: '#bdbdbd', fontSize: isMobile ? 14 : 16, mt: 0.3 }} />}
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

// ─── OptionGrid dùng chung (responsive bên trong) ──────────────────────────
const OptionGrid = memo(({ options, optionImages, correctAnswer, chosenAnswer, onSelect, readOnly }) => {
  const handleClick = (letter) => {
    if (!readOnly && onSelect) onSelect(letter);
  };

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
        gap: 1,
        mt: 2,
      }}
    >
      {options.map((opt, i) => {
        const letter = opt.charAt(0);
        const isChosen = letter === chosenAnswer;
        const isCorrectAnswer = letter === correctAnswer;
        const optImage = optionImages?.[i] || null;
        let borderColor = '#e0e0e0';
        let bgColor = 'white';
        let icon = null;

        if (readOnly) {
          if (isCorrectAnswer) {
            borderColor = '#43a047';
            bgColor = '#e8f5e9';
            icon = <CheckCircleIcon sx={{ color: '#43a047', fontSize: 16 }} />;
          } else if (isChosen && !isCorrectAnswer) {
            borderColor = '#e53935';
            bgColor = '#fce4ec';
            icon = <CancelIcon sx={{ color: '#e53935', fontSize: 16 }} />;
          }
        } else {
          if (isChosen) {
            borderColor = '#43a047';
            bgColor = '#e8f5e9';
            icon = <CheckCircleIcon sx={{ color: '#43a047', fontSize: 16 }} />;
          }
        }

        return (
          <Box
            key={i}
            onClick={() => handleClick(letter)}
            sx={{
              p: { xs: 0.8, sm: 1 },
              border: '1px solid',
              borderColor,
              bgcolor: bgColor,
              borderRadius: 1.5,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              cursor: readOnly ? 'default' : 'pointer',
              transition: 'all 0.18s ease',
              '&:hover': !readOnly
                ? {
                    bgcolor: isChosen ? '#e8f5e9' : '#fafafa',
                    borderColor: isChosen ? '#43a047' : '#f9a825',
                  }
                : {},
              flexDirection: optImage ? 'column' : 'row',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
              <Typography variant="body2" component="span" sx={{ flex: 1, fontSize: { xs: '0.85rem', sm: '0.95rem' } }}>
                <MathText>{opt}</MathText>
              </Typography>
              {icon}
            </Box>
            {optImage && (
              <NodeImage src={optImage} alt={`Option ${letter}`} sx={{ maxHeight: 120, my: 0.5 }} />
            )}
          </Box>
        );
      })}
    </Box>
  );
});

// ────────────────────────────────────────────────────────────────────────────
export default function ExamMindMap() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isViewMode = searchParams.get('mode') === 'review';

  const rfInstanceRef = useRef(null);

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
  const [focusCurrentRequested, setFocusCurrentRequested] = useState(false);
  const blockRef = useRef(false);

  const [finished, setFinished] = useState(false);
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [rfInstance, setRfInstance] = useState(null);
  const actionBusy = answerPending || submitting || resetting;

  const displayNodes = useMemo(
    () =>
      rfNodes.map((n) => ({
        ...n,
        data: { ...n.data, status: nodeStatuses[parseInt(n.id)] || 'locked' },
      })),
    [rfNodes, nodeStatuses]
  );

  const buildMap = useCallback(
    (flatNodes, positions, initStatuses, queue) => {
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
    },
    [setRfNodes, setRfEdges]
  );

  const initFresh = useCallback(
    (flatNodes) => {
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
    },
    [buildMap]
  );

  const restoreProgress = useCallback(
    (flatNodes, nodeAnswers) => {
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
      flatNodes.forEach((n) => {
        if (answeredMap[n.id]?.isCorrect) restoredScore += n.points;
      });
      scoreRef.current = restoredScore;
      setScoreDisplay(restoredScore);

      const remaining = order.filter((nid) => !answeredIds.has(nid));
      const statuses = {};
      flatNodes.forEach((n) => { statuses[n.id] = 'locked'; });
      nodeAnswers.forEach((na) => {
        statuses[na.nodeId] = na.isCorrect ? 'correct' : 'incorrect';
      });
      if (remaining.length > 0) statuses[remaining[0]] = 'current';

      const restoredAnswerMap = {};
      nodeAnswers.forEach((na) => {
        restoredAnswerMap[na.nodeId] = { answer: na.answer, isCorrect: na.isCorrect };
      });
      setNodeAnswerMap(restoredAnswerMap);

      setAnswer('');
      setAnswerResult(null);
      setDialogNodeId(null);
      setFinished(false);
      setSubmitResult(null);
      buildMap(flatNodes, positions, statuses, remaining);
    },
    [buildMap]
  );

  const restoreCompletedAttempt = useCallback(
    (flatNodes, nodeAnswers, score = 0) => {
      const { root, nodeMap: nm } = buildTree(flatNodes);
      setNodeMap(nm);
      if (!root) return;

      const positions = calcPositions(root);
      const order = getDFSOrder(root);
      setDfsOrder(order);
      setTotalNodes(order.length);

      const statuses = {};
      flatNodes.forEach((node) => { statuses[node.id] = 'locked'; });

      const restoredAnswerMap = {};
      nodeAnswers.forEach((nodeAnswer) => {
        statuses[nodeAnswer.nodeId] = nodeAnswer.isCorrect ? 'correct' : 'incorrect';
        restoredAnswerMap[nodeAnswer.nodeId] = {
          answer: nodeAnswer.answer,
          isCorrect: nodeAnswer.isCorrect,
        };
      });

      scoreRef.current = score;
      setScoreDisplay(score);
      setNodeAnswerMap(restoredAnswerMap);
      setAnswer('');
      setAnswerResult(null);
      setDialogNodeId(null);
      setFinished(true);
      setSubmitResult(null);
      buildMap(flatNodes, positions, statuses, []);
    },
    [buildMap]
  );

  useEffect(() => {
    const init = async () => {
      try {
        const { data: examData } = await api.get(`/api/exams/${id}`);
        setExam(examData);
        if (isViewMode) {
          const { data: reviewData } = await api.get(`/api/attempts/review?examId=${id}`);
          attemptIdRef.current = reviewData.attemptId;
          restoreCompletedAttempt(examData.nodes, reviewData.nodeAnswers, reviewData.score || 0);
        } else {
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
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [id, initFresh, isViewMode, restoreCompletedAttempt, restoreProgress]);

  const applyNodeStatus = useCallback((nodeId, status) => {
    setNodeStatuses((prev) => ({ ...prev, [nodeId]: status }));
  }, []);

  const dialogNode = dialogNodeId ? nodeMap[dialogNodeId] : null;
  const dialogStatus = dialogNodeId ? nodeStatuses[dialogNodeId] : null;
  const isReviewMode = dialogStatus === 'correct' || dialogStatus === 'incorrect';
  const isAnswerMode = dialogStatus === 'current';
  const hasOptions = Array.isArray(dialogNode?.options) && dialogNode.options.length > 0;
  const reviewData = dialogNodeId ? nodeAnswerMap[dialogNodeId] : null;

  const submitAnswer = useCallback(
    async (ans) => {
      if (!dialogNode || !ans.trim() || !isAnswerMode || blockRef.current || answerPending) return;
      blockRef.current = true;
      setAnswerPending(true);

      const currentNodeId = dialogNodeId;

      setAnswer(ans.trim());
      // Optimistically update answer without isCorrect yet, or keep it simple.
      // We will wait for the server's truth.
      
      try {
        let isCorrectFromServer = false;
        if (attemptIdRef.current) {
          const res = await api.post('/api/attempts/answer', {
            attemptId: attemptIdRef.current,
            nodeId: currentNodeId,
            answer: ans.trim(),
          });
          isCorrectFromServer = res.data.isCorrect;
        } else {
          isCorrectFromServer = ans.trim().toUpperCase() === dialogNode.correctAnswer.trim().toUpperCase();
        }

        setNodeAnswerMap((prev) => ({
          ...prev,
          [currentNodeId]: { answer: ans.trim(), isCorrect: isCorrectFromServer },
        }));

        if (isCorrectFromServer) {
          scoreRef.current += dialogNode.points;
          setScoreDisplay(scoreRef.current);
        }
        applyNodeStatus(currentNodeId, isCorrectFromServer ? 'correct' : 'incorrect');
        setAnswerResult(isCorrectFromServer ? 'correct' : 'incorrect');
      } catch (error) {
        console.error(error);
        blockRef.current = false;
      } finally {
        setAnswerPending(false);
        blockRef.current = false;
      }
    },
    [dialogNode, dialogNodeId, isAnswerMode, applyNodeStatus, answerPending]
  );

  const handleAnswer = () => submitAnswer(answer);
  const handleSelectOption = (letter) => setAnswer(letter);

  const handleContinue = useCallback(() => {
    if (actionBusy || (blockRef.current && answerResult === null)) return;
    blockRef.current = false;

    const currentNodeId = dfsQueue[0];
    if (currentNodeId && answerResult !== null) {
      applyNodeStatus(currentNodeId, answerResult === 'correct' ? 'correct' : 'incorrect');
    }

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
    }
  }, [dfsQueue, answerResult, actionBusy, applyNodeStatus]);


  const completedCount = useMemo(
    () => Object.values(nodeStatuses).filter(s => s === 'correct' || s === 'incorrect').length,
    [nodeStatuses]
  );
  const allAnswered = totalNodes > 0 && completedCount === totalNodes;


  const currentQueueNodeId = dfsQueue[0] ?? null;
  const answeredCount = totalNodes - dfsQueue.length;
  const progress = totalNodes > 0 ? Math.round((completedCount / totalNodes) * 100) : 0;

  const onNodeClick = useCallback(
    (_evt, node) => {
      const nid = parseInt(node.id);
      const status = nodeStatuses[nid];
      if (status === 'locked') return;
      if (finished) {
        setDialogNodeId(nid);
        return;
      }

      if (nid !== currentQueueNodeId && answerResult !== null) {
        handleContinue();
      } else {
        setDialogNodeId(nid);
        if (status === 'current') {
          blockRef.current = false;
          setAnswer('');
          setAnswerResult(null);
        }
      }
    },
    [nodeStatuses, currentQueueNodeId, answerResult, handleContinue]
  );

  const closeDialog = () => setDialogNodeId(null);

  const completeAttempt = async () => {
    if (submitting) return;
    setSubmitting(true);
    setDialogNodeId(null); 
    try {
      if (attemptIdRef.current) {
        const { data } = await api.post('/api/attempts/complete', {
          attemptId: attemptIdRef.current,
        });
        setSubmitResult(data);
        if (data.attempt && data.attempt.score !== undefined) {
          setScoreDisplay(data.attempt.score);
          scoreRef.current = data.attempt.score;
        }
        setFinished(true);
        setResultDialogOpen(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (isViewMode) {
      navigate(`/student/exam/${id}`);
      return;
    }
    if (!exam) return;
    setResultDialogOpen(false); 
    setDialogNodeId(null);  
    setFinished(false);
    setSubmitResult(null);
    setNodeStatuses({});
    setResetting(true);
    try {
      const { data } = await api.post('/api/attempts/start', { examId: parseInt(id) });
      attemptIdRef.current = data.attemptId;
      initFresh(exam.nodes);
    } catch (err) {
      console.error('Reset error:', err);
      setFinished(false);
      setResultDialogOpen(false);
      setNodeStatuses({}); 
      setSubmitResult(null);
    } finally {
      setResetting(false);
    }
  };

  const handleGoToCurrent = useCallback(() => {
    if (!rfInstanceRef.current) return;
    // Tìm node đầu tiên có status 'current' (chỉ có 1 node current duy nhất)
    const currentId = Object.keys(nodeStatuses).find(
      (id) => nodeStatuses[id] === 'current'
    );
    if (!currentId) return;
    const node = rfNodes.find((n) => parseInt(n.id) === parseInt(currentId));
    if (node) {
      rfInstanceRef.current.setCenter(node.position.x + 90, node.position.y + 40, {
        zoom: 1.5,
        duration: 450,
      });
    }
  }, [nodeStatuses, rfNodes]);

  useEffect(() => {
    if (focusCurrentRequested && dialogNodeId === null) {
      handleGoToCurrent();
      setFocusCurrentRequested(false);
    }
  }, [focusCurrentRequested, dialogNodeId, handleGoToCurrent]);

  const handleResetLayout = useCallback(() => {
  if (!exam || !exam.nodes || exam.nodes.length === 0) return;
  const { root } = buildTree(exam.nodes);
  if (!root) return;
  const positions = calcPositions(root);
  setRfNodes((prevNodes) =>
    prevNodes.map((node) => {
      const pos = positions[parseInt(node.id)];
      return pos ? { ...node, position: pos } : node;
    })
  );
  // Sau khi cập nhật vị trí, fit view để nhìn toàn cảnh
  setTimeout(() => {
    rfInstance?.fitView({ padding: 0.3, duration: 400 });
  }, 0);
}, [exam, setRfNodes, rfInstance]);

  useEffect(() => {
    if (answerResult !== null && dfsQueue.length > 1) {
      const nextNodeId = dfsQueue[1];
      setNodeStatuses((prev) => ({ ...prev, [nextNodeId]: 'current' }));
    }
  }, [answerResult, dfsQueue]);

  useEffect(() => {
    if (answerResult !== null && isAnswerMode && dfsQueue.length > 1) {
      const nextNodeId = dfsQueue[1];
      const nextNode = rfNodes.find((n) => parseInt(n.id) === nextNodeId);
      if (rfInstanceRef.current && nextNode) {
        rfInstanceRef.current.setCenter(
          nextNode.position.x + 90,
          nextNode.position.y + 40,
          { zoom: 1.5, duration: 450 }
        );
      }
    }
  }, [answerResult, isAnswerMode, dfsQueue, rfNodes]);

  const handleCloseAndFocus = useCallback(() => {
    setFocusCurrentRequested(true);
    closeDialog();
  }, []);

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

      {/* Info bar – responsive */}
      <Paper
        elevation={1}
        square
        sx={{
          px: { xs: 1, sm: 3 },
          py: 1,
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 0.5, sm: 2 },
          flexWrap: 'wrap',
        }}
      >
        <IconButton size="small" onClick={() => navigate('/student')} sx={{ flexShrink: 0 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography
          variant="subtitle2"
          fontWeight="bold"
          noWrap
          sx={{ flex: 1, minWidth: 0, fontSize: { xs: '0.75rem', sm: '1rem' } }}
        >
          {exam?.lessonTitle || exam?.title}
        </Typography>
        <Chip
          label={`${scoreDisplay} điểm`}
          color="primary"
          variant="outlined"
          size="small"
          sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
        />
        <Chip
          label={`${completedCount}/${totalNodes}`}
          color="secondary"
          variant="outlined"
          size="small"
          sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
        />
         {allAnswered && !finished && (
          <Button
            size="small"
            variant="contained"
            color="success"
            onClick={() => completeAttempt()}
            disabled={actionBusy || finished}
            endIcon={actionBusy ? <CircularProgress size={16} /> : undefined}
            sx={{ textTransform: 'none' }}
          >
            Nộp bài
          </Button>
        )}
        {finished && (
        <Button
          size="small"
          variant="outlined"
          startIcon={<ReplayIcon />}
          onClick={handleReset}
          disabled={actionBusy}
          sx={{ textTransform: 'none', ml: 1 }}
        >
          Làm lại
        </Button>
      )}
      </Paper>

      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{ height: { xs: 4, sm: 5 } }}
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
          onInit={(instance) => {
            rfInstanceRef.current = instance;
            setRfInstance(instance);
          }}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          nodesDraggable={true}
          nodesConnectable={false}
          nodesFocusable={false}  
          elementsSelectable={false}
          panOnScroll
        >
          <Controls showInteractive={false} />
          <Background color="#e0e0e0" gap={20} />
        </ReactFlow>

        {(submitting || resetting) && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(255,255,255,0.85)',
              zIndex: 50,
              borderRadius: '4px',
            }}
          >
            <Box sx={{ textAlign: 'center' }}>
              <CircularProgress size={50} />
              <Typography sx={{ mt: 2 }} color="text.secondary">
                {resetting ? 'Đang tạo lại bài thi...' : 'Đang lưu kết quả...'}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Nút điều hướng góc phải dưới – responsive */}
        <Box
          sx={{
            position: 'absolute',
            bottom: { xs: 12, sm: 24 },
            right: { xs: 12, sm: 24 },
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: { xs: 0.5, sm: 1 },
            zIndex: 10,
          }}
        >

          <Tooltip title="Đặt lại vị trí mặc định" placement="left">
              <IconButton
                onClick={handleResetLayout}
                sx={{ bgcolor: 'white', boxShadow: 2, '&:hover': { bgcolor: '#f5f5f5' } }}
                size="small"
              >
                <ReplayIcon color="action" />
              </IconButton>
            </Tooltip>
          {!finished && currentQueueNodeId && (
            <Tooltip title="Đến câu gần nhất" placement="left">
              <IconButton
                onClick={handleGoToCurrent}
                sx={{ bgcolor: 'white', boxShadow: 2, '&:hover': { bgcolor: '#fff8e1' } }}
                size="small"
              >
                <CenterFocusStrongIcon color="warning" />
              </IconButton>
            </Tooltip>
          )}

        </Box>
      </Box>

      {/* Dialog câu hỏi – đã fullScreen trên mobile */}
      <Dialog
        open={Boolean(dialogNodeId)}
        onClose={handleCloseAndFocus}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        transitionDuration={{ enter: 150, exit: 100 }}
      >
        <DialogTitle sx={{ pb: 1, px: { xs: 1.5, sm: 3 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" sx={{ flex: 1, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
              {dialogNode?.label}
            </Typography>
            <Chip
              label={`${dialogNode?.points} điểm`}
              color={isReviewMode ? (reviewData?.isCorrect ? 'success' : 'error') : 'primary'}
              size="small"
              sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
            />
            {isAnswerMode && (
              <Chip
                label={`${answeredCount + 1}/${totalNodes}`}
                variant="outlined"
                size="small"
                sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
              />
            )}
            {isReviewMode && (
              <Chip
                label={reviewData?.isCorrect ? 'Đúng' : 'Sai'}
                color={reviewData?.isCorrect ? 'success' : 'error'}
                size="small"
                variant="outlined"
                sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
              />
            )}
          </Box>
        </DialogTitle>
        <DialogContent dividers sx={{ px: { xs: 1.5, sm: 3 }, py: 2 }}>
          <Typography variant="body1" component="div" sx={{ mb: 1, fontWeight: 500, fontSize: { xs: '0.9rem', sm: '1rem' } }}>
            <MathText component="div">{dialogNode?.question}</MathText>
          </Typography>
          <NodeImage src={dialogNode?.questionImage} alt="Ảnh câu hỏi" />

          {/* Chế độ trả lời – chưa có kết quả */}
          {isAnswerMode && answerResult === null &&
            (hasOptions ? (
              <OptionGrid
                options={dialogNode.options}
                optionImages={dialogNode.optionImages}
                chosenAnswer={answer}
                correctAnswer={null}
                onSelect={handleSelectOption}
                readOnly={false}
              />
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
                name={`essay-answer-${dialogNodeId ?? 'current'}`}
                autoComplete="off"
                data-1p-ignore="true"
                data-lpignore="true"
                inputProps={{
                  autoComplete: 'off',
                  spellCheck: false,
                  autoCorrect: 'off',
                  autoCapitalize: 'none',
                  'data-1p-ignore': 'true',
                  'data-lpignore': 'true',
                }}
              />
            ))}

          {/* Chế độ trả lời – đã có kết quả */}
          {isAnswerMode && answerResult !== null && (
            <>
              {answerResult === 'correct' ? (
                <Alert severity="success" icon={<CheckCircleIcon />}>
                  <strong>Chính xác!</strong> +{dialogNode?.points} điểm
                </Alert>
              ) : (
                <Box>
                  <Alert severity="error" sx={{ mb: 1 }}>
                    <strong>Chưa đúng!</strong> Bạn trả lời: <em><MathText>{answer}</MathText></em>
                    <br />
                    Đáp án đúng:{' '}
                    <strong>
                      <MathText>
                        {hasOptions
                          ? dialogNode.options.find((o) => o.startsWith(dialogNode.correctAnswer)) ||
                            dialogNode.correctAnswer
                          : dialogNode?.correctAnswer}
                      </MathText>
                    </strong>
                  </Alert>
                  <NodeImage src={dialogNode?.answerImage} alt="Ảnh đáp án" />
                  {dialogNode?.hint && (
                    <>
                      <Alert severity="info" icon={<LightbulbIcon />}>
                        <strong>Gợi ý:</strong> <MathText component="div">{dialogNode.hint}</MathText>
                      </Alert>
                      <NodeImage src={dialogNode?.hintImage} alt="Ảnh gợi ý" />
                    </>
                  )}
                </Box>
              )}
              {hasOptions && (
                <OptionGrid
                  options={dialogNode.options}
                  optionImages={dialogNode.optionImages}
                  correctAnswer={dialogNode.correctAnswer}
                  chosenAnswer={answer}
                  readOnly
                />
              )}
            </>
          )}

          {/* Chế độ xem lại */}
          {isReviewMode && (
            <Box>
              {hasOptions && (
                <OptionGrid
                  options={dialogNode.options}
                  optionImages={dialogNode.optionImages}
                  correctAnswer={dialogNode.correctAnswer}
                  chosenAnswer={reviewData?.answer}
                  readOnly
                />
              )}
              {reviewData?.isCorrect ? (
                <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 1.5, mt: 1.5 }}>
                  <strong>Bạn đã trả lời đúng!</strong> Câu trả lời: <em>{reviewData.answer}</em>
                </Alert>
              ) : (
                <>
                  <Alert severity="error" icon={<CancelIcon />} sx={{ mb: 1.5 }}>
                    <strong>Bạn đã trả lời sai.</strong> Câu trả lời của bạn: <em><MathText>{reviewData?.answer}</MathText></em>
                    <br />
                    Đáp án đúng:{' '}
                    <strong>
                      <MathText>
                        {hasOptions
                          ? dialogNode.options?.find((o) => o.startsWith(dialogNode.correctAnswer)) ||
                            dialogNode.correctAnswer
                          : dialogNode?.correctAnswer}
                      </MathText>
                    </strong>
                  </Alert>
                  <NodeImage src={dialogNode?.answerImage} alt="Ảnh đáp án" />
                </>
              )}
              {dialogNode?.hint && (
                <>
                  <Alert severity="info" icon={<LightbulbIcon />}>
                    <strong>Gợi ý:</strong> <MathText component="div">{dialogNode.hint}</MathText>
                  </Alert>
                  <NodeImage src={dialogNode?.hintImage} alt="Ảnh gợi ý" />
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 2, gap: 1, flexWrap: 'wrap' }}>
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
                sx={{ flex: 1, minWidth: 120 }}
                endIcon={actionBusy ? <CircularProgress size={20} /> : undefined}
              >
                {answerPending ? 'Đang xử lý' : 'Trả lời'}
              </Button>
            </>
          )}
          {isAnswerMode && answerResult !== null && (
            <>
              <Button variant="outlined" onClick={handleCloseAndFocus} disabled={actionBusy}>
                Xem sơ đồ
              </Button>
              {dfsQueue.length <= 1 ? (
                <Button
                  variant="contained"
                  color="success"
                  onClick={() => completeAttempt(scoreDisplay)}
                  size="large"
                  sx={{ flex: 1, minWidth: 120 }}
                  disabled={actionBusy}
                  endIcon={actionBusy ? <CircularProgress size={20} /> : undefined}
                >
                  Nộp bài
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={handleContinue}
                  size="large"
                  sx={{ flex: 1, minWidth: 120 }}
                  disabled={actionBusy}
                  endIcon={actionBusy ? <CircularProgress size={20} /> : undefined}
                >
                  Câu tiếp theo
                </Button>
              )}
            </>
          )}
          {isReviewMode && finished && (
            <Button variant="outlined" onClick={closeDialog} fullWidth disabled={actionBusy}>
              Đóng
            </Button>
          )}
          {isReviewMode && !finished && dialogNodeId === currentQueueNodeId && (
            <>
              <Button variant="outlined" onClick={handleCloseAndFocus} disabled={actionBusy}>
                Xem sơ đồ
              </Button>
              {dfsQueue.length <= 1 ? (
                <Button variant="contained" color="success" onClick={() => completeAttempt(scoreDisplay)} size="large" sx={{ flex: 1, minWidth: 120 }} disabled={actionBusy} endIcon={actionBusy ? <CircularProgress size={20} /> : undefined}>
                  Nộp bài
                </Button>
              ) : (
                <Button variant="contained" onClick={handleContinue} size="large" sx={{ flex: 1, minWidth: 120 }} disabled={actionBusy} endIcon={actionBusy ? <CircularProgress size={20} /> : undefined}>
                  Câu tiếp theo
                </Button>
              )}
            </>
          )}
          {isReviewMode && !finished && dialogNodeId !== currentQueueNodeId && (
            <Button variant="outlined" onClick={handleCloseAndFocus} fullWidth disabled={actionBusy}>
              Xem sơ đồ
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Dialog kết quả – responsive */}
      <Dialog open={resultDialogOpen} onClose={() => setResultDialogOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { position: 'relative' } }}>
        <DialogTitle sx={{ textAlign: 'center', pt: 3, fontSize: { xs: '1.2rem', sm: '1.5rem' }, position: 'relative' }}>
          <IconButton
            onClick={() => setResultDialogOpen(false)}
            sx={{ position: 'absolute', top: 8, right: 8 }}
          >
            <CloseIcon />
          </IconButton>
          <EmojiEventsIcon sx={{ fontSize: { xs: 48, sm: 56 }, color: '#f9a825' }} />
          <Typography variant="h5" fontWeight="bold" sx={{ mt: 1, fontSize: { xs: '1.1rem', sm: '1.5rem' } }}>
            Kết quả bài thi
          </Typography>
        </DialogTitle>
        <DialogContent>
          {submitting ? (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <CircularProgress />
              <Typography sx={{ mt: 2 }} color="text.secondary">
                Đang lưu kết quả...
              </Typography>
            </Box>
          ) : submitResult ? (
            <Box sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="h2" color="primary" fontWeight="bold" sx={{ fontSize: { xs: '2rem', sm: '3rem' } }}>
                {submitResult.attempt.score}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Điểm lần này
              </Typography>
              <Box sx={{ mt: 2, p: 2, bgcolor: '#f3e5f5', borderRadius: 2 }}>
                <Typography variant="h4" color="secondary" fontWeight="bold" sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}>
                  {submitResult.avgScore}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Điểm trung bình ({submitResult.attemptCount} lần làm)
                </Typography>
              </Box>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', gap: 2, pb: 3, flexDirection: { xs: 'column', sm: 'row' } }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/student')}
            disabled={submitting || resetting || !submitResult}
            fullWidth={isMobile}
          >
            Về trang chủ
          </Button>
          <Button
            variant="contained"
            startIcon={resetting ? undefined : <ReplayIcon />}
            endIcon={resetting ? <CircularProgress size={20} /> : undefined}
            onClick={handleReset}
            disabled={submitting || resetting || !submitResult}
            fullWidth={isMobile}
          >
            Làm lại từ đầu
          </Button>
        </DialogActions>
        {submitting && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(255,255,255,0.85)',
              zIndex: 10,
              borderRadius: '4px',
            }}
          >
            <Box sx={{ textAlign: 'center' }}>
              <CircularProgress size={50} />
              <Typography sx={{ mt: 2 }} color="text.secondary">
                Đang lưu kết quả...
              </Typography>
            </Box>
          </Box>
        )}
      </Dialog>
    </Box>
  );
}
