import { useRef, useState } from 'react';

import { createSingleFlight } from './singleFlight';

// Every button that calls auth uses this: pass `running` to GradientButton or
// AuthLink, which disable themselves and show the spinner.
export function useSingleFlight() {
  const [running, setRunning] = useState(false);
  const flight = useRef(createSingleFlight(setRunning));
  return { running, run: flight.current.run };
}
