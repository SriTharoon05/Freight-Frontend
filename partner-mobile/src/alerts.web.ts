import type { AlertButton } from "react-native";

export const alerts = {
  alert(title: string, message = "", buttons?: AlertButton[]) {
    if (!buttons?.length) {
      window.alert(`${title}\n\n${message}`);
      return;
    }
    const action = buttons.find((button) => button.style !== "cancel");
    if (action && window.confirm(`${title}\n\n${message}`)) action.onPress?.();
  },
};
