import { InputAdornment, IconButton, TextField } from "@mui/material"
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useState } from "react";


const HiddenTextField = (label: string, helperText: string, defaultValue: string, onChange: any) => {
  const [showPassword, setShowPassword] = useState(false);
  const handleClickShowPassword = () => setShowPassword((show) => !show);

  const handleMouseDownPassword = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
  };

  return (
    <TextField
      className="textfield"
      variant="filled"
      label={label}
      defaultValue={defaultValue}
      onChange={(event) => onChange(event.target.value)}
      type={showPassword ? 'text' : 'password'}
      helperText={helperText}
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              aria-label="toggle password visibility"
              onClick={handleClickShowPassword}
              onMouseDown={handleMouseDownPassword}
              edge="end"
            >
              {showPassword ? <VisibilityOff /> : <Visibility />}
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  )
}

export default HiddenTextField
