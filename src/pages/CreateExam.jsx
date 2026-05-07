import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactFlow, {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  CircularProgress,
  FormControlLabel,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import Navbar from '../components/Navbar';
import api from '../api';

const GRADE_OPTIONS = ['10', '11', '12'];

function EditorNode({ data, selected }) {
  return (
    <div
      style={{
        background: selected ? '#fff3dd' : '#fff',
        border: `2px solid ${selected ? '#8c5c22' : '#d4a256'}`,
        borderRadius: 14,
        padding: '10px 14px',
        minWidth: 150,
        maxWidth: 210,
        textAlign: 'center',
        boxShadow: selected ? '0 8px 24px rgba(140,92,34,0.25)' : '0 4px 16px rgba(0,0,0,0.08)',
      }}
    >
      <Handle type="target" position={Position.Top} />
      <Typography variant="body2" fontWeight={700}>
        {data.label || 'Node mới'}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block">
        {data.points} điểm
      </Typography>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes = { editorNode: EditorNode };

const EMPTY_FORM = {
  label: '',
  question: '',
  options: ['', '', '', ''],
  correctAnswer: '',
  hint: '',
  points: 1,
  isMultiChoice: false,
};

export default function CreateExam() {
  const navigate = useNavigate();
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [importing, setImporting] = useState(false);

  const [gradeLevel, setGradeLevel] = useState('12');
  const [chapterTitle, setChapterTitle] = useState('Chương VI');
  const [chapterCode, setChapterCode] = useState('chuong-vi');
  const [chapterDisplayOrder, setChapterDisplayOrder] = useState(6);
  const [lessonNumber, setLessonNumber] = useState(18);
  const [lessonTitle, setLessonTitle] = useState('');
  const [exerciseTitle, setExerciseTitle] = useState('Bài tập');
  const [theoryContent, setTheoryContent] = useState('');

  const fileInputRef = useRef(null);
  const idCounter = useRef(1);

  const selectedNode = rfNodes.find((node) => node.id === selectedId);

  const addRootNode = () => {
    const id = String(idCounter.current++);
    setRfNodes([
      {
        id,
        type: 'editorNode',
        position: { x: 340, y: 60 },
        data: { ...EMPTY_FORM, points: 1 },
      },
    ]);
    setRfEdges([]);
    setSelectedId(id);
    setForm(EMPTY_FORM);
  };

  const addChildNode = () => {
    if (!selectedId) return;
    const parent = rfNodes.find((node) => node.id === selectedId);
    if (!parent) return;

    const siblingCount = rfEdges.filter((edge) => edge.source === selectedId).length;
    const id = String(idCounter.current++);

    setRfNodes((prev) => [
      ...prev,
      {
        id,
        type: 'editorNode',
        position: {
          x: parent.position.x + (siblingCount - Math.floor(siblingCount / 2)) * 220,
          y: parent.position.y + 150,
        },
        data: { ...EMPTY_FORM, points: 1 },
      },
    ]);

    setRfEdges((prev) => [
      ...prev,
      {
        id: `e${selectedId}-${id}`,
        source: selectedId,
        target: id,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#d4a256' },
        style: { stroke: '#d4a256', strokeWidth: 2 },
      },
    ]);

    setSelectedId(id);
    setForm(EMPTY_FORM);
  };

  const deleteSelectedNode = () => {
    if (!selectedId) return;

    const descendants = new Set();
    const queue = [selectedId];
    while (queue.length > 0) {
      const currentId = queue.shift();
      descendants.add(currentId);
      rfEdges
        .filter((edge) => edge.source === currentId)
        .forEach((edge) => queue.push(edge.target));
    }

    setRfNodes((prev) => prev.filter((node) => !descendants.has(node.id)));
    setRfEdges((prev) => prev.filter((edge) => !descendants.has(edge.source) && !descendants.has(edge.target)));
    setSelectedId(null);
    setForm(EMPTY_FORM);
  };

  const updateForm = (field, value) => {
    const nextForm = { ...form, [field]: value };
    setForm(nextForm);
    setRfNodes((prev) =>
      prev.map((node) => (node.id === selectedId ? { ...node, data: { ...nextForm } } : node))
    );
  };

  const updateOption = (index, value) => {
    const options = [...form.options];
    options[index] = value;
    updateForm('options', options);
  };

  const saveExam = async () => {
    setSaveError('');

    if (!lessonTitle.trim()) {
      setSaveError('Cần nhập tên bài học.');
      return;
    }
    if (rfNodes.length === 0) {
      setSaveError('Cần ít nhất một node.');
      return;
    }

    const invalidNodes = rfNodes.filter((node) => !node.data.question || !node.data.correctAnswer);
    if (invalidNodes.length > 0) {
      setSaveError('Tất cả node cần có câu hỏi và đáp án đúng.');
      return;
    }

    const parentMap = {};
    rfEdges.forEach((edge) => {
      parentMap[edge.target] = edge.source;
    });
    const childMap = {};
    rfEdges.forEach((edge) => {
      if (!childMap[edge.source]) childMap[edge.source] = [];
      childMap[edge.source].push(edge.target);
    });

    const nodes = rfNodes.map((node) => {
      const parentTempId = parentMap[node.id] || null;
      const siblings = parentTempId ? childMap[parentTempId] || [] : [];
      const options = node.data.isMultiChoice
        ? node.data.options
            .filter((option) => option.trim())
            .map((option, index) => `${['A', 'B', 'C', 'D'][index]}. ${option}`)
        : null;

      return {
        tempId: node.id,
        parentTempId,
        label: node.data.label,
        question: node.data.question,
        options,
        correctAnswer: node.data.correctAnswer,
        hint: node.data.hint,
        points: Number(node.data.points) || 1,
        order: siblings.indexOf(node.id) >= 0 ? siblings.indexOf(node.id) : 0,
      };
    });

    setSaving(true);
    try {
      await api.post('/api/exams', {
        gradeLevel,
        chapterTitle,
        chapterCode,
        chapterDisplayOrder: Number(chapterDisplayOrder) || 0,
        lessonNumber: Number(lessonNumber) || null,
        lessonTitle: lessonTitle.trim(),
        exerciseTitle: exerciseTitle.trim() || 'Bài tập',
        theoryContent,
        title: lessonTitle.trim(),
        nodes,
      });
      navigate('/teacher');
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Không thể lưu bài học.');
    } finally {
      setSaving(false);
    }
  };

  const downloadTemplate = () => {
    const url = `${import.meta.env.VITE_API_BASE_URL || ''}/api/exams/template`;
    const token = localStorage.getItem('token');
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'mau_bai_tap.xlsx';
        a.click();
      })
      .catch(console.error);
  };

  const handleImportExcel = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !lessonTitle.trim()) {
      setSaveError('Cần nhập thông tin bài học trước khi import Excel.');
      return;
    }

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('gradeLevel', gradeLevel);
      formData.append('chapterTitle', chapterTitle);
      formData.append('chapterCode', chapterCode);
      formData.append('chapterDisplayOrder', String(chapterDisplayOrder));
      formData.append('lessonNumber', String(lessonNumber));
      formData.append('lessonTitle', lessonTitle);
      formData.append('exerciseTitle', exerciseTitle);
      formData.append('theoryContent', theoryContent);
      formData.append('title', lessonTitle);
      await api.post('/api/exams/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      navigate('/teacher');
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Import Excel thất bại.');
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f7f1e8' }}>
      <Navbar />

      <Paper elevation={0} square sx={{ px: 2, py: 1.5, borderBottom: '1px solid #eadcc5' }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} alignItems={{ lg: 'center' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton onClick={() => navigate('/teacher')}>
              <ArrowBackIcon />
            </IconButton>
            <AccountTreeIcon sx={{ color: '#8c5c22' }} />
            <Typography variant="h6" fontWeight={800} sx={{ color: '#5d3c15' }}>
              Tạo bài học dạng sơ đồ tư duy
            </Typography>
          </Stack>

          <Box sx={{ flex: 1 }} />

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={downloadTemplate}>
              Tải mẫu
            </Button>
            <Button variant="outlined" color="success" startIcon={<UploadFileIcon />} onClick={() => fileInputRef.current?.click()}>
              {importing ? 'Đang import' : 'Import Excel'}
            </Button>
            <Button variant="contained" startIcon={<SaveIcon />} onClick={saveExam} disabled={saving}>
              {saving ? <CircularProgress size={18} color="inherit" /> : 'Lưu bài học'}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" hidden onChange={handleImportExcel} />

      {saveError && (
        <Alert severity="error" sx={{ mx: 2, mt: 2 }}>
          {saveError}
        </Alert>
      )}

      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <Grid container sx={{ height: '100%' }}>
          <Grid item xs={12} lg={4} sx={{ height: '100%', overflowY: 'auto', borderRight: { lg: '1px solid #eadcc5' } }}>
            <Box sx={{ p: 2.5 }}>
              <Paper sx={{ p: 2.5, borderRadius: 4, mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#5d3c15', mb: 2 }}>
                  Thông tin bài học
                </Typography>

                <Grid container spacing={1.5}>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Khối</InputLabel>
                      <Select value={gradeLevel} label="Khối" onChange={(e) => setGradeLevel(e.target.value)}>
                        {GRADE_OPTIONS.map((item) => (
                          <MenuItem key={item} value={item}>
                            Lớp {item}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={8}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Tên chương"
                      value={chapterTitle}
                      onChange={(e) => setChapterTitle(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Mã chương"
                      value={chapterCode}
                      onChange={(e) => setChapterCode(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Thứ tự chương"
                      value={chapterDisplayOrder}
                      onChange={(e) => setChapterDisplayOrder(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      size="small"
                      type="number"
                      label="Số bài"
                      value={lessonNumber}
                      onChange={(e) => setLessonNumber(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={8}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Tên bài"
                      value={lessonTitle}
                      onChange={(e) => setLessonTitle(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Nhãn nút bài tập"
                      value={exerciseTitle}
                      onChange={(e) => setExerciseTitle(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      minRows={5}
                      label="Lý thuyết"
                      value={theoryContent}
                      onChange={(e) => setTheoryContent(e.target.value)}
                    />
                  </Grid>
                </Grid>
              </Paper>

              <Paper sx={{ p: 2.5, borderRadius: 4 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#5d3c15', flex: 1 }}>
                    Nội dung node
                  </Typography>
                  <Chip label={`${rfNodes.length} node`} size="small" />
                </Stack>

                <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
                  <Button variant="outlined" startIcon={<AddIcon />} disabled={rfNodes.length > 0} onClick={addRootNode}>
                    Thêm node gốc
                  </Button>
                  <Button variant="outlined" color="secondary" startIcon={<AddIcon />} disabled={!selectedId} onClick={addChildNode}>
                    Thêm node con
                  </Button>
                  <Tooltip title="Xóa node đang chọn và toàn bộ node con">
                    <span>
                      <IconButton color="error" onClick={deleteSelectedNode} disabled={!selectedId}>
                        <DeleteIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>

                {selectedNode ? (
                  <Stack spacing={1.5}>
                    <TextField fullWidth size="small" label="Tên node" value={form.label} onChange={(e) => updateForm('label', e.target.value)} />
                    <TextField fullWidth multiline minRows={3} size="small" label="Câu hỏi" value={form.question} onChange={(e) => updateForm('question', e.target.value)} />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={form.isMultiChoice}
                          onChange={(e) => updateForm('isMultiChoice', e.target.checked)}
                        />
                      }
                      label="Dạng trắc nghiệm A/B/C/D"
                    />

                    {form.isMultiChoice && (
                      <Stack spacing={1}>
                        {['A', 'B', 'C', 'D'].map((label, index) => (
                          <TextField
                            key={label}
                            fullWidth
                            size="small"
                            label={`Phương án ${label}`}
                            value={form.options[index]}
                            onChange={(e) => updateOption(index, e.target.value)}
                          />
                        ))}
                      </Stack>
                    )}

                    <TextField
                      fullWidth
                      size="small"
                      label={form.isMultiChoice ? 'Đáp án đúng (A/B/C/D)' : 'Đáp án đúng'}
                      value={form.correctAnswer}
                      onChange={(e) =>
                        updateForm(
                          'correctAnswer',
                          form.isMultiChoice
                            ? e.target.value.toUpperCase().replace(/[^ABCD]/g, '')
                            : e.target.value
                        )
                      }
                    />
                    <TextField fullWidth size="small" label="Gợi ý" value={form.hint} onChange={(e) => updateForm('hint', e.target.value)} />
                    <TextField fullWidth size="small" type="number" label="Điểm" value={form.points} onChange={(e) => updateForm('points', Math.max(1, Number(e.target.value) || 1))} />
                  </Stack>
                ) : (
                  <Typography color="text.secondary">
                    Chọn một node trên sơ đồ để chỉnh sửa nội dung.
                  </Typography>
                )}
              </Paper>
            </Box>
          </Grid>

          <Grid item xs={12} lg={8} sx={{ height: '100%' }}>
            <Box sx={{ height: '100%' }}>
              <ReactFlow
                nodes={rfNodes}
                edges={rfEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={(_, node) => {
                  setSelectedId(node.id);
                  setForm({
                    label: node.data.label || '',
                    question: node.data.question || '',
                    options: node.data.options || ['', '', '', ''],
                    correctAnswer: node.data.correctAnswer || '',
                    hint: node.data.hint || '',
                    points: node.data.points || 1,
                    isMultiChoice: node.data.isMultiChoice || false,
                  });
                }}
                onPaneClick={() => setSelectedId(null)}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.3 }}
              >
                <Controls />
                <Background color="#e5d6be" gap={20} />
              </ReactFlow>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
