/**
 * Material Symbols Rounded, rendered as a ligature.
 *
 * The font is subsetted to only the names listed below — adding a new one means
 * regenerating public/fonts/material-symbols-rounded-subset.woff2. See the
 * comment above the @font-face rule in app/globals.css.
 */
export type IconName =
  | "add"
  | "arrow_back"
  | "delete"
  | "edit"
  | "logout"
  | "remove"
  | "settings";

type IconProps = {
  name: IconName;
  size?: number;
  /** Optical weight, 400–700. */
  weight?: number;
  className?: string;
};

export function Icon({ name, size = 20, weight = 600, className }: IconProps) {
  return (
    <span
      aria-hidden="true"
      className={className ? `material-symbols-rounded ${className}` : "material-symbols-rounded"}
      style={{
        fontSize: size,
        width: size,
        height: size,
        overflow: "hidden",
        fontVariationSettings: `'FILL' 0,'wght' ${weight},'GRAD' 0,'opsz' 24`,
      }}
    >
      {name}
    </span>
  );
}
