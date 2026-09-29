import { Component, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
class AppBoundary extends Component<{children: ReactNode}, {failed:boolean}> {
  state = { failed:false };
  static getDerivedStateFromError() { return {failed:true}; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Swarm Pepe interface error', error.message, info.componentStack); }
  render() {
    if (this.state.failed) return <main className="fatal-error"><h1>Swarm / Pepe</h1><p>The interface could not load. Reload to try again.</p><button onClick={() => location.reload()}>Reload site</button><p><a href="https://etherscan.io/address/0x999ce0ce8c5f7661e0c74a568ffe27ceb9177bdb#code">View the verified contract ↗</a></p></main>;
    return this.props.children;
  }
}
createRoot(document.getElementById('root')!).render(<AppBoundary><App /></AppBoundary>);
