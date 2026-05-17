"use client";
import { useEffect, useRef } from "react";

export function FluidBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let fluid: any;

    (async () => {
      const WebGLFluidEnhanced = (await import("webgl-fluid-enhanced")).default;
      fluid = new WebGLFluidEnhanced(el);
      fluid.setConfig({
        transparent: true,
        colorful: true,
        colorUpdateSpeed: 8,
        colorPalette: ["#3b82f6", "#6366f1", "#8b5cf6", "#22c55e", "#0ea5e9"],
        bloom: true,
        bloomIntensity: 0.8,
        bloomThreshold: 0.4,
        sunrays: true,
        sunraysWeight: 0.8,
        densityDissipation: 1.2,
        velocityDissipation: 0.6,
        pressure: 0.7,
        curl: 25,
        splatRadius: 0.25,
        splatForce: 3000,
        shading: true,
        hover: true,
        brightness: 0.3,
        simResolution: 128,
        dyeResolution: 1024,
      });
      fluid.start();
      // ensure the canvas fills the container
      const canvas = el.querySelector("canvas");
      if (canvas) {
        canvas.style.position = "absolute";
        canvas.style.inset = "0";
        canvas.style.width = "100%";
        canvas.style.height = "100%";
      }
      // staggered initial splats for dramatic entrance
      fluid.multipleSplats(6);
      setTimeout(() => fluid?.multipleSplats(5), 400);
      setTimeout(() => fluid?.multipleSplats(4), 900);
      setTimeout(() => fluid?.multipleSplats(3), 1500);
    })();

    return () => {
      if (fluid) fluid.stop();
    };
  }, []);

  return <div ref={containerRef} className="!absolute inset-0 w-full h-full z-0" style={{ position: "absolute" }} />;
}
