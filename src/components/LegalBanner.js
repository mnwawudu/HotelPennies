// components/LegalBanner.js
import React from 'react';

export default function LegalBanner() {
  const openAgreement = () => {
    window.open('/api/vendor-agreement/file', '_blank', 'noopener,noreferrer');
  };

  return (
    <div style={{
      background:'#FFF7ED', border:'1px solid #FED7AA',
      padding:12, borderRadius:8, margin:'12px 0', fontSize:14
    }}>
      By <b>publishing a listing</b> on HotelPennies, you agree to the{' '}
      <button onClick={openAgreement} style={{border:'none', background:'transparent', textDecoration:'underline', cursor:'pointer', padding:0}}>
        Vendor Agreement
      </button>.
    </div>
  );
}
