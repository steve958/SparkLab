"use client";

import AvatarBadge, {
  AVATAR_PALETTE,
  AVATAR_ACCESSORIES,
  DEFAULT_AVATAR_COLOR,
  DEFAULT_AVATAR_ACCESSORY,
} from "./AvatarBadge";

interface AvatarBuilderProps {
  name: string;
  color: string;
  accessory: string;
  onChange: (next: { color: string; accessory: string }) => void;
}

// Two-pane picker — palette of body colors and a row of accessory icons.
// The live AvatarBadge above updates immediately as the player picks.
// Schematic-only by design (Phase 1 Q2 / Phase 2 default Q1).
export default function AvatarBuilder({
  name,
  color,
  accessory,
  onChange,
}: AvatarBuilderProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-2">
        <AvatarBadge
          profile={{ name, avatarColor: color, avatarAccessory: accessory }}
          size="xl"
        />
        <p className="text-sm text-slate-500">Your lab badge</p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Color
        </label>
        <div
          role="radiogroup"
          aria-label="Avatar color"
          className="flex flex-wrap gap-2"
        >
          {AVATAR_PALETTE.map((swatch) => {
            const selected = swatch === color;
            return (
              <button
                key={swatch}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`Color ${swatch}`}
                onClick={() => onChange({ color: swatch, accessory })}
                className={`w-10 h-10 rounded-full border-2 transition-transform touch-target ${
                  selected
                    ? "border-slate-900 scale-110"
                    : "border-white hover:scale-105"
                }`}
                style={{ backgroundColor: swatch }}
              />
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Accessory
        </label>
        <div
          role="radiogroup"
          aria-label="Avatar accessory"
          className="flex flex-wrap gap-2"
        >
          {Object.entries(AVATAR_ACCESSORIES).map(([key, Icon]) => {
            const selected = key === accessory;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`Accessory ${key}`}
                onClick={() => onChange({ color, accessory: key })}
                className={`w-11 h-11 rounded-xl border-2 flex items-center justify-center transition-colors touch-target ${
                  selected
                    ? "border-primary bg-sky-50 text-primary"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <Icon className="w-5 h-5" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { DEFAULT_AVATAR_COLOR, DEFAULT_AVATAR_ACCESSORY };
