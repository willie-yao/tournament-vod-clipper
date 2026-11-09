import { useEffect, useState } from 'react';
import { Alert, Box, Button } from '@mui/material';
import { forgetHeldDownloads } from './heldBatch';

interface Props {
  disabled?: boolean;
  onChange?: () => void;
  onChoosingChange?: (choosing: boolean) => void;
}

interface Options {
  onChange?: () => void;
  onChoosingChange?: (choosing: boolean) => void;
}

/** Load the output root and choose a new one through the native picker. */
export function useOutputDirectory({ onChange, onChoosingChange }: Options) {
  const [directory, setDirectory] = useState('');
  const [error, setError] = useState('');
  const [choosing, setChoosing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setDirectory(await window.electron.ipcRenderer.getOutputDirectory());
        await window.electron.ipcRenderer.createFolder();
      } catch {
        setError(
          'Cannot write to the output folder. Choose a writable folder; existing files will not be moved.'
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  /** Resolves to the chosen folder, or null when nothing changed. */
  const choose = async () => {
    setChoosing(true);
    onChoosingChange?.(true);
    try {
      const selected =
        await window.electron.ipcRenderer.chooseOutputDirectory();
      if (selected) {
        setDirectory(selected);
        setError('');
        forgetHeldDownloads();
        onChange?.();
      }
      return selected;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      return null;
    } finally {
      setChoosing(false);
      onChoosingChange?.(false);
    }
  };

  return { directory, error, choosing, loading, choose };
}

const OutputFolder = ({ disabled, onChange, onChoosingChange }: Props) => {
  const { directory, error, choosing, loading, choose } = useOutputDirectory({
    onChange,
    onChoosingChange,
  });

  return (
    <Box className="output-folder">
      <details className="output-location">
        <summary>
          <span className="help">Output folder</span>
          <strong title={directory}>
            {directory.split(/[\\/]/).filter(Boolean).pop() ||
              directory ||
              'Loading...'}
          </strong>
        </summary>
        <div className="output-path">
          <code>{directory || 'Loading...'}</code>
          <p className="help">
            Choose an existing downloadedVODs folder to use earlier clips. Files
            are not moved.
          </p>
        </div>
      </details>
      <Button
        disabled={disabled || choosing || loading}
        onClick={() => {
          choose();
        }}
      >
        Choose Output Folder
      </Button>
      {error && <Alert severity="error">{error}</Alert>}
    </Box>
  );
};

OutputFolder.defaultProps = {
  disabled: false,
  onChange: undefined,
  onChoosingChange: undefined,
};
export default OutputFolder;
