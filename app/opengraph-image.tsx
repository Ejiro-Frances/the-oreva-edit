import { ImageResponse } from 'next/og';
export const alt = 'The Oreva Edit — Good pieces. Real life.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#eee9e1',
        color: '#62283a',
      }}
    >
      <div style={{ fontSize: 24, letterSpacing: 8 }}>THE OREVA EDIT</div>
      <div style={{ fontSize: 85, marginTop: 50, fontFamily: 'serif' }}>
        Good pieces. Real life.
      </div>
      <div style={{ fontSize: 22, marginTop: 35 }}>Wear it your way.</div>
    </div>,
    size,
  );
}
