import { useState, useEffect } from 'react';
import { getDeployTargets, deployProject, getDeployHistory } from '../api';
import './DeployPanel.css';

export default function DeployPanel({ projectName, onClose }) {
  const [targets, setTargets] = useState([]);
  const [history, setHistory] = useState([]);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState({});
  const [activeTab, setActiveTab] = useState('deploy'); // 'deploy' | 'history'

  useEffect(() => {
    loadTargets();
    loadHistory();
  }, [projectName]);

  async function loadTargets() {
    try {
      const data = await getDeployTargets();
      if (data.success) setTargets(data.targets);
    } catch (err) {
      console.error('Failed to load targets:', err);
    }
  }

  async function loadHistory() {
    try {
      const data = await getDeployHistory(projectName);
      if (data.success) setHistory(data.deploys);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  }

  async function handleDeploy(targetName) {
    setDeploying(true);
    setDeployResult(null);
    setSelectedTarget(targetName);

    try {
      const result = await deployProject(projectName, targetName, options);
      setDeployResult(result);
      if (result.success) {
        loadHistory(); // Refresh history
      }
    } catch (err) {
      setDeployResult({ success: false, logs: [`Error: ${err.message}`] });
    } finally {
      setDeploying(false);
    }
  }

  function getTargetIcon(name) {
    switch (name) {
      case 'local': return '🖥️';
      case 'firebase': return '🔥';
      case 'sftp': return '📡';
      default: return '🚀';
    }
  }

  function getStatusBadge(configured) {
    return configured
      ? <span className="deploy-badge configured">Ready</span>
      : <span className="deploy-badge not-configured">Not Configured</span>;
  }

  return (
    <div className="deploy-panel-overlay" onClick={onClose}>
      <div className="deploy-panel" onClick={e => e.stopPropagation()}>
        <div className="deploy-header">
          <h3>🚀 Deploy: {projectName}</h3>
          <button className="deploy-close" onClick={onClose}>✕</button>
        </div>

        <div className="deploy-tabs">
          <button
            className={`deploy-tab ${activeTab === 'deploy' ? 'active' : ''}`}
            onClick={() => setActiveTab('deploy')}
          >
            Deploy
          </button>
          <button
            className={`deploy-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            History {history.length > 0 && `(${history.length})`}
          </button>
        </div>

        {activeTab === 'deploy' && (
          <div className="deploy-content">
            {/* Deploy Result */}
            {deployResult && (
              <div className={`deploy-result ${deployResult.success ? 'success' : 'error'}`}>
                <div className="deploy-result-header">
                  {deployResult.success ? '✅ Deployed Successfully!' : '❌ Deploy Failed'}
                </div>
                {deployResult.url && (
                  <a href={deployResult.url} target="_blank" rel="noopener noreferrer" className="deploy-url">
                    {deployResult.url} ↗
                  </a>
                )}
                {deployResult.logs && deployResult.logs.length > 0 && (
                  <details className="deploy-logs">
                    <summary>Logs ({deployResult.logs.length})</summary>
                    <pre>{deployResult.logs.join('\n')}</pre>
                  </details>
                )}
              </div>
            )}

            {/* Target List */}
            <div className="deploy-targets">
              {targets.map(target => (
                <div key={target.name} className="deploy-target">
                  <div className="deploy-target-info">
                    <span className="deploy-target-icon">{getTargetIcon(target.name)}</span>
                    <div>
                      <div className="deploy-target-name">{target.description}</div>
                      <div className="deploy-target-details">{target.details}</div>
                    </div>
                    {getStatusBadge(target.configured)}
                  </div>

                  {/* Target-specific options */}
                  {target.name === 'firebase' && target.configured && (
                    <div className="deploy-options">
                      <input
                        type="text"
                        placeholder="Firebase Project ID"
                        value={options.firebaseProjectId || ''}
                        onChange={e => setOptions({...options, firebaseProjectId: e.target.value})}
                        className="deploy-input"
                      />
                    </div>
                  )}

                  {target.name === 'sftp' && target.configured && (
                    <div className="deploy-options">
                      <input
                        type="text"
                        placeholder="Remote path (optional)"
                        value={options.deployPath || ''}
                        onChange={e => setOptions({...options, deployPath: e.target.value})}
                        className="deploy-input"
                      />
                    </div>
                  )}

                  <button
                    className="deploy-btn"
                    disabled={!target.configured || deploying}
                    onClick={() => handleDeploy(target.name)}
                  >
                    {deploying && selectedTarget === target.name
                      ? '⏳ Deploying...'
                      : `Deploy to ${target.name}`}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="deploy-history">
            {history.length === 0 ? (
              <div className="deploy-empty">No deployments yet</div>
            ) : (
              history.slice().reverse().map(deploy => (
                <div key={deploy.id} className={`deploy-history-item ${deploy.success ? 'success' : 'error'}`}>
                  <div className="deploy-history-header">
                    <span>{deploy.success ? '✅' : '❌'} {getTargetIcon(deploy.target)} {deploy.target}</span>
                    <span className="deploy-history-time">
                      {new Date(deploy.timestamp).toLocaleString()}
                    </span>
                  </div>
                  {deploy.url && (
                    <a href={deploy.url} target="_blank" rel="noopener noreferrer" className="deploy-url">
                      {deploy.url} ↗
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
