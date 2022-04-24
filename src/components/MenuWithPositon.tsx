import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem/MenuItem";
import RefreshIcon from "@mui/icons-material/Refresh";
import { ClickAwayListener } from "@mui/material";

export const MenuWithPositon = (props: any) => {
  const { isLoading = false, menuItems, menuPosition, handleClose } = props;

  const pos = !!menuPosition
    ? {
        top: menuPosition.top,
        left: menuPosition.left
      }
    : undefined;
  console.log("pos:", pos, menuPosition);

  // @ts-ignore
  return (
    <ClickAwayListener onClickAway={handleClose} mouseEvent={"onMouseDown"}>
      <Menu
        open={Boolean(menuPosition)}
        onClose={handleClose}
        anchorReference="anchorPosition"
        anchorPosition={pos}
        transitionDuration={0}
        disableAutoFocusItem
        className={"main-menu"}
      >
        {isLoading ? (
          <MenuItem>
            <RefreshIcon className={"loading-icon"} />
          </MenuItem>
        ) : (
          menuItems.map((item: any) => {
            if (!item.subItems || item.subItems.length === 0) {
              return item.hide ? null : (
                <MenuItem
                  key={item.id}
                  disabled={item.disabled}
                  onMouseDown={() => {
                    item.onClick && item.onClick();
                    handleClose();
                  }}
                >
                  {item.title}
                </MenuItem>
              );
            }
          })
        )}
      </Menu>
    </ClickAwayListener>
  );
};
