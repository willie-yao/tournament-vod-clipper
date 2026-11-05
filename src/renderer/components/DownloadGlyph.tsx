import { SvgIcon } from '@mui/material';

// Download icon with the arrow as its own path so it can move alone.
export default function DownloadGlyph() {
  return (
    <SvgIcon>
      <path className="download-arrow" d="M19 9h-4V3H9v6H5l7 7 7-7z" />
      <path d="M5 20h14v-2H5v2z" />
    </SvgIcon>
  );
}
