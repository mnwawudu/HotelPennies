// AddBlogModal — TinyMCE + safe patch around Flutterwave/Element.remove
import React, { useEffect, useState } from 'react';
import axios from '../utils/axiosConfig';
import { Editor } from '@tinymce/tinymce-react';
import '../components/EditBlogModal.css';

function useSafeDomForTiny() {
  useEffect(() => {
    // 1) Temporarily remove Flutterwave global/script (it overrides Element.remove badly)
    const fwScript = document.querySelector('script[src*="checkout.flutterwave.com"]');
    const fwHadGlobal = 'FlutterwaveCheckout' in window;
    if (fwScript) fwScript.remove();
    if (fwHadGlobal) {
      try { delete window.FlutterwaveCheckout; } catch {}
      window.FlutterwaveCheckout = undefined;
    }

    // 2) Patch Element.prototype.remove to be null-safe (FW’s polyfill throws)
    const proto = Element.prototype;
    const originalRemove = proto.remove;
    proto.remove = function () {
      if (this && this.parentNode) {
        this.parentNode.removeChild(this);
        return;
      }
      if (typeof originalRemove === 'function') {
        try { return originalRemove.apply(this, arguments); } catch {}
      }
    };

    return () => {
      // restore
      proto.remove = originalRemove;
      // do NOT re-inject Flutterwave here; it should be loaded only on checkout pages
    };
  }, []);
}

const AddBlogModal = ({ onClose, onAdd }) => {
  useSafeDomForTiny();

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    snippet: '',
    author: '',
    image: []
  });
  const [selectedFile, setSelectedFile] = useState(null);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
      const headers = { Authorization: `Bearer ${token}` };

      const imageUrls = [];
      if (selectedFile) {
        const fd = new FormData();
        fd.append('image', selectedFile);
        const uploadRes = await axios.post('/api/blogs/upload', fd, {
          headers: { ...headers, 'Content-Type': 'multipart/form-data' },
        });
        if (uploadRes.data?.url) imageUrls.push(uploadRes.data.url);
      }

      await axios.post('/api/blogs', { ...formData, image: imageUrls }, { headers });

      onAdd?.();
      onClose?.();
    } catch (err) {
      console.error('❌ Failed to create blog:', err);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="edit-blog-modal">
        <button className="close-btn" onClick={onClose}>×</button>
        <h3>Add Blog</h3>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Blog Title"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            required
          />

          <Editor
            apiKey="gjqj6xwr2m4ojs78p6aval77s56m215fa45ghex8nyir0ua4"
            value={formData.content}
            init={{
              height: 320,
              menubar: true,
              // removed 'paste' and 'imagetools' to avoid 404s
              plugins:
                'advlist autolink lists link image charmap preview anchor ' +
                'searchreplace visualblocks code fullscreen insertdatetime table help wordcount',
              toolbar:
                'undo redo | formatselect | bold italic underline | ' +
                'alignleft aligncenter alignright alignjustify | ' +
                'bullist numlist outdent indent | link image | code removeformat | help',
              // keep it safe around external scripts
              invalid_elements: 'script,iframe,style',
              verify_html: true,
              cleanup: true,
              content_style: 'img{max-width:100%;height:auto;}',
              automatic_uploads: true,
              images_upload_handler: async (blobInfo, success, failure) => {
                try {
                  const fd = new FormData();
                  fd.append('image', blobInfo.blob());
                  const token = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
                  const res = await axios.post('/api/blogs/upload', fd, {
                    headers: {
                      'Content-Type': 'multipart/form-data',
                      Authorization: `Bearer ${token}`,
                    },
                  });
                  success(res.data.url);
                } catch (err) {
                  console.error('Image insert upload error:', err);
                  failure('Image upload failed');
                }
              },
              file_picker_types: 'image',
              file_picker_callback: (cb, _value, meta) => {
                if (meta.filetype !== 'image') return;
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = async () => {
                  const file = input.files?.[0];
                  if (!file) return;
                  const fd = new FormData();
                  fd.append('image', file);
                  try {
                    const token = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
                    const res = await axios.post('/api/blogs/upload', fd, {
                      headers: {
                        'Content-Type': 'multipart/form-data',
                        Authorization: `Bearer ${token}`,
                      },
                    });
                    cb(res.data.url, { title: file.name });
                  } catch (err) {
                    console.error('Manual file picker upload error:', err);
                  }
                };
                input.click();
              },
            }}
            onEditorChange={(content) => handleChange('content', content)}
          />

          <input
            type="text"
            placeholder="Optional Snippet"
            value={formData.snippet}
            onChange={(e) => handleChange('snippet', e.target.value)}
          />

          <input
            type="text"
            placeholder="Author"
            value={formData.author}
            onChange={(e) => handleChange('author', e.target.value)}
          />

          <input type="file" accept="image/*" onChange={handleFileChange} />

          <button type="submit" className="navy-btn">Create Blog</button>
        </form>
      </div>
    </div>
  );
};

export default AddBlogModal;
