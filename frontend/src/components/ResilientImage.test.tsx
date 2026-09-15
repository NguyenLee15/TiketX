import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResilientImage } from './ResilientImage';

describe('ResilientImage', () => {
  it('replaces a failed image with an accessible fallback', () => {
    render(<ResilientImage src="https://invalid.example/image.jpg" alt="Poster sự kiện" className="h-10 w-10" />);
    fireEvent.error(screen.getByRole('img', { name: 'Poster sự kiện' }));
    expect(screen.getByRole('img', { name: 'Poster sự kiện' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Poster sự kiện' })?.tagName).toBe('DIV');
  });
});
