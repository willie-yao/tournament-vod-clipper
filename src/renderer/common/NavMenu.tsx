import { Menu, MenuItem, Container, Fab } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import MenuIcon from '@mui/icons-material/Menu';

const NavMenu = (currentRoute: string) => {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNav = (route: string) => {
    console.log('handleNav', route);
    navigate(route);
  };

  const menuOptions = [
    {
      name: 'Home',
      route: '/',
    },
    {
      name: 'Upload',
      route: '/YTUploadView',
    },
  ];

  return (
    <Container>
      <Fab
        onClick={handleClick}
        sx={{ position: 'fixed', left: '20px', top: '20px' }}
        color="secondary"
        size="medium"
      >
        <MenuIcon />
      </Fab>
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        {menuOptions.map((option) => (
          <MenuItem
            key={option.name}
            selected={option.route === currentRoute}
            onClick={() => handleNav(option.route)}
          >
            {option.name}
          </MenuItem>
        ))}
      </Menu>
    </Container>
  );
};

export default NavMenu;
