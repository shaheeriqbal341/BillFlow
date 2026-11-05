import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, pages, total, onChange }) {
  if (pages <= 1) return null;

  return (
    <nav className="pagination-bar" aria-label="Pagination">
      <span>Page {page} of {pages} · {Number(total || 0).toLocaleString()} records</span>
      <div>
        <button type="button" className="btn btn-sm btn-outline-secondary" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
          <ChevronLeft size={15} /> Previous
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page">
          Next <ChevronRight size={15} />
        </button>
      </div>
    </nav>
  );
}
