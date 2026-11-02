import { useEffect, useState } from 'react';
import { Alert, Box, Button } from '@mui/material';

interface Props {
  disabled?: boolean;
  onChange?: () => void;
  onChoosingChange?: (choosing: boolean) => void;
}

const OutputFolder = ({ disabled, onChange, onChoosingChange }: Props) => {
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

  const choose = async () => {
    setChoosing(true);
    onChoosingChange?.(true);
    try {
      const selected =
        await window.electron.ipcRenderer.chooseOutputDirectory();
      if (selected) {
        setDirectory(selected);
        setError('');
        onChange?.();
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setChoosing(false);
      onChoosingChange?.(false);
    }
  };

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
      <Button disabled={disabled || choosing || loading} onClick={choose}>
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
