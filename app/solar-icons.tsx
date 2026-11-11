import type { CSSProperties, HTMLAttributes } from "react";

type IconProps = HTMLAttributes<HTMLSpanElement> & { size?: number; strokeWidth?: number };

// Original SVG assets exported from Solar 1.0. CSS masks preserve their vector
// geometry and let each control supply its existing semantic foreground color.
function solarIcon(name: string) {
  return function SolarIcon({ size = 24, className = "", style, strokeWidth: _strokeWidth, ...props }: IconProps) {
    const image = `url("/assets/solar/${name}.svg")`;
    return <span {...props} aria-hidden="true" className={`solar-icon ${className}`} style={{ width: size, height: size, maskImage: image, WebkitMaskImage: image, ...style } as CSSProperties}/>;
  };
}

export const ArrowLeft = solarIcon("ArrowLeft");
export const ArrowUpRight = solarIcon("ArrowUpRight");
export const Check = solarIcon("Check");
export const ChevronDown = solarIcon("ChevronDown");
export const X = solarIcon("X");
export const Plus = solarIcon("Plus");
export const Info = solarIcon("Info");
export const Search = solarIcon("Search");
export const Trash2 = solarIcon("Trash2");
export const Upload = solarIcon("Upload");
export const Download = solarIcon("Download");
export const FileText = solarIcon("FileText");
export const LoaderCircle = solarIcon("LoaderCircle");
export const User = solarIcon("User");
export const Briefcase = solarIcon("Briefcase");
