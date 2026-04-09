import type { CSSProperties } from "react";

type VoteIconProps = {
  size?: number;
  style?: CSSProperties;
};

export function VoteIcon({ size = 24, style }: VoteIconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 512 512"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      <g transform="rotate(22 256 256)">
        <rect
          height="336"
          rx="16"
          stroke="currentColor"
          strokeWidth="56"
          width="336"
          x="88"
          y="88"
        />
      </g>
      <path
        d="M177.5 265.5L210.5 348L347.5 292L314 210L244 238.5L215.5 167L178.5 182L206.5 252.5L177.5 265.5Z"
        fill="currentColor"
      />
      <path d="M250 341L370 388L279 426L250 341Z" fill="currentColor" />
    </svg>
  );
}
