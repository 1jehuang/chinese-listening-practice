import { h, render as preactRender } from 'preact';

function FactorBar({ factor }) {
  const pct = factor.max > 0 ? Math.min(100, Math.max(0, (Math.abs(factor.value) / factor.max) * 100)) : 0;
  return (
    <div style={{ margin: '3px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
        <span style={{ color: '#888' }}>{factor.label}</span>
        <span style={{ color: factor.color }}>{factor.value < 0 ? '−' : '+'}{Math.abs(factor.value).toFixed(2)}</span>
      </div>
      <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', margin: '1px 0' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: factor.color, borderRadius: '2px' }} />
      </div>
    </div>
  );
}

function EegDecisionView({ title, charLabel, statsLabel, totalScore, factors, fragile, eegSummary, runners, handSize }) {
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: '12px', color: '#9575cd', marginBottom: '6px' }}>{title}</div>
      <div style={{ fontSize: '18px', fontWeight: 600, margin: '4px 0' }}>{charLabel}</div>
      {statsLabel ? <div style={{ fontSize: '10px', color: '#777', marginBottom: '4px' }}>{statsLabel}</div> : null}
      <div style={{ fontSize: '14px', fontWeight: 700, color: '#e0e0e0', margin: '4px 0 8px' }}>
        {totalScore.toFixed(2)} <span style={{ fontSize: '10px', color: '#666', fontWeight: 400 }}>score</span>
      </div>
      {factors.map((factor) => <FactorBar key={factor.label} factor={factor} />)}
      {fragile ? <div style={{ fontSize: '9px', color: '#ffb74d', marginTop: '2px' }}>⚠ Fragile</div> : null}
      {eegSummary ? (
        <div style={{ marginTop: '8px', padding: '6px', background: 'rgba(149,117,205,0.08)', borderRadius: '5px', fontSize: '10px' }}>
          Focus <b style={{ color: '#4fc3f7' }}>{eegSummary.focus}%</b> · Calm <b style={{ color: '#9575cd' }}>{eegSummary.calm}%</b>
          {eegSummary.mlLabel ? <> · ML: <b>{eegSummary.mlLabel}</b></> : null}
          {!eegSummary.signalOk ? <div style={{ color: '#ef5350', marginTop: '2px' }}>⚠ Poor signal</div> : null}
        </div>
      ) : null}
      {runners.length ? (
        <div style={{ marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px' }}>
          <div style={{ fontSize: '9px', color: '#666', marginBottom: '4px' }}>Also considered ({handSize} in hand)</div>
          {runners.map((runner) => (
            <div key={runner.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', padding: '2px 0', color: '#888' }}>
              <span>{runner.label}</span>
              <span>{runner.score.toFixed(1)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function render(container, props) {
  if (!container) return;
  preactRender(<EegDecisionView {...props} />, container);
}

function unmount(container) {
  if (!container) return;
  preactRender(null, container);
}

window.JcodeEegDecisionUI = {
  render,
  unmount
};
