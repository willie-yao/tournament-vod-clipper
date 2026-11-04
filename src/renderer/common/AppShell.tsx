import { ReactNode } from 'react';
import { Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

interface Props {
  current: 'source' | 'batch' | 'output';
  locked?: boolean;
  children: ReactNode;
}

export default function AppShell({ current, locked = false, children }: Props) {
  const navigate = useNavigate();
  return (
    <div
      className={
        current === 'source' ? 'app-shell source-splices' : 'app-shell'
      }
    >
      {current === 'source' && (
        <div className="source-backdrop" aria-hidden="true" />
      )}
      <header className="appbar nav-amber">
        <div className="brand">
          <svg
            className="cut-mark"
            viewBox="0 0 32 28"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M4 4h9L8 24H4zM17 4l12 10-17 10z" fill="currentColor" />
          </svg>
        </div>
        <span className="brand-product">Tournament VOD Clipper</span>
        <nav className="amber-nav" aria-label="Workspace">
          <Button
            aria-current={current === 'source' ? 'page' : undefined}
            disabled={locked}
            onClick={() => navigate('/')}
          >
            Source
          </Button>
          <Button
            aria-current={current === 'batch' ? 'page' : undefined}
            disabled={locked || current !== 'batch'}
          >
            Match review
          </Button>
          <Button
            aria-current={current === 'output' ? 'page' : undefined}
            disabled={locked}
            onClick={() => navigate('/YTUploadView')}
          >
            Output & YouTube
          </Button>
        </nav>
      </header>
      {children}
    </div>
  );
}

AppShell.defaultProps = { locked: false };
