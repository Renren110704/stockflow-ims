import { Box, Typography } from '@mui/material';
import WarehouseRoundedIcon from '@mui/icons-material/WarehouseRounded';
import {
  AUTH_BRAND_NAME,
  AUTH_DESCRIPTION,
  AUTH_HEADLINE,
  AUTH_ILLUSTRATION,
  AUTH_ILLUSTRATION_ALT,
  AUTH_ILLUSTRATION_FIT,
} from '../../config/authConfig';
import { useAuthColors } from './authTokens';

// Faint squares in the corners of the right-hand panel (top/left/size in px
// or %, opacity of the white fill). Purely decorative.
const SQUARES = [
  { top: 28, right: 24, size: 44, opacity: 0.16 },
  { top: 20, right: 84, size: 30, opacity: 0.1 },
  { top: 76, right: 56, size: 26, opacity: 0.12 },
  { top: 100, right: 20, size: 34, opacity: 0.08 },
  { bottom: 30, left: 90, size: 34, opacity: 0.12 },
  { bottom: 62, left: 44, size: 26, opacity: 0.1 },
  { bottom: 24, left: 36, size: 22, opacity: 0.16 },
  { bottom: 20, left: 138, size: 20, opacity: 0.08 },
];

// Shared shell for the Login and Register pages.
//
//   desktop (≥1024px)  form on the left, teal promo panel on the right
//   tablet (768–1023)  single column, promo panel stacked under the form
//   mobile (<768)      form only
//
// The illustration comes from src/config/authConfig.js (AUTH_ILLUSTRATION).
// You can also override it per page with the `illustration` prop.
export default function AuthLayout({
  title,
  subtitle,
  children,
  illustration = AUTH_ILLUSTRATION,
  illustrationAlt = AUTH_ILLUSTRATION_ALT,
  illustrationFit = AUTH_ILLUSTRATION_FIT,
  headline = AUTH_HEADLINE,
  description = AUTH_DESCRIPTION,
}) {
  const colors = useAuthColors();

  return (
    <Box className="flex min-h-screen flex-col lg:flex-row" sx={{ bgcolor: 'background.paper' }}>
      {/* ── Left: form ───────────────────────────────────────────── */}
      <section className="flex flex-1 flex-col px-6 py-5 sm:px-10 lg:px-16 lg:py-6">
        <div className="flex items-center gap-2.5">
          <Box
            className="flex h-9 w-9 items-center justify-center"
            sx={{ bgcolor: colors.panel, borderRadius: '10px' }}
          >
            <WarehouseRoundedIcon sx={{ color: '#fff', fontSize: 20 }} />
          </Box>
          <Typography sx={{ fontSize: 17, fontWeight: 700, letterSpacing: 0.3, color: 'text.primary' }}>
            {AUTH_BRAND_NAME}
          </Typography>
        </div>

        <div className="flex flex-1 items-center justify-center py-4">
          <div className="w-full max-w-[440px]">
            <Typography component="h1" sx={{ fontSize: 24, fontWeight: 500, color: 'text.primary' }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography sx={{ mt: 0.75, fontSize: 13, color: 'text.secondary' }}>{subtitle}</Typography>
            )}
            <div className="mt-5">{children}</div>
          </div>
        </div>
      </section>

      {/* ── Right: promo panel (hidden on phones) ───────────────── */}
      <aside
        className="relative hidden flex-none items-center justify-center overflow-hidden px-8 py-14 md:flex lg:flex-1"
        style={{ backgroundColor: colors.panel }}
      >
        {SQUARES.map((s, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="absolute rounded-[4px] bg-white"
            style={{
              top: s.top,
              right: s.right,
              bottom: s.bottom,
              left: s.left,
              width: s.size,
              height: s.size,
              opacity: s.opacity,
            }}
          />
        ))}

        <div className="relative z-10 flex w-full max-w-[520px] flex-col items-center text-center">
          {/* Fixed-ratio frame: any replacement image is fitted into this box
              (object-fit from AUTH_ILLUSTRATION_FIT), so layout never shifts. */}
          <div className="w-full" style={{ aspectRatio: '26 / 17' }}>
            <img
              src={illustration}
              alt={illustrationAlt}
              className="block h-full w-full"
              style={{ objectFit: illustrationFit }}
            />
          </div>

          <Typography component="h2" sx={{ mt: 5, fontSize: 18, fontWeight: 500, color: '#fff' }}>
            {headline}
          </Typography>
          <Typography
            sx={{ mt: 1.25, maxWidth: 380, fontSize: 12.5, lineHeight: 1.7, color: 'rgba(255,255,255,0.75)' }}
          >
            {description}
          </Typography>
        </div>
      </aside>
    </Box>
  );
}
