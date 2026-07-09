import Svg, { Path, Circle, Rect, Line, Polyline, G } from "react-native-svg";

// Feather-style line icons, hand-matched to the web SPA's icon set. One tiny wrapper so every icon
// takes the same (size, color, strokeWidth) props and renders crisply on native + web.
function Icon({
  size = 22,
  color = "#fff",
  strokeWidth = 2,
  children,
  viewBox = "0 0 24 24",
  fill = "none",
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill={fill}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

export const PencilIcon = (p) => (
  <Icon {...p}>
    <Path d="M12 20h9" />
    <Path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </Icon>
);

export const EyeIcon = (p) => (
  <Icon {...p}>
    <Path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
    <Circle cx="12" cy="12" r="3" />
  </Icon>
);

export const GearIcon = (p) => (
  <Icon {...p}>
    <Circle cx="12" cy="12" r="3" />
    <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </Icon>
);

export const WandIcon = (p) => (
  <Icon {...p}>
    <Path d="M15 4V2M15 10V8M9.5 4.5 8 3M20.5 4.5 22 3M15 7l-11 11 2 2L17 9" />
    <Path d="M18 12l1 2 2 1-2 1-1 2-1-2-2-1 2-1Z" fill={p.color || "#fff"} stroke="none" />
  </Icon>
);

export const TagIcon = (p) => (
  <Icon {...p}>
    <Path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" />
    <Line x1="7" y1="7" x2="7.01" y2="7" />
  </Icon>
);

export const BracketsIcon = (p) => (
  <Icon {...p} strokeWidth={p.strokeWidth || 2.4}>
    <Path d="M8 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h3" />
    <Path d="M16 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3" />
  </Icon>
);

export const ShareIcon = (p) => (
  <Icon {...p}>
    <Circle cx="18" cy="5" r="3" />
    <Circle cx="6" cy="12" r="3" />
    <Circle cx="18" cy="19" r="3" />
    <Line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
    <Line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
  </Icon>
);

export const ShuffleIcon = (p) => (
  <Icon {...p}>
    <Polyline points="16 3 21 3 21 8" />
    <Line x1="4" y1="20" x2="21" y2="3" />
    <Polyline points="21 16 21 21 16 21" />
    <Line x1="15" y1="15" x2="21" y2="21" />
    <Line x1="4" y1="4" x2="9" y2="9" />
  </Icon>
);

export const SparkleIcon = (p) => (
  <Icon {...p} fill={p.color || "#fff"} strokeWidth={0}>
    <Path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9Z" />
    <Path d="M19 3l.7 2.3L22 6l-2.3.7L19 9l-.7-2.3L16 6l2.3-.7Z" />
  </Icon>
);

export const GridIcon = (p) => (
  <Icon {...p} strokeWidth={p.strokeWidth || 2.2}>
    <Rect x="3" y="3" width="7" height="7" rx="1.5" />
    <Rect x="14" y="3" width="7" height="7" rx="1.5" />
    <Rect x="3" y="14" width="7" height="7" rx="1.5" />
    <Rect x="14" y="14" width="7" height="7" rx="1.5" />
  </Icon>
);

export const MoreIcon = (p) => (
  <Icon {...p} fill={p.color || "#fff"} strokeWidth={0}>
    <Circle cx="5" cy="12" r="1.9" />
    <Circle cx="12" cy="12" r="1.9" />
    <Circle cx="19" cy="12" r="1.9" />
  </Icon>
);

export const ChevronDownIcon = (p) => (
  <Icon {...p} strokeWidth={p.strokeWidth || 2.4}>
    <Polyline points="6 9 12 15 18 9" />
  </Icon>
);

export const CheckIcon = (p) => (
  <Icon {...p} strokeWidth={p.strokeWidth || 2.6}>
    <Polyline points="20 6 9 17 4 12" />
  </Icon>
);

// --- Overflow / links-menu icons (Feather) ---

export const GitHubIcon = (p) => (
  <Icon {...p}>
    <Path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
  </Icon>
);

export const BookIcon = (p) => (
  <Icon {...p}>
    <Path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <Path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </Icon>
);

export const HomeIcon = (p) => (
  <Icon {...p}>
    <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <Path d="M9 22V12h6v10" />
  </Icon>
);

export const DownloadIcon = (p) => (
  <Icon {...p}>
    <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <Polyline points="7 10 12 15 17 10" />
    <Line x1="12" y1="15" x2="12" y2="3" />
  </Icon>
);

export const ServerIcon = (p) => (
  <Icon {...p}>
    <Rect x="2" y="2" width="20" height="8" rx="2" />
    <Rect x="2" y="14" width="20" height="8" rx="2" />
    <Line x1="6" y1="6" x2="6.01" y2="6" />
    <Line x1="6" y1="18" x2="6.01" y2="18" />
  </Icon>
);

export const ShieldIcon = (p) => (
  <Icon {...p}>
    <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </Icon>
);

export const FileTextIcon = (p) => (
  <Icon {...p}>
    <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <Polyline points="14 2 14 8 20 8" />
    <Line x1="8" y1="13" x2="16" y2="13" />
    <Line x1="8" y1="17" x2="16" y2="17" />
    <Line x1="8" y1="9" x2="10" y2="9" />
  </Icon>
);

export const CookieIcon = (p) => (
  <Icon {...p}>
    <Path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5z" />
    <Line x1="8.5" y1="8.5" x2="8.51" y2="8.5" />
    <Line x1="15" y1="9" x2="15.01" y2="9" />
    <Line x1="8" y1="14" x2="8.01" y2="14" />
    <Line x1="13" y1="15" x2="13.01" y2="15" />
    <Line x1="16" y1="14" x2="16.01" y2="14" />
  </Icon>
);

export const ExternalLinkIcon = (p) => (
  <Icon {...p}>
    <Path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <Polyline points="15 3 21 3 21 9" />
    <Line x1="10" y1="14" x2="21" y2="3" />
  </Icon>
);

// --- Appearance (theme mode) icons ---

export const MonitorIcon = (p) => (
  <Icon {...p}>
    <Rect x="2" y="3" width="20" height="14" rx="2" />
    <Line x1="8" y1="21" x2="16" y2="21" />
    <Line x1="12" y1="17" x2="12" y2="21" />
  </Icon>
);

export const MoonIcon = (p) => (
  <Icon {...p}>
    <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </Icon>
);

export const SunIcon = (p) => (
  <Icon {...p}>
    <Circle cx="12" cy="12" r="5" />
    <Line x1="12" y1="1" x2="12" y2="3" />
    <Line x1="12" y1="21" x2="12" y2="23" />
    <Line x1="4.2" y1="4.2" x2="5.6" y2="5.6" />
    <Line x1="18.4" y1="18.4" x2="19.8" y2="19.8" />
    <Line x1="1" y1="12" x2="3" y2="12" />
    <Line x1="21" y1="12" x2="23" y2="12" />
    <Line x1="4.2" y1="19.8" x2="5.6" y2="18.4" />
    <Line x1="18.4" y1="5.6" x2="19.8" y2="4.2" />
  </Icon>
);
