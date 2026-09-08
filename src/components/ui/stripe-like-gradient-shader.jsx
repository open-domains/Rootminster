import { GradFlow } from 'gradflow';
import { Component as ReactComponent } from 'react';

function GradientFallback() {
  return (
    <div
      aria-hidden="true"
      className="h-full w-full bg-[radial-gradient(circle_at_20%_20%,rgba(66,255,233,0.16),transparent_38%),radial-gradient(circle_at_80%_30%,rgba(129,6,190,0.2),transparent_42%)]"
    />
  );
}

class GradientErrorBoundary extends ReactComponent {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.warn('Animated gradient unavailable; using static fallback', error);
  }

  render() {
    return this.state.failed ? <GradientFallback /> : this.props.children;
  }
}

export const Component = () => {
  return (
    <GradientErrorBoundary>
      <div className="relative h-screen w-full">
        <GradFlow config={{
          color1: { r: 255, g: 255, b: 255 },
          color2: { r: 66, g: 255, b: 233 },
          color3: { r: 129, g: 6, b: 190 },
          speed: 0.4,
          scale: 1,
          type: 'stripe',
          noise: 0.08
        }} />
      </div>
    </GradientErrorBoundary>
  );
};
