import React from 'react';
import './MetricCard.css';

const MetricCard = ({ title, value, icon, iconBg, change, period }) => {
  const isPositive = !change || change.startsWith('+');
  return (
    <div className="metric-card-new card">
      <div className="metric-top">
        <span className="metric-label">{title}</span>
        <div className={`metric-icon-box ${iconBg || ''}`} style={!iconBg ? {background: 'var(--primary-dim)', color: 'var(--primary)'} : {}}>
          {icon}
        </div>
      </div>
      <div className="metric-value">{value}</div>
      {(change || period) && (
        <div className="metric-footer">
          {change && (
            <span className={`metric-change ${isPositive ? 'positive' : 'negative'}`}>
              {change}
            </span>
          )}
          {period && <span className="metric-period">{period}</span>}
        </div>
      )}
    </div>
  );
};

export default MetricCard;
