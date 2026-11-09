import { AnimationEvent, useEffect, useId, useState } from 'react';
import { Alert } from '@mui/material';
import { useOutputDirectory } from '../common/OutputFolder';

const HINT =
  'Choose an existing downloadedVODs folder to use earlier clips. Files are not moved.';

/** Path segments for display: home shown as ~, long paths collapsed. */
export function pathSegments(directory: string) {
  const parts = directory.split(/[\\/]/).filter(Boolean);
  let home = 0;
  if (['Users', 'home'].includes(parts[0])) home = 2;
  else if (/^[a-z]:$/i.test(parts[0] ?? '') && /^users$/i.test(parts[1] ?? ''))
    home = 3;
  const rest =
    home && parts.length > home ? ['~', ...parts.slice(home)] : parts;
  const leaf = rest.pop() ?? '';
  let parents = rest.length > 3 ? [rest[0], '…', ...rest.slice(-2)] : rest;
  // A long folder name keeps only its direct parent for context.
  if (leaf.length > 28 && rest.length > 1)
    parents = ['…', rest[rest.length - 1]];
  return { parents, leaf };
}

interface LineProps {
  directory: string;
  cut?: boolean;
  /** Earlier path whose matching segments are not marked as changed. */
  from?: string;
}

const PathLine = ({ directory, cut, from }: LineProps) => {
  const { parents, leaf } = pathSegments(directory);
  const before = from === undefined ? null : pathSegments(from).parents;
  return (
    <span
      className={`output-path-line${cut ? ' is-cut' : ''}`}
      aria-hidden={cut || undefined}
    >
      {parents.map((part, index) => (
        <span
          className={`output-crumb${
            before && before[index] !== part ? ' is-new' : ''
          }`}
          // Segments can repeat, so position is part of the key.
          // eslint-disable-next-line react/no-array-index-key
          key={`${index}-${part}`}
        >
          <span className="output-crumb-name">{part}</span>
        </span>
      ))}
      <span className="output-leaf">{leaf}</span>
    </span>
  );
};

PathLine.defaultProps = { cut: false, from: undefined };

interface Props {
  disabled?: boolean;
  onChoosingChange?: (choosing: boolean) => void;
  /** Called with a short folder state for headings: Writable or Not writable. */
  onStatusChange?: (status: string) => void;
}

/** Output folder as one clickable path that splices in a newly chosen folder. */
const OutputStrip = ({ disabled, onChoosingChange, onStatusChange }: Props) => {
  const { directory, error, choosing, loading, choose } = useOutputDirectory({
    onChoosingChange,
  });
  let status = '';
  if (!loading) status = error ? 'Not writable' : 'Writable';
  useEffect(() => onStatusChange?.(status), [status, onStatusChange]);
  const [splice, setSplice] = useState<{ from: string; id: number } | null>(
    null
  );
  const hintId = useId();
  const { leaf } = pathSegments(directory);

  const change = async () => {
    const before = directory;
    const selected = await choose();
    if (selected && before && selected !== before)
      setSplice({ from: before, id: Date.now() });
  };
  const spliced = (event: AnimationEvent<HTMLSpanElement>) => {
    if (event.target === event.currentTarget) setSplice(null);
  };

  return (
    <div className="output-strip">
      <button
        type="button"
        className="output-strip-target"
        disabled={disabled || choosing || loading}
        onClick={change}
        title={directory ? `${directory}\n${HINT}` : HINT}
        aria-label={`Change output folder${leaf ? `, currently ${leaf}` : ''}`}
        aria-describedby={hintId}
        aria-busy={choosing || loading}
      >
        <span
          className="output-strip-path"
          key={splice?.id}
          data-splice={splice ? '' : undefined}
          onAnimationEnd={spliced}
        >
          {splice && <PathLine directory={splice.from} cut />}
          {directory ? (
            <PathLine directory={directory} from={splice?.from} />
          ) : (
            <span className="output-path-line is-pending">
              Locating output folder...
            </span>
          )}
          {splice && <span className="output-strip-cut" aria-hidden="true" />}
        </span>
        <span className="output-strip-action">
          {choosing ? 'Choosing...' : 'Change'}
        </span>
      </button>
      <span id={hintId} className="sr-only">
        {directory ? `${directory}. ${HINT}` : HINT}
      </span>
      {error && <Alert severity="error">{error}</Alert>}
    </div>
  );
};

OutputStrip.defaultProps = {
  disabled: false,
  onChoosingChange: undefined,
  onStatusChange: undefined,
};

export default OutputStrip;
