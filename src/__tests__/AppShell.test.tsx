import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import AppShell from '../renderer/common/AppShell';

it.each([
  ['source', 'Source'],
  ['batch', 'Match review'],
  ['output', 'Output & YouTube'],
] as const)(
  'marks the active %s workspace without enabling an unavailable batch',
  (current, label) => {
    const { container } = render(
      <MemoryRouter>
        <AppShell current={current}>Workspace content</AppShell>
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: label })).toHaveAttribute(
      'aria-current',
      'page'
    );
    const batch = screen.getByRole('button', { name: 'Match review' });
    expect(batch).toHaveProperty('disabled', current !== 'batch');
    expect(screen.getByText('Workspace content')).toBeVisible();
    expect(screen.queryByText('Cutroom')).not.toBeInTheDocument();
    expect(screen.getByText('Tournament VOD Clipper')).toBeVisible();
    const backdrop = container.querySelector('.source-backdrop');
    expect(container.querySelectorAll('.source-splices')).toHaveLength(
      current === 'source' ? 1 : 0
    );
    expect(backdrop?.getAttribute('aria-hidden')).toBe(
      current === 'source' ? 'true' : undefined
    );
  }
);

it('preserves both real navigation destinations', () => {
  function Workspace() {
    const { pathname } = useLocation();
    return (
      <AppShell current={pathname === '/' ? 'source' : 'output'}>
        <output aria-label="Current path">{pathname}</output>
      </AppShell>
    );
  }
  render(
    <MemoryRouter>
      <Workspace />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Output & YouTube' }));
  expect(screen.getByLabelText('Current path')).toHaveTextContent(
    '/YTUploadView'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Source' }));
  expect(screen.getByLabelText('Current path')).toHaveTextContent(/^\/$/);
});

it('locks all navigation without hiding the current workspace', () => {
  render(
    <MemoryRouter>
      <AppShell current="batch" locked>
        Batch content
      </AppShell>
    </MemoryRouter>
  );
  screen
    .getAllByRole('button')
    .forEach((button) => expect(button).toBeDisabled());
  expect(screen.getByRole('button', { name: 'Match review' })).toHaveAttribute(
    'aria-current',
    'page'
  );
  expect(screen.getByText('Batch content')).toBeVisible();
});
