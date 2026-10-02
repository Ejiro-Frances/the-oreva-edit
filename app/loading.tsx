export default function Loading() {
  return (
    <div className="container" aria-label="Loading the edit" role="status">
      <div className="page-heading">
        <h2>Finding the good pieces…</h2>
      </div>
      <div className="product-grid" style={{ paddingBottom: 60 }}>
        {[1, 2, 3, 4].map((n) => (
          <div key={n}>
            <div className="skeleton skeleton-image" />
            <div className="skeleton skeleton-line" />
          </div>
        ))}
      </div>
    </div>
  );
}
