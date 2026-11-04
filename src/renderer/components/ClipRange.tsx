import { KeyboardEvent, PointerEvent, useEffect, useId, useRef } from 'react';
import {
  formatClipTime,
  getClipRangeError,
  parseClipTime,
} from '../../common/clipTime';
import { ClipDraft } from '../common/clipDraft';
import { VODMetadata } from '../common/tournamentSets';

type Boundary = 'start' | 'end';

interface Props {
  saved: Pick<VODMetadata, 'startTime' | 'endTime'>;
  draft: ClipDraft;
  onChange: (draft: ClipDraft) => void;
  disabled: boolean;
  duration?: number;
}

interface Drag {
  pointerId: number;
  boundary: Boundary;
  lower: number;
  upper: number;
  element: HTMLDivElement;
  clientX: number;
  initialX: number;
  initialValue: number;
  moved: boolean;
}

export default function ClipRange({
  saved,
  draft,
  onChange,
  disabled,
  duration,
}: Props) {
  const id = useId();
  const rail = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag>();
  const frame = useRef<number>();
  const latest = useRef({ draft, onChange, disabled });
  latest.current = { draft, onChange, disabled };
  const start = parseClipTime(draft.start);
  const end = parseClipTime(draft.end);
  const limit = duration && duration > 0 ? Math.floor(duration) : undefined;
  const values = [saved.startTime, saved.endTime, start, end].filter(
    (value): value is number =>
      value !== null &&
      Number.isFinite(value) &&
      value >= 0 &&
      (limit === undefined || value <= limit)
  );
  // Keep the drag's scale fixed while its draft values change.
  const lower =
    drag.current?.lower ??
    Math.max(0, Math.min(...(values.length ? values : [0])) - 60);
  const upper =
    drag.current?.upper ??
    Math.min(
      limit ?? Infinity,
      Math.max(...(values.length ? values : [0])) + 60
    );
  const extent = Math.max(1, upper - lower);
  const position = (value: number | null) =>
    Math.max(0, Math.min(100, (((value ?? lower) - lower) / extent) * 100));
  const error =
    getClipRangeError(start, end) ||
    (limit !== undefined && end !== null && end > limit
      ? 'Out is beyond the VOD duration.'
      : null);

  const cancelFrame = () => {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    frame.current = undefined;
  };
  useEffect(
    () => () => {
      cancelFrame();
      drag.current = undefined;
    },
    []
  );
  useEffect(() => {
    if (disabled) {
      cancelFrame();
      drag.current = undefined;
    }
  }, [disabled]);

  const update = (boundary: Boundary, value: number) => {
    if (latest.current.disabled) return;
    latest.current.onChange({
      ...latest.current.draft,
      [boundary]: formatClipTime(
        Math.round(Math.max(0, Math.min(limit ?? Infinity, value)))
      ),
    });
  };
  const publishPointer = () => {
    frame.current = undefined;
    const active = drag.current;
    if (!active?.moved) return;
    const bounds = active.element.getBoundingClientRect();
    if (!bounds.width) return;
    const change =
      ((active.clientX - active.initialX) / bounds.width) *
      (active.upper - active.lower);
    update(active.boundary, active.initialValue + change);
  };
  const pointerDown = (
    event: PointerEvent<HTMLButtonElement>,
    boundary: Boundary
  ) => {
    if (disabled || event.button !== 0 || !rail.current) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      boundary,
      lower,
      upper,
      element: rail.current,
      clientX: event.clientX,
      initialX: event.clientX,
      initialValue:
        parseClipTime(latest.current.draft[boundary]) ??
        (boundary === 'start' ? lower : upper),
      moved: false,
    };
  };
  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current.clientX = event.clientX;
    if (event.clientX !== drag.current.initialX) drag.current.moved = true;
    if (!drag.current.moved) return;
    if (frame.current === undefined)
      frame.current = requestAnimationFrame(publishPointer);
  };
  const pointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current.clientX = event.clientX;
    if (event.clientX !== drag.current.initialX) drag.current.moved = true;
    cancelFrame();
    publishPointer();
    drag.current = undefined;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const pointerCancel = () => {
    cancelFrame();
    drag.current = undefined;
  };
  const keyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    boundary: Boundary
  ) => {
    let value =
      parseClipTime(draft[boundary]) ?? (boundary === 'start' ? lower : upper);
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') value -= 1;
    else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') value += 1;
    else if (event.key === 'Home') value = 0;
    else if (event.key === 'End') value = limit ?? upper;
    else return;
    event.preventDefault();
    update(boundary, value);
  };

  return (
    <section className="clip-range" aria-label="Clip boundary adjustment">
      <div className="trim-labels">
        <h3>
          Clip range
          {!error && start !== null && end !== null && (
            <span className="mono"> · {formatClipTime(end - start)}</span>
          )}
        </h3>
        <span className="trim-legend" aria-hidden="true">
          <i className="saved-key" /> Saved <i className="draft-key" /> Draft
        </span>
      </div>
      <div ref={rail} className={`trim-rail ${error ? 'invalid' : ''}`}>
        {saved.startTime !== null && saved.endTime !== null && (
          <div
            className="trim-saved"
            aria-hidden="true"
            style={{
              left: `${position(saved.startTime)}%`,
              width: `${Math.max(
                0,
                position(saved.endTime) - position(saved.startTime)
              )}%`,
            }}
          />
        )}
        {start !== null && end !== null && (
          <div
            className="trim-draft"
            aria-hidden="true"
            style={{
              left: `${Math.min(position(start), position(end))}%`,
              width: `${Math.abs(position(end) - position(start))}%`,
            }}
          />
        )}
        {(['start', 'end'] as const).map((boundary) => {
          const value = boundary === 'start' ? start : end;
          const label = boundary === 'start' ? 'In' : 'Out';
          return (
            <button
              key={boundary}
              type="button"
              role="slider"
              className="trim-handle"
              data-boundary={boundary}
              aria-label={`Clip ${label} boundary`}
              aria-valuemin={0}
              aria-valuemax={limit ?? upper}
              aria-valuenow={Math.max(0, Math.min(limit ?? upper, value ?? 0))}
              aria-valuetext={
                value === null ? `Missing ${label}` : formatClipTime(value)
              }
              aria-invalid={Boolean(error)}
              aria-describedby={`${id}-help ${id}-validation`}
              aria-orientation="horizontal"
              title="Drag to adjust; Arrow keys adjust one second"
              disabled={disabled}
              style={{ left: `${position(value)}%` }}
              onPointerDown={(event) => pointerDown(event, boundary)}
              onPointerMove={pointerMove}
              onPointerUp={pointerUp}
              onPointerCancel={pointerCancel}
              onLostPointerCapture={pointerCancel}
              onKeyDown={(event) => keyDown(event, boundary)}
            >
              <span className="handle-value mono" aria-hidden="true">
                {value === null ? `Missing ${label}` : formatClipTime(value)}
              </span>
            </button>
          );
        })}
      </div>
      <div className="trim-domain mono" aria-hidden="true">
        <span>{formatClipTime(lower)}</span>
        <span>{formatClipTime(upper)}</span>
      </div>
      <span className="sr-only" id={`${id}-help`}>
        Drag boundaries or use Arrow keys to adjust one second. Home sets zero;
        End sets the maximum. Changes remain drafts until Apply to clip.
      </span>
      <span className="sr-only" id={`${id}-validation`}>
        {error}
      </span>
    </section>
  );
}

ClipRange.defaultProps = { duration: undefined };
