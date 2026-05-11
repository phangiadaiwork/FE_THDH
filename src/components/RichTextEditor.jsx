import React, { useMemo, useEffect, useRef } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Box, Typography } from '@mui/material';
import katex from 'katex';
import 'katex/dist/katex.min.css';

window.katex = katex;

export default function RichTextEditor({ label, value, onChange, placeholder }) {
  const quillRef = useRef(null);
  const modules = useMemo(() => ({
    formula: true,
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],        // toggled buttons
      [{ 'color': [] }, { 'background': [] }],          // dropdown with defaults from theme
      ['formula', 'image'],                             // add formula and image button
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'script': 'sub'}, { 'script': 'super' }],      // superscript/subscript
      ['clean']                                         // remove formatting button
    ],
  }), []);

  const formats = [
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'formula', 'image',
    'list', 'bullet',
    'script'
  ];

  // Auto-convert $...$ to formula blot
  useEffect(() => {
    if (!quillRef.current) return;
    const quill = quillRef.current.getEditor();
    
    const handleTextChange = (delta, oldDelta, source) => {
      if (source !== 'user') return;
      
      const selection = quill.getSelection();
      if (!selection) return;
      
      const cursorIndex = selection.index;
      const text = quill.getText(0, cursorIndex);
      
      // Match $...$ ending exactly at cursor
      const match = text.match(/(^|[^\\])\$([^$\n]+?)(?<!\\)\$$/);
      
      if (match) {
        const matchedString = match[0];
        const prefix = match[1];
        const mathContent = match[2];
        
        const startIdx = cursorIndex - matchedString.length + prefix.length;
        const lengthToDelete = matchedString.length - prefix.length;
        
        quill.deleteText(startIdx, lengthToDelete);
        quill.insertEmbed(startIdx, 'formula', mathContent);
        quill.insertText(startIdx + 1, ' ');
        quill.setSelection(startIdx + 2);
      }
    };
    
    quill.on('text-change', handleTextChange);
    return () => quill.off('text-change', handleTextChange);
  }, []);

  return (
    <Box sx={{ mb: 2 }}>
      {label && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
          {label}
        </Typography>
      )}
      <Box sx={{ 
        '& .quill': { 
          bgcolor: 'white', 
          borderRadius: 1, 
        },
        '& .ql-container': {
          borderBottomLeftRadius: 4,
          borderBottomRightRadius: 4,
          minHeight: '120px',
          fontSize: '1rem',
          fontFamily: 'inherit'
        },
        '& .ql-toolbar': {
          borderTopLeftRadius: 4,
          borderTopRightRadius: 4,
          bgcolor: '#fafafa'
        }
      }}>
        <ReactQuill 
          ref={quillRef}
          theme="snow"
          value={value || ''}
          onChange={onChange}
          modules={modules}
          formats={formats}
          placeholder={placeholder || 'Nhập nội dung...'}
        />
      </Box>
    </Box>
  );
}
