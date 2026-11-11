import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PhotoUpload } from './PhotoUpload';

describe('PhotoUpload', () => {
  it('loads the stored photo from the API origin (the API returns a relative /files path)', () => {
    render(<PhotoUpload photoUrl="/files/menu/plov.jpg" file={null} onFileChange={() => undefined} />);
    expect(screen.getByRole('img', { name: 'Фото блюда' })).toHaveAttribute('src', 'http://api.test/files/menu/plov.jpg');
  });

  it('shows the placeholder when the item has no photo', () => {
    render(<PhotoUpload photoUrl={null} file={null} onFileChange={() => undefined} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
