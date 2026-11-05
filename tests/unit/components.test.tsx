// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Markdown } from '@/components/ui/Markdown';
import { CodeLines, ConfirmButton, SafeLink } from '@/components/ui';
import { ItemView } from '@/features/academy/ItemView';
import { gradeItem } from '@/domain/assessment/grade';
import type { Item } from '@/domain/curriculum/types';

afterEach(cleanup);

describe('Markdown is safe for untrusted catalog and imported content', () => {
  it('never renders raw HTML or executes script-like content', () => {
    const { container } = render(<Markdown>{'Hello <script>window.__x=1</script> <img src=x onerror="window.__y=1"> <b onclick="alert(1)">bold</b>\n\n<iframe src="https://evil.example"></iframe>'}</Markdown>);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[onclick]')).toBeNull();
    expect((window as unknown as { __x?: number }).__x).toBeUndefined();
  });

  it('drops images (no tracking pixels) and neutralises non-https links', () => {
    const { container } = render(<Markdown>{'![pixel](https://tracker.example/p.gif) [bad](javascript:alert(1)) [data](data:text/html,<b>x</b>) [http](http://insecure.example) [ok](https://example.com/docs)'}</Markdown>);
    expect(container.querySelector('img')).toBeNull();
    const links = [...container.querySelectorAll('a')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['https://example.com/docs']);
    expect(links[0]!.getAttribute('rel')).toMatch(/noopener/);
    expect(links[0]!.getAttribute('target')).toBe('_blank');
    expect(container.textContent).toContain('bad');
  });

  it('renders ordinary Markdown structure', () => {
    render(<Markdown>{'### Title\n\n- one\n- two\n\n`code`'}</Markdown>);
    expect(screen.getByRole('heading', { name: 'Title' })).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});

describe('SafeLink', () => {
  it('only links https URLs, with noopener and a screen-reader hint', () => {
    render(<><SafeLink href="https://example.com/a">good</SafeLink><SafeLink href="javascript:alert(1)">evil</SafeLink><SafeLink href="http://example.com">plain</SafeLink><SafeLink href={null}>none</SafeLink></>);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]!.getAttribute('rel')).toContain('noopener');
    expect(links[0]!.textContent).toContain('opens in a new tab');
    expect(screen.getByText('evil').tagName).toBe('SPAN');
  });
});

describe('ConfirmButton', () => {
  it('requires a second explicit click and can be cancelled', () => {
    const onConfirm = vi.fn();
    render(<ConfirmButton label="Delete" confirmLabel="Yes, delete" onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('CodeLines', () => {
  it('renders code as text (never as HTML) and exposes toggle state to assistive tech', () => {
    const onToggle = vi.fn();
    const { container } = render(<CodeLines label="sample" lines={['<img src=x onerror=alert(1)>', 'plain']} flagged={new Set([2])} onToggle={onToggle} />);
    expect(container.querySelector('img')).toBeNull();
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]!.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(buttons[0]!.getAttribute('aria-pressed')).toBe('false');
    expect(buttons[1]!.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(buttons[0]!);
    expect(onToggle).toHaveBeenCalledWith(1);
  });
});

const single: Item = {
  id: 's', kind: 'single', concept: 'mechanism-selection', prompt: 'Pick the right one', explanation: 'Because enforcement belongs in a hook.',
  options: [{ id: 'a', text: 'A Skill', why: 'Can be skipped by Claude.' }, { id: 'b', text: 'A hook', why: 'Runs every time.' }, { id: 'c', text: 'CLAUDE.md', why: 'Context, not enforcement.' }], correct: 'b',
};

describe('ItemView', () => {
  const base = { index: 0, disabled: false, hintsShown: 0, seed: 't' };
  it('reports the selected option', () => {
    const onChange = vi.fn();
    render(<ItemView {...base} item={single} value={undefined} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('A hook'));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('after grading, explains EVERY option and the underlying reason, and locks the inputs', () => {
    const grade = gradeItem(single, 'a');
    render(<ItemView {...base} item={single} value="a" onChange={() => undefined} grade={grade} disabled />);
    expect(screen.getByText('Can be skipped by Claude.')).toBeTruthy();
    expect(screen.getByText('Runs every time.')).toBeTruthy();
    expect(screen.getByText('Context, not enforcement.')).toBeTruthy();
    expect(screen.getByText(/Because enforcement belongs in a hook/)).toBeTruthy();
    expect((screen.getByLabelText('A hook') as HTMLInputElement).disabled).toBe(true);
  });

  it('shows hints one at a time and only through the provided handler', () => {
    const withHints: Item = { ...single, hints: ['first hint', 'second hint'] };
    const onHint = vi.fn();
    const { rerender } = render(<ItemView {...base} item={withHints} value={undefined} onChange={() => undefined} onHint={onHint} />);
    expect(screen.queryByText(/first hint/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Show hint \(0\/2\)/ }));
    expect(onHint).toHaveBeenCalledTimes(1);
    rerender(<ItemView {...base} item={withHints} value={undefined} onChange={() => undefined} onHint={onHint} hintsShown={1} />);
    expect(screen.getByText(/first hint/)).toBeTruthy();
    expect(screen.queryByText(/second hint/)).toBeNull();
  });

  it('assessment mode offers no hint button when no handler is passed', () => {
    render(<ItemView {...base} item={{ ...single, hints: ['x'] }} value={undefined} onChange={() => undefined} />);
    expect(screen.queryByRole('button', { name: /hint/i })).toBeNull();
  });
});
