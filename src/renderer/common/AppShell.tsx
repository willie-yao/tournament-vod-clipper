import { ReactNode } from 'react';
import { Button } from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import { useNavigate } from 'react-router-dom';

interface Props {
  current: 'source' | 'batch' | 'output';
  locked?: boolean;
  children: ReactNode;
}

export default function AppShell({ current, locked = false, children }: Props) {
  const navigate = useNavigate();
  return (
    <div className="app-shell">
      <header className="appbar">
        <div className="brand">
          <TuneIcon />
          <span>Tournament VOD Clipper</span>
          <span className="brand-edition">Cutroom</span>
        </div>
        <nav aria-label="Workspace">
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
            Local output & YouTube
          </Button>
        </nav>
      </header>
      {children}
    </div>
  );
}

AppShell.defaultProps = { locked: false };
