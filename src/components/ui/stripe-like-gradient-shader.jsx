import { GradFlow } from 'gradflow';

export const Component = () => {
  return (
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
  );
};