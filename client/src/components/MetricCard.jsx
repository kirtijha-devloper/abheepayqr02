import React from 'react';
import { useNavigate } from 'react-router-dom';
import './MetricCard.css';

const MetricCard = ({ title, value, icon, iconBg, change, period, to, onClick }) => {
  const navigate = useNavigate();
  const isPositive = !change || change.startsWith('+');
  const isInteractive = Boolean(to || onClick);

  const handleActivate = () => {
    if (onClick) {
      onClick();
      return;
    }
    if (to) {
      navigate(to);
    }
  };

  return (
    <div
      className={`metric-card-new card ${isInteractive ? 'metric-card-link' : ''}`}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={isInteractive ? handleActivate : undefined}
      onKeyDown={isInteractive ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleActivate();
        }
      } : undefined}
    >
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
