// 📄 src/components/PasswordField.jsx
import React, { useState, useId } from 'react';

const EyeOpen = (props) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M12 5C6 5 2.3 9.2 1.1 11.1a1.5 1.5 0 0 0 0 1.8C2.3 14.8 6 19 12 19s9.7-4.2 10.9-6.1c.3-.5.3-1.3 0-1.8C21.7 9.2 18 5 12 5Zm0 11a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/>
  </svg>
);

const EyeOff = (props) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" {...props}>
    <path d="M3.3 2.3 2 3.6l3.6 3.6C3.5 9.5 2.2 11.2 1.1 12.1a1.5 1.5 0 0 0 0 1.8C2.3 15.8 6 20 12 20c2.1 0 4-.5 5.7-.1l3.3 3.3 1.3-1.3L3.3 2.3ZM12 18c-3.3 0-6-2.7-6-6 0-1 .2-1.9.7-2.8l2.1 2.1a3 3 0 0 0 3.9 3.9l2 2c-.9.5-1.8.8-2.7.8Zm9.8-4c.3-.5.3-1.3 0-1.8C20.6 9.3 16.9 6 12 6h-.3l2.5 2.5c1.1.6 1.8 1.8 1.8 3.1 0 .5-.1 1-.3 1.4l2.5 2.5c1.2-.7 2.2-1.6 3.1-2.5Z"/>
  </svg>
);

export default function PasswordField({
  name = 'password',
  value,
  onChange,
  placeholder = 'Password',
  autoComplete = 'current-password',
}) {
  const [show, setShow] = useState(false);
  const inputId = useId();

  return (
    <div className="hp-pass-wrap">
      <input
        id={inputId}
        type={show ? 'text' : 'password'}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="hp-pass-input"
        required
      />
      <button
        type="button"
        className="hp-pass-toggle"
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        onMouseDown={(e) => e.preventDefault()} // keep focus in the input
        onClick={() => setShow((s) => !s)}
        title={show ? 'Hide' : 'Show'}
      >
        {show ? <EyeOff /> : <EyeOpen />}
      </button>

      <style>{`
        .hp-pass-wrap {
          position: relative;
          width: 100%;
        }
        .hp-pass-input {
          width: 100%;
          box-sizing: border-box;
          padding: 10px 46px 10px 12px; /* room for the toggle */
          border: 1px solid #d6deeb;
          border-radius: 6px;
          background: #edf3ff;
          outline: none;
        }
        .hp-pass-input:focus {
          border-color: #0b4aa8;
          box-shadow: 0 0 0 3px rgba(11,74,168,0.12);
          background: #fff;
        }

        /* Reset ALL inherited button styles so it can't become full-width */
        .hp-pass-toggle {
          all: unset;
          box-sizing: content-box;
          position: absolute;
          z-index: 2;
          top: 50%;
          right: 10px;                 /* flush to edge */
          transform: translateY(-50%);
          width: 28px;
          height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #111;                 /* solid black */
          border-radius: 4px;
          background: transparent;
        }
        .hp-pass-toggle:hover { color: #000; }
        .hp-pass-toggle:focus-visible {
          outline: 2px solid #0b4aa8;
          outline-offset: 2px;
        }
        .hp-pass-toggle svg { display: block; }
      `}</style>
    </div>
  );
}
