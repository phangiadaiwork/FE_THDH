import React, { useMemo } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Box, Typography } from '@mui/material';

export default function RichTextEditor({ label, value, onChange, placeholder }) {
  // Modules for ReactQuill
  const modules = useMemo(() => ({
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],        // toggled buttons
      [{ 'color': [] }, { 'background': [] }],          // dropdown with defaults from theme
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'script': 'sub'}, { 'script': 'super' }],      // superscript/subscript
      ['clean']                                         // remove formatting button
    ],
  }), []);

  const formats = [
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'list', 'bullet',
    'script'
  ];

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
