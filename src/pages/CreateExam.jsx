import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  Divider,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  FormControlLabel,
  Switch,
  Stack,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import Navbar from '../components/Navbar';
import api from '../api';

// ─── Custom node cho editor ─────────────────────────────────────────────────
function EditorNode({ data, selected }) {
  return (
    <div
      style={{
        background: selected ? '#e3f2fd' : '#fff',
        border: `2px solid ${selected ? '#1565c0' : '#90caf9'}`,
        borderRadius: 10,
        padding: '10px 14px',
        minWidth: 130,
        maxWidth: 190,
        textAlign: 'center',
        boxShadow: selected ? '0 4px 12px rgba(21,101,192,0.35)' : '0 2px 6px rgba(0,0,0,0.1)',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      <Handle type="target" position={Position.Top} />
      <Typography variant="caption" fontWeight="bold" display="block">
        {data.label || '(chưa đặt tên)'}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block">
        {data.points} điểm
      </Typography>
      {data.isMultiChoice && (
        <Chip label="Trắc nghiệm" size="small" color="info" sx={{ mt: 0.3, height: 18, fontSize: 10 }} />
      )}
      {data.question ? (
        <Chip label="Có câu hỏi" size="small" color="success" sx={{ mt: 0.3, height: 18, fontSize: 10 }} />
      ) : (
        <Chip label="Chưa có câu hỏi" size="small" color="error" sx={{ mt: 0.3, height: 18, fontSize: 10 }} />
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes = { editorNode: EditorNode };

const EMPTY_FORM = { label: '', question: '', options: ['', '', '', ''], correctAnswer: '', hint: '', points: 1, isMultiChoice: false };

// ────────────────────────────────────────────────────────────────────────────
export default function CreateExam() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);
  const labelFieldRef = useRef(null);
  const idCounter = useRef(1);

  const selectedNode = rfNodes.find((n) => n.id === selectedId);

  // Auto-focus nhãn khi chọn / tạo node
  const focusLabel = useCallback(() => {
    setTimeout(() => labelFieldRef.current?.focus(), 30);
  }, []);

  // ── Thêm node gốc ───────────────────────────────────────────────────────
  const addRootNode = () => {
    const id = String(idCounter.current++);
    setRfNodes([{
      id,
      type: 'editorNode',
      position: { x: 300, y: 50 },
      data: { label: '', question: '', options: null, correctAnswer: '', hint: '', points: 1, isMultiChoice: false },
    }]);
    setRfEdges([]);
    setSelectedId(id);
    setForm({ ...EMPTY_FORM, label: '' });
    focusLabel();
  };

  // ── Thêm node con ────────────────────────────────────────────────────────
  const addChildNode = () => {
    if (!selectedId) return;
    const parent = rfNodes.find((n) => n.id === selectedId);
    if (!parent) return;

    const siblingCount = rfEdges.filter((e) => e.source === selectedId).length;
    const id = String(idCounter.current++);

    setRfNodes((prev) => [...prev, {
      id,
      type: 'editorNode',
      position: {
        x: parent.position.x + (siblingCount - Math.floor(siblingCount / 2)) * 220 - 90,
        y: parent.position.y + 140,
      },
      data: { label: '', question: '', options: null, correctAnswer: '', hint: '', points: 1, isMultiChoice: false },
    }]);
    setRfEdges((prev) => [...prev, {
      id: `e${selectedId}-${id}`,
      source: selectedId,
      target: id,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#90caf9' },
      style: { stroke: '#90caf9', strokeWidth: 2 },
    }]);
    setSelectedId(id);
    setForm({ ...EMPTY_FORM, label: '' });
    focusLabel();
  };

  // ── Xóa node được chọn ──────────────────────────────────────────────────
  const deleteSelectedNode = () => {
    if (!selectedId) return;
    const descendants = new Set();
    const queue = [selectedId];
    while (queue.length > 0) {
      const nid = queue.shift();
      descendants.add(nid);
      rfEdges.filter((e) => e.source === nid).forEach((e) => queue.push(e.target));
    }
    setRfNodes((prev) => prev.filter((n) => !descendants.has(n.id)));
    setRfEdges((prev) => prev.filter((e) => !descendants.has(e.source) && !descendants.has(e.target)));
    setSelectedId(null);
    setForm(EMPTY_FORM);
  };

  // ── Chọn node ────────────────────────────────────────────────────────────
  const onNodeClick = useCallback((_event, node) => {
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
    focusLabel();
  }, [focusLabel]);

  const onPaneClick = useCallback(() => { setSelectedId(null); }, []);

  // ── Cập nhật form → node data ────────────────────────────────────────────
  const updateForm = (field, value) => {
    const updated = { ...form, [field]: value };
    setForm(updated);
    if (selectedId) {
      setRfNodes((prev) =>
        prev.map((n) => n.id === selectedId ? { ...n, data: { ...updated } } : n)
      );
    }
  };

  const updateOption = (index, value) => {
    const opts = [...(form.options || ['', '', '', ''])];
    opts[index] = value;
    updateForm('options', opts);
  };

  // ── Tải template Excel bài tập ───────────────────────────────────────────
  const downloadTemplate = () => {
    const url = `${import.meta.env.VITE_API_BASE_URL || ''}/api/exams/template`;
    const token = localStorage.getItem('token');
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'mau_bai_tap.xlsx';
        a.click();
      })
      .catch(console.error);
  };

  // ── Import từ Excel ──────────────────────────────────────────────────────
  const handleImportExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !title.trim()) {
      alert('Vui lòng nhập tiêu đề bài tập trước khi import');
      return;
    }
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title.trim());
      await api.post('/api/exams/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      navigate('/teacher');
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Import thất bại');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  // ── Lưu bài tập ─────────────────────────────────────────────────────────
  const saveExam = async () => {
    setSaveError('');
    if (!title.trim()) { setSaveError('Vui lòng nhập tiêu đề bài tập'); return; }
    if (rfNodes.length === 0) { setSaveError('Cần ít nhất một node'); return; }

    const missing = rfNodes.filter((n) => !n.data.question || !n.data.correctAnswer);
    if (missing.length > 0) {
      setSaveError(`${missing.length} node chưa có câu hỏi / đáp án: ${missing.map((n) => n.data.label).join(', ')}`);
      return;
    }

    const parentMap = {};
    rfEdges.forEach((e) => { parentMap[e.target] = e.source; });
    const childOrderMap = {};
    rfEdges.forEach((e) => {
      if (!childOrderMap[e.source]) childOrderMap[e.source] = [];
      childOrderMap[e.source].push(e.target);
    });

    const apiNodes = rfNodes.map((n) => {
      const parentTempId = parentMap[n.id] || null;
      const siblings = parentTempId ? (childOrderMap[parentTempId] || []) : [];
      const order = siblings.indexOf(n.id);

      const opts = n.data.isMultiChoice
        ? n.data.options?.filter((o) => o.trim()).map((o, i) => `${['A', 'B', 'C', 'D'][i]}. ${o}`)
        : null;

      return {
        tempId: n.id,
        parentTempId,
        label: n.data.label || '',
        question: n.data.question || '',
        options: opts || null,
        correctAnswer: n.data.correctAnswer || '',
        hint: n.data.hint || '',
        points: parseInt(n.data.points) || 1,
        order: order >= 0 ? order : 0,
      };
    });

    setSaving(true);
    try {
      await api.post('/api/exams', { title: title.trim(), nodes: apiNodes });
      navigate('/teacher');
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Lưu bài tập thất bại');
    } finally {
      setSaving(false);
    }
  };

  const hasRoot = rfNodes.length > 0;
  const incomplete = rfNodes.some((n) => !n.data.question || !n.data.correctAnswer);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f5f7fa' }}>
      <Navbar />

      {/* Toolbar */}
      <Paper elevation={1} square sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <IconButton onClick={() => navigate('/teacher')} size="small">
          <ArrowBackIcon />
        </IconButton>
        <AccountTreeIcon color="primary" />
        <TextField
          label="Tiêu đề bài tập"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          size="small"
          sx={{ minWidth: 240 }}
          placeholder="Nhập tiêu đề..."
        />

        <Button variant="outlined" startIcon={<AddIcon />} onClick={addRootNode} disabled={hasRoot} size="small">
          Thêm node gốc
        </Button>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={addChildNode} disabled={!selectedId} size="small" color="secondary">
          Thêm node con
        </Button>
        <Tooltip title="Xóa node đang chọn (và tất cả con)">
          <span>
            <IconButton color="error" onClick={deleteSelectedNode} disabled={!selectedId} size="small">
              <DeleteIcon />
            </IconButton>
          </span>
        </Tooltip>

        <Divider orientation="vertical" flexItem />

        <Tooltip title="Tải file Excel mẫu">
          <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={downloadTemplate}>
            Tải mẫu
          </Button>
        </Tooltip>
        <Tooltip title="Import bài tập từ file Excel (cần nhập tiêu đề trước)">
          <Button
            variant="outlined"
            size="small"
            color="success"
            startIcon={importing ? <CircularProgress size={14} /> : <UploadFileIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={importing || !title.trim()}
          >
            Import Excel
          </Button>
        </Tooltip>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" hidden onChange={handleImportExcel} />

        <Box sx={{ flex: 1 }} />

        {incomplete && (
          <Chip
            label={`${rfNodes.filter((n) => !n.data.question || !n.data.correctAnswer).length} node chưa đủ`}
            color="warning"
            size="small"
          />
        )}
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={saveExam}
          disabled={saving || !hasRoot || !title.trim()}
          color="success"
        >
          {saving ? <CircularProgress size={18} /> : 'Lưu bài tập'}
        </Button>
      </Paper>

      {saveError && (
        <Alert severity="error" onClose={() => setSaveError('')} sx={{ mx: 2, mt: 1 }}>
          {saveError}
        </Alert>
      )}

      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        <Paper elevation={3} sx={{ width: 320, flexShrink: 0, overflowY: 'auto', p: 2, borderRadius: 0 }}>
          {selectedNode ? (
            <>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Chỉnh sửa node</Typography>
              <Divider sx={{ mb: 2 }} />
              <TextField
                fullWidth
                label="Tên node"
                value={form.label}
                onChange={(e) => updateForm('label', e.target.value)}
                size="small"
                sx={{ mb: 2 }}
                required
                placeholder="Nhập tên cho node..."
                inputRef={labelFieldRef}
              />
              <TextField fullWidth label="Câu hỏi *" value={form.question} onChange={(e) => updateForm('question', e.target.value)} size="small" multiline rows={3} sx={{ mb: 2 }} required />

              <FormControlLabel
                sx={{ mb: 1.5 }}
                control={
                  <Switch
                    checked={form.isMultiChoice}
                    onChange={(e) => updateForm('isMultiChoice', e.target.checked)}
                    size="small"
                  />
                }
                label={<Typography variant="caption">Trắc nghiệm (A/B/C/D)</Typography>}
              />

              {form.isMultiChoice ? (
                <Stack spacing={1} sx={{ mb: 2 }}>
                  {['A', 'B', 'C', 'D'].map((letter, i) => (
                    <TextField
                      key={letter}
                      fullWidth
                      label={`Phương án ${letter}`}
                      value={form.options?.[i] || ''}
                      onChange={(e) => updateOption(i, e.target.value)}
                      size="small"
                    />
                  ))}
                  <TextField
                    fullWidth
                    label="Đáp án đúng (A/B/C/D) *"
                    value={form.correctAnswer}
                    onChange={(e) => updateForm('correctAnswer', e.target.value.toUpperCase().replace(/[^ABCD]/g, ''))}
                    size="small"
                    inputProps={{ maxLength: 1 }}
                    helperText="Nhập một trong các ký tự: A, B, C, D"
                  />
                </Stack>
              ) : (
                <TextField
                  fullWidth
                  label="Đáp án đúng *"
                  value={form.correctAnswer}
                  onChange={(e) => updateForm('correctAnswer', e.target.value)}
                  size="small"
                  sx={{ mb: 2 }}
                  helperText="So sánh không phân biệt hoa thường"
                />
              )}

              <TextField fullWidth label="Gợi ý (hint)" value={form.hint} onChange={(e) => updateForm('hint', e.target.value)} size="small" multiline rows={2} sx={{ mb: 2 }} />
              <TextField
                fullWidth
                label="Điểm"
                type="number"
                value={form.points}
                onChange={(e) => updateForm('points', Math.max(1, parseInt(e.target.value) || 1))}
                size="small"
                inputProps={{ min: 1 }}
              />
            </>
          ) : (
            <Box sx={{ textAlign: 'center', mt: 6 }}>
              <AccountTreeIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
              <Typography color="text.secondary" sx={{ mt: 1 }} variant="body2">
                {hasRoot ? 'Click vào node để chỉnh sửa' : 'Nhấn "Thêm node gốc" để bắt đầu hoặc Import từ Excel'}
              </Typography>
            </Box>
          )}
        </Paper>

        {/* React Flow canvas */}
        <Box sx={{ flex: 1 }}>
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.3}
            maxZoom={2}
            deleteKeyCode={null}
          >
            <Controls />
            <Background color="#e0e0e0" gap={20} />
          </ReactFlow>
        </Box>
      </Box>
    </Box>
  );
}
