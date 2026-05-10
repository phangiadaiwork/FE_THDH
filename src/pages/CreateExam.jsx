import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  Snackbar,
  Backdrop,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ImageIcon from '@mui/icons-material/Image';
import CloseIcon from '@mui/icons-material/Close';
import Navbar from '../components/Navbar';
import MathText from '../components/MathText';
import RichTextEditor from '../components/RichTextEditor';
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
      <Typography variant="body2" component="span" fontWeight={700}>
        <MathText>{data.label || 'Node mới'}</MathText>
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block">
        {data.points} điểm
      </Typography>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes = { editorNode: EditorNode };

function stripOptionPrefix(options) {
  if (!Array.isArray(options)) return ['', '', '', ''];
  const stripped = options.map((opt) => {
    if (typeof opt === 'string') return opt.replace(/^[A-D]\. ?/, '');
    return opt || '';
  });
  // Pad to 4 options
  while (stripped.length < 4) stripped.push('');
  return stripped;
}

const EMPTY_FORM = {
  label: '',
  question: '',
  questionImage: null,
  options: ['', '', '', ''],
  optionImages: [null, null, null, null],
  correctAnswer: '',
  answerImage: null,
  hint: '',
  hintImage: null,
  points: 1,
  isMultiChoice: false,
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

function ImageUploadField({ label, value, onChange, disabled }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const { data } = await api.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange(data.url);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRemove = async () => {
    if (value) {
      try {
        await api.delete('/api/upload', { data: { url: value } });
      } catch (_) { /* ignore */ }
      onChange(null);
    }
  };

  return (
    <Box sx={{ mt: 0.5, mb: 0.5 }}>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleUpload} disabled={disabled || uploading} />
      {value ? (
        <Box sx={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
          <Box
            component="img"
            src={`${API_BASE}${value}`}
            alt={label}
            sx={{ maxWidth: '100%', maxHeight: 160, borderRadius: 2, border: '1px solid #e0e0e0', objectFit: 'contain', display: 'block' }}
          />
          <IconButton
            size="small"
            onClick={handleRemove}
            sx={{ position: 'absolute', top: -8, right: -8, bgcolor: '#fff', boxShadow: 1, '&:hover': { bgcolor: '#fce4ec' } }}
          >
            <CloseIcon fontSize="small" color="error" />
          </IconButton>
        </Box>
      ) : (
        <Button
          size="small"
          variant="text"
          startIcon={uploading ? <CircularProgress size={14} /> : <ImageIcon />}
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          sx={{ textTransform: 'none', color: '#8c5c22', fontSize: '0.8rem' }}
        >
          {uploading ? 'Đang tải...' : `Thêm ảnh ${label}`}
        </Button>
      )}
    </Box>
  );
}

export default function CreateExam() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loadingData, setLoadingData] = useState(!!id);
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [importing, setImporting] = useState(false);
  const [showCanvasMobile, setShowCanvasMobile] = useState(false);

  const [gradeLevel, setGradeLevel] = useState('12');
  const [chapterTitle, setChapterTitle] = useState('Động học');
  const [chapterDisplayOrder, setChapterDisplayOrder] = useState(1);
  const [lessonNumber, setLessonNumber] = useState(1);
  const [lessonTitle, setLessonTitle] = useState('');
  const [exerciseTitle, setExerciseTitle] = useState('Bài tập');
  const [theoryContent, setTheoryContent] = useState('');

  const fileInputRef = useRef(null);
  const idCounter = useRef(1);

  const layoutAndSetNodes = useCallback((fetchedNodes) => {
    const edges = [];
    const childrenMap = {};
    
    fetchedNodes.forEach((n) => {
      const pId = n.parentId || n.parentTempId;
      const id = n.id || n.tempId;
      if (pId) {
        if (!childrenMap[pId]) childrenMap[pId] = [];
        childrenMap[pId].push(n);
        edges.push({
          id: `e${pId}-${id}`,
          source: String(pId),
          target: String(id),
          markerEnd: { type: MarkerType.ArrowClosed, color: '#d4a256' },
          style: { stroke: '#d4a256', strokeWidth: 2 },
        });
      }
    });

    const roots = fetchedNodes.filter((n) => !(n.parentId || n.parentTempId));
    const layoutedNodes = [];
    
    const traverse = (node, depth, xOffset) => {
      const id = String(node.id || node.tempId);
      layoutedNodes.push({
        id: id,
        type: 'editorNode',
        position: { x: xOffset, y: depth * 150 + 60 },
        data: {
          label: node.label,
          question: node.question,
          questionImage: node.questionImage || null,
          options: stripOptionPrefix(node.options),
          optionImages: node.optionImages || [null, null, null, null],
          correctAnswer: node.correctAnswer,
          answerImage: node.answerImage || null,
          hint: node.hint,
          hintImage: node.hintImage || null,
          points: node.points,
          isMultiChoice: Array.isArray(node.options) && node.options.length > 0,
        },
      });

      const children = childrenMap[id] || [];
      children.sort((a, b) => (a.order || 0) - (b.order || 0));
      const startX = xOffset - Math.max(0, children.length - 1) * 110;
      children.forEach((child, index) => {
        traverse(child, depth + 1, startX + index * 220);
      });
    };

    roots.forEach((root, idx) => traverse(root, 0, 340 + idx * 300));
    
    setRfNodes(layoutedNodes);
    setRfEdges(edges);
    
    let maxId = 0;
    fetchedNodes.forEach((n) => {
      const id = n.id || n.tempId;
      const parsed = parseInt(String(id).replace(/\D/g, ''), 10);
      if (!isNaN(parsed) && parsed > maxId) maxId = parsed;
    });
    idCounter.current = maxId + 1;
  }, [setRfNodes, setRfEdges]);

  useEffect(() => {
    if (!id) return;
    const fetchExam = async () => {
      try {
        const { data } = await api.get(`/api/exams/${id}`);
        setGradeLevel(data.gradeLevel || '12');

        let rawChapterTitle = data.chapterTitle || '';
        const chapMatch = rawChapterTitle.match(/^Chương\s+\d+:\s*(.*)/i);
        if (chapMatch) rawChapterTitle = chapMatch[1];
        setChapterTitle(rawChapterTitle);
        setChapterDisplayOrder(data.chapterDisplayOrder || 1);

        let rawLessonTitle = data.lessonTitle || '';
        const lessMatch = rawLessonTitle.match(/^Bài\s+\d+:\s*(.*)/i);
        if (lessMatch) rawLessonTitle = lessMatch[1];
        setLessonTitle(rawLessonTitle);
        setLessonNumber(data.lessonNumber || 1);

        setExerciseTitle(data.exerciseTitle || 'Bài tập');
        setTheoryContent(data.theoryContent || '');

        if (data.nodes && data.nodes.length > 0) {
          layoutAndSetNodes(data.nodes);
        }
      } catch (err) {
        setSaveError('Không thể tải dữ liệu bài học.');
      } finally {
        setLoadingData(false);
      }
    };
    fetchExam();
  }, [id, layoutAndSetNodes]);

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

      const optionImages = node.data.isMultiChoice
        ? node.data.optionImages?.slice(0, (options || []).length) || null
        : null;

      return {
        tempId: node.id,
        parentTempId,
        label: node.data.label,
        question: node.data.question,
        questionImage: node.data.questionImage || null,
        options,
        optionImages,
        correctAnswer: node.data.correctAnswer,
        answerImage: node.data.answerImage || null,
        hint: node.data.hint,
        hintImage: node.data.hintImage || null,
        points: Number(node.data.points) || 1,
        order: siblings.indexOf(node.id) >= 0 ? siblings.indexOf(node.id) : 0,
      };
    });

    setSaving(true);
    try {
      const payloadObj = {
        gradeLevel,
        chapterTitle: `Chương ${Number(chapterDisplayOrder) || 1}: ${chapterTitle.trim()}`,
        chapterDisplayOrder: Number(chapterDisplayOrder) || 1,
        lessonNumber: Number(lessonNumber) || 1,
        lessonTitle: `Bài ${Number(lessonNumber) || 1}: ${lessonTitle.trim()}`,
        exerciseTitle: exerciseTitle.trim() || 'Bài tập',
        theoryContent,
        title: `Bài ${Number(lessonNumber) || 1}: ${lessonTitle.trim()}`,
        nodes,
      };

      if (id) {
        await api.put(`/api/exams/${id}`, payloadObj);
      } else {
        await api.post('/api/exams', payloadObj);
      }
      setSuccessMessage('Lưu bài học thành công! Đang chuyển hướng...');
      setTimeout(() => navigate('/teacher'), 1500);
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Không thể lưu bài học.');
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
    if (!file) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data } = await api.post('/api/exams/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (data.nodes) {
        layoutAndSetNodes(data.nodes);
        setSuccessMessage('Parse file Excel thành công! Vui lòng kiểm tra sơ đồ và ấn "Lưu bài học".');
      }
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
              {id ? 'Sửa bài học' : 'Tạo bài học dạng sơ đồ tư duy'}
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
        <Alert severity="error" sx={{ mx: 2, mt: 2 }} onClose={() => setSaveError('')}>
          {saveError}
        </Alert>
      )}

      <Backdrop sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1, flexDirection: 'column', gap: 2 }} open={importing || saving}>
        <CircularProgress color="inherit" />
        <Typography variant="h6">{importing ? 'Đang xử lý file Excel...' : 'Đang lưu bài học...'}</Typography>
      </Backdrop>

      <Snackbar
        open={Boolean(successMessage)}
        autoHideDuration={2000}
        onClose={() => setSuccessMessage('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity="success" variant="filled" sx={{ width: '100%', borderRadius: 2 }}>
          {successMessage}
        </Alert>
      </Snackbar>

      <Box sx={{ flex: 1, overflow: { xs: 'auto', lg: 'hidden' }, opacity: (importing || saving) ? 0.6 : 1, transition: 'opacity 0.2s' }}>
        <Grid container sx={{ height: { xs: 'auto', lg: '100%' } }}>
          <Grid item xs={12} sx={{ order: { xs: 0, lg: -1 }, display: { xs: 'block', lg: 'none' }, p: 1.5, borderBottom: '1px solid #eadcc5' }}>
            <Button 
              fullWidth 
              variant="outlined" 
              color="primary" 
              onClick={() => setShowCanvasMobile(!showCanvasMobile)}
              startIcon={<AccountTreeIcon />}
              sx={{ bgcolor: '#fff', '&:hover': { bgcolor: '#fff0d9' } }}
            >
              {showCanvasMobile ? 'Ẩn sơ đồ tư duy' : 'Mở sơ đồ tư duy (Kéo thả)'}
            </Button>
          </Grid>
          <Grid item xs={12} lg={4} sx={{ order: { xs: 2, lg: 1 }, height: { xs: 'auto', lg: '100%' }, overflowY: { xs: 'visible', lg: 'auto' }, borderRight: { lg: '1px solid #eadcc5' } }}>
            <Box sx={{ p: { xs: 1.5, lg: 2.5 } }}>
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
                      label="Tiêu đề chương"
                      placeholder="VD: Động học chất điểm"
                      value={chapterTitle}
                      onChange={(e) => setChapterTitle(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
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
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Tiêu đề bài"
                      placeholder="VD: Chuyển động thẳng đều"
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
                    <RichTextEditor
                      label="Lý thuyết"
                      value={theoryContent}
                      onChange={(val) => setTheoryContent(val)}
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
                    <Typography variant="caption" color="text.secondary" sx={{ bgcolor: '#f5f0e6', px: 1.5, py: 0.7, borderRadius: 1, fontSize: '0.72rem' }}>
                      Hỗ trợ Toán: dùng <strong>$...$</strong> (inline), <strong>$$...$$</strong> (block). Gõ <strong>\$</strong> để hiện dấu đô-la thường. VD: <code>$x^2 + y^2$</code>, <code>Giá 5\$</code>
                    </Typography>
                    <Box>
                      <TextField fullWidth size="small" label="Tên node" value={form.label} onChange={(e) => updateForm('label', e.target.value)} />
                    </Box>
                    <Box>
                      <RichTextEditor 
                        label="Câu hỏi" 
                        value={form.question} 
                        onChange={(val) => updateForm('question', val)} 
                      />
                    </Box>
                    <ImageUploadField label="câu hỏi" value={form.questionImage} onChange={(url) => updateForm('questionImage', url)} disabled={saving} />
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
                          <Box key={label}>
                            <Box>
                              <TextField
                                fullWidth
                                size="small"
                                label={`Phương án ${label}`}
                                value={form.options[index]}
                                onChange={(e) => updateOption(index, e.target.value)}
                              />
                            </Box>
                            <ImageUploadField
                              label={`phương án ${label}`}
                              value={form.optionImages?.[index] || null}
                              onChange={(url) => {
                                const imgs = [...(form.optionImages || [null, null, null, null])];
                                imgs[index] = url;
                                updateForm('optionImages', imgs);
                              }}
                              disabled={saving}
                            />
                          </Box>
                        ))}
                      </Stack>
                    )}

                    <Box>
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
                    </Box>
                    <ImageUploadField label="đáp án" value={form.answerImage} onChange={(url) => updateForm('answerImage', url)} disabled={saving} />
                    <Box>
                      <RichTextEditor 
                        label="Gợi ý" 
                        value={form.hint} 
                        onChange={(val) => updateForm('hint', val)} 
                      />
                    </Box>
                    <ImageUploadField label="gợi ý" value={form.hintImage} onChange={(url) => updateForm('hintImage', url)} disabled={saving} />
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

          <Grid item xs={12} lg={8} sx={{ display: { xs: showCanvasMobile ? 'block' : 'none', lg: 'block' }, order: { xs: 1, lg: 2 }, height: { xs: '450px', md: '600px', lg: '100%' }, borderBottom: { xs: '2px solid #eadcc5', lg: 'none' } }}>
            <Box sx={{ height: '100%', width: '100%' }}>
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
                    questionImage: node.data.questionImage || null,
                    options: stripOptionPrefix(node.data.options),
                    optionImages: node.data.optionImages || [null, null, null, null],
                    correctAnswer: node.data.correctAnswer || '',
                    answerImage: node.data.answerImage || null,
                    hint: node.data.hint || '',
                    hintImage: node.data.hintImage || null,
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
