import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { MenuWithPositon } from "./MenuWithPositon";

type Target = {
  data: any;
  position: {
    top: number;
    left: number;
  };
} | null;

export const ContextMenu = forwardRef((props: any, ref: any) => {
  const { itemsGenerator } = props;
  const [items, setItems] = useState<any>([]);
  const [isLoading, setLoading] = useState(false);
  const [target, setTarget] = useState<Target>(null);

  const position = target ? target.position : null;
  const selectedData = target ? target.data : null;

  useEffect(() => {
    // Nothing
  }, [selectedData]);

  const handleOpen = (event: MouseEvent, data: any) => {
    setTarget({
      data: data,
      position: { left: event.clientX, top: event.clientY }
    });
    if (data) {
      setItems(itemsGenerator(data));
    }
  };

  useImperativeHandle(ref, () => ({
    openContextmenu: handleOpen
  }));

  return (
    <MenuWithPositon
      isLoading={isLoading}
      menuPosition={position}
      menuItems={items}
      handleClose={() => setTarget(null)}
    />
  );
});
