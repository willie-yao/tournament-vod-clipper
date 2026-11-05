import { useId, useState } from 'react';
import { Menu, MenuItem } from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { VODMetadata } from '../common/tournamentSets';

interface Props {
  sets: VODMetadata[];
  currentId: string;
  disabled: boolean;
  onSelect: (id: string) => void;
}

/** The pager's counter, which opens the whole batch for jumping between clips. */
export default function QueueMenu({
  sets,
  currentId,
  disabled,
  onSelect,
}: Props) {
  const menuId = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const index = sets.findIndex((set) => set.id === currentId);
  const close = () => setAnchor(null);
  return (
    <>
      <button
        type="button"
        className="review-count mono"
        aria-label={`Batch queue, clip ${index + 1} of ${sets.length}`}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        aria-controls={anchor ? menuId : undefined}
        disabled={disabled}
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        <span>
          <b>{index + 1}</b> / {sets.length}
        </span>
        <ArrowDropDownIcon aria-hidden="true" />
      </button>
      <Menu
        id={menuId}
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ className: 'queue-menu' }}
      >
        {sets.map((set) => (
          <MenuItem
            key={set.id}
            selected={set.id === currentId}
            onClick={() => {
              close();
              onSelect(set.id);
            }}
          >
            <span
              className="queue-dot"
              data-included={set.download || undefined}
              aria-hidden="true"
            />
            <span className="queue-name">
              {set.player1} vs {set.player2}
              <span className="sr-only">
                {set.download ? ', included' : ', not included'}
              </span>
            </span>
            <span className="queue-round">{set.roundText}</span>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
