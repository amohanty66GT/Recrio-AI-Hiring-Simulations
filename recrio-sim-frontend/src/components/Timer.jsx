import React, { useState, useEffect } from 'react';

const CountdownTimer = ({ initialMinutes = 30 }) => {
  const [secondsLeft, setSecondsLeft] = useState(initialMinutes * 60);

  useEffect(() => {
    if (secondsLeft === 0) return;
    const interval = setInterval(() => {
      setSecondsLeft(sec => sec - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsLeft]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div>
      <h2>
        {minutes}:{seconds.toString().padStart(2, '0')}
      </h2>
    </div>
  );
};

export default CountdownTimer;