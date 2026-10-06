import { Box, Typography } from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import { evaluatePassword } from '../../utils/passwordStrength';

// Colour of the filled segments / label for each number of filled bars.
const BAR_COLORS = {
  1: 'error.main', // Weak
  2: 'warning.main', // Fair
  3: 'success.light', // Good
  4: 'success.main', // Strong
};

// Strength meter + requirements checklist shown under a "new password" field.
//   <PasswordStrength password={form.password} />
//   `sx` overrides the outer spacing (the default suits the auth pages).
//   `twoColumns` lays the checklist out in two columns to save vertical space
//   (used on the narrow auth forms).
export default function PasswordStrength({ password, sx, twoColumns = false }) {
  const { rules, bars, label } = evaluatePassword(password);
  const activeColor = BAR_COLORS[bars] || 'text.secondary';

  return (
    <Box sx={{ mt: -1.5, mb: 2.5, ...sx }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Password strength</Typography>
        <Typography
          aria-live="polite"
          sx={{ fontSize: 13, fontWeight: 600, color: activeColor, minHeight: 20 }}
        >
          {label}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 0.75, mb: 1.5 }} aria-hidden="true">
        {[1, 2, 3, 4].map((segment) => (
          <Box
            key={segment}
            sx={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              bgcolor: segment <= bars ? activeColor : 'action.disabledBackground',
              transition: 'background-color 0.2s',
            }}
          />
        ))}
      </Box>

      <Box
        component="ul"
        sx={{
          listStyle: 'none',
          m: 0,
          p: 0,
          display: 'grid',
          gap: 0.5,
          ...(twoColumns && {
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gridTemplateRows: `repeat(${Math.ceil(rules.length / 2)}, auto)`,
            gridAutoFlow: 'column',
            columnGap: 2,
          }),
        }}
      >
        {rules.map((rule) => (
          <Box
            component="li"
            key={rule.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              fontSize: 13,
              color: rule.met ? 'success.main' : 'text.secondary',
            }}
          >
            {rule.met ? (
              <CheckRoundedIcon sx={{ fontSize: 16 }} />
            ) : (
              <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 14, opacity: 0.6, mx: '1px' }} />
            )}
            <span>
              {rule.label}
              <Box component="span" sx={{ position: 'absolute', left: -9999 }}>
                {rule.met ? ' (met)' : ' (not met)'}
              </Box>
            </span>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
