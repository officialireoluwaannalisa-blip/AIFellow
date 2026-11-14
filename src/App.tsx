import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { EmptyState, ErrorState, ToastProvider } from './components/ui';
import { Overview } from './pages/Overview';
import { Risks } from './pages/Risks';
import { Planner } from './pages/Planner';
import { Funding } from './pages/Funding';
import { DataEvidence } from './pages/DataEvidence';
import { Methodology } from './pages/Methodology';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('UI error', error, info.componentStack); }
  render() { return this.state.error ? <ErrorState message={this.state.error} retry={() => window.location.reload()} /> : this.props.children; }
}
export function App() {
  return <ErrorBoundary><ToastProvider><Routes><Route element={<Layout />}>
    <Route index element={<Overview />} /><Route path="risks" element={<Risks />} /><Route path="planner" element={<Planner />} />
    <Route path="funding" element={<Funding />} /><Route path="data" element={<DataEvidence />} /><Route path="methodology" element={<Methodology />} />
    <Route path="*" element={<EmptyState title="Page not found" description="Use the workspace navigation to return to the demo." />} />
  </Route></Routes></ToastProvider></ErrorBoundary>;
}
