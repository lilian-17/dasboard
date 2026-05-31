import { useState, useEffect } from 'react';
import './DigitalClock.css';

export default function DigitalClock() {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const h = String(time.getHours()).padStart(2, '0');
  const m = String(time.getMinutes()).padStart(2, '0');

  return (
    <div className="digital-clock">
      <span className="digital-digit">{h[0]}</span>
      <span className="digital-digit">{h[1]}</span>
      <span className="digital-colon">:</span>
      <span className="digital-digit">{m[0]}</span>
      <span className="digital-digit">{m[1]}</span>
    </div>
  );
}
