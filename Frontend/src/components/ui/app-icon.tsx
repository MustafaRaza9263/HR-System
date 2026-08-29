"use client";

import { DynamicIcon, iconNames, type IconName } from "lucide-react/dynamic";

const iconNameSet = new Set<string>(iconNames);
const legacyNames: Record<string, IconName> = {
  Building2: "building-2",
  BriefcaseBusiness: "briefcase-business",
};

export const availableIconNames = iconNames;

export function normalizeIconName(name: string, fallback: IconName): IconName {
  const legacyName = legacyNames[name];
  if (legacyName) return legacyName;
  if (iconNameSet.has(name)) return name as IconName;

  const kebabName = name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLocaleLowerCase();
  return iconNameSet.has(kebabName) ? kebabName as IconName : fallback;
}

interface AppIconProps {
  name: string;
  fallback?: IconName;
  className?: string;
}

export function AppIcon({ name, fallback = "circle", className }: AppIconProps) {
  return (
    <DynamicIcon
      aria-hidden
      className={className}
      fallback={() => <span aria-hidden className={className} />}
      name={normalizeIconName(name, fallback)}
    />
  );
}
