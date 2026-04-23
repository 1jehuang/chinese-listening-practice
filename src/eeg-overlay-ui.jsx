import { h, Fragment, render as preactRender } from 'preact';
import { useState, useEffect } from 'preact/hooks';

function EegStatusBadge({ status, label, color }) {
  return (
    <span style={{ color }}>{label}</span>
  );
}

function EegOverlayView({ connected, connecting, zone, onToggle }) {
  if (!connected && !connecting) {
    return (
      <div
        id="eeg-toggle"
        style={{
          position: 'fixed', bottom: '12px', right: '12px', zIndex: 10000,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
          fontSize: '12px', background: 'rgba(30, 30, 30, 0.92)', color: '#e0e0e0',
          padding: '8px 12px', borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)',
          cursor: 'pointer', transition: 'all 200ms ease', userSelect: 'none'
        }}
        onClick={onToggle}
      >
        <span style={{ color: '#78909c' }}>EEG offline</span>
      </div>
    );
  }

  if (connecting) {
    return (
      <div
        id="eeg-toggle"
        style={{
          position: 'fixed', bottom: '12px', right: '12px', zIndex: 10000,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
          fontSize: '12px', background: 'rgba(30, 30, 30, 0.92)', color: '#e0e0e0',
          padding: '8px 12px', borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)',
          cursor: 'pointer', transition: 'all 200ms ease', userSelect: 'none'
        }}
        onClick={onToggle}
      >
        <span style={{ color: '#ffb74d' }}>EEG connecting...</span>
      </div>
    );
  }

  return (
    <div
      id="eeg-toggle"
      style={{
        position: 'fixed', bottom: '12px', right: '12px', zIndex: 10000,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        fontSize: '12px', background: 'rgba(30, 30, 30, 0.92)', color: '#e0e0e0',
        padding: '8px 12px', borderRadius: '10px',
        border: `1px solid ${zone ? zone.borderColor : 'rgba(255,255,255,0.15)'}`,
        backdropFilter: 'blur(8px)', cursor: 'pointer',
        transition: 'all 200ms ease', userSelect: 'none'
      }}
      onClick={onToggle}
    >
      <span style={{ color: zone ? zone.color : '#e0e0e0' }}>{zone ? zone.label : 'EEG online'}</span>
    </div>
  );
}

function EegPanelView({ entries, onClose }) {
  return (
    <div
      id="eeg-panel"
      style={{
        position: 'fixed', bottom: '12px', right: '12px', zIndex: 10000,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        fontSize: '12px', background: 'rgba(22, 22, 26, 0.95)', color: '#e0e0e0',
        padding: '14px 16px', borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)',
        width: '260px', maxHeight: '90vh', overflowY: 'auto', lineHeight: 1.5
      }}
    >
      <div
        style={{ position: 'absolute', top: '8px', right: '10px', cursor: 'pointer', color: '#78909c', fontSize: '14px' }}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      >
        ✕
      </div>
      {entries && entries.length > 0 ? (
        <div dangerouslySetInnerHTML={{ __html: entries.join('') }} />
      ) : (
        <div style={{ color: '#78909c' }}>No EEG data</div>
      )}
    </div>
  );
}

function BreakBannerView({ breakMinutes, onDismiss }) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10001]"
      onClick={onDismiss}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl p-8 max-w-md text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-4xl mb-4">🧠</div>
        <div className="text-xl font-bold text-gray-900 mb-2">Take a Break!</div>
        <div className="text-gray-600 mb-4">
          You've been studying for a while. Take a {breakMinutes || 5} minute break.
        </div>
        <button
          type="button"
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          onClick={onDismiss}
        >
          Continue Studying
        </button>
      </div>
    </div>
  );
}

function EegOverlayShell({ overlay, panel, breakBanner }) {
  return (
    <Fragment>
      {overlay ? <EegOverlayView {...overlay} /> : null}
      {panel ? <EegPanelView {...panel} /> : null}
      {breakBanner ? <BreakBannerView {...breakBanner} /> : null}
    </Fragment>
  );
}

function render(container, props) {
  if (!container) return;
  preactRender(<EegOverlayShell {...props} />, container);
}

function unmount(container) {
  if (!container) return;
  preactRender(null, container);
}

window.JcodeEegOverlayUI = {
  render,
  unmount
};
