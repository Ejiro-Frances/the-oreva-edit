'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty-state">
      <span className="eyebrow">A SMALL INTERRUPTION</span>
      <h1>Let’s try that again.</h1>
      <p>We couldn’t load this part of the edit. Your bag is still saved.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
