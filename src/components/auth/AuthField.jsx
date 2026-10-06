import { useId, useState } from 'react';
import { TextField, Typography, IconButton, InputAdornment } from '@mui/material';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import { useAuthColors } from './authTokens';

// Label-above text field used on the Login / Register pages. Password
// fields get a show/hide toggle; everything else (name, value, onChange,
// required, autoComplete…) is passed straight through to the MUI TextField.
export default function AuthField({ label, type = 'text', helperText, ...rest }) {
  const id = useId();
  const colors = useAuthColors();
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className="mb-5">
      <Typography
        component="label"
        htmlFor={id}
        sx={{ display: 'block', mb: 1, fontSize: 14, fontWeight: 500, color: 'text.primary' }}
      >
        {label}
      </Typography>
      <TextField
        id={id}
        fullWidth
        type={isPassword && visible ? 'text' : type}
        helperText={helperText}
        slotProps={{
          input: {
            endAdornment: isPassword ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  edge="end"
                  aria-label={visible ? 'Hide password' : 'Show password'}
                  onClick={() => setVisible((v) => !v)}
                  onMouseDown={(e) => e.preventDefault()}
                  sx={{ color: 'text.secondary' }}
                >
                  {visible ? (
                    <VisibilityOffOutlinedIcon fontSize="small" />
                  ) : (
                    <VisibilityOutlinedIcon fontSize="small" />
                  )}
                </IconButton>
              </InputAdornment>
            ) : undefined,
          },
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: '10px',
            backgroundColor: colors.inputBg,
            fontSize: 15,
            '& fieldset': { borderColor: colors.inputBorder },
            '&:hover fieldset': { borderColor: colors.inputBorder },
            '&.Mui-focused fieldset': { borderColor: colors.accent, borderWidth: 1 },
          },
          '& .MuiOutlinedInput-input': { padding: '16px 18px' },
          '& .MuiOutlinedInput-input::placeholder': { fontSize: 14, opacity: 0.7 },
          '& .MuiFormHelperText-root': { marginLeft: 0.25, fontSize: 12.5 },
        }}
        {...rest}
      />
    </div>
  );
}
