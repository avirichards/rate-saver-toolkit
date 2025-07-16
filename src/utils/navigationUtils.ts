// Navigation utilities to prevent event propagation issues

export const handleButtonClick = (
  event: React.MouseEvent,
  callback: () => void
): void => {
  event.preventDefault();
  event.stopPropagation();
  callback();
};

export const handleAsyncButtonClick = async (
  event: React.MouseEvent,
  callback: () => Promise<void>
): Promise<void> => {
  event.preventDefault();
  event.stopPropagation();
  await callback();
};

// Generate safe navigation handler for table actions
export const createTableActionHandler = (
  action: () => void | Promise<void>
) => {
  return (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (action.constructor.name === 'AsyncFunction') {
      (action as () => Promise<void>)().catch(console.error);
    } else {
      (action as () => void)();
    }
  };
};