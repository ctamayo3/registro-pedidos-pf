import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";
import type React from "react";

// Los mismos iconos de Font Awesome que usa pedido.html, dibujados como SVG (sin depender de la fuente web).
export const Icono: React.FC<{
  icon: IconDefinition;
  size: number;
  color?: string;
  style?: React.CSSProperties;
}> = ({ icon, size, color = "currentColor", style }) => {
  const [w, h, , , path] = icon.icon;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      style={{ height: size, width: (size * w) / h, flex: "none", display: "block", ...style }}
    >
      {(Array.isArray(path) ? path : [path]).map((d) => (
        <path key={d} d={d} fill={color} />
      ))}
    </svg>
  );
};
