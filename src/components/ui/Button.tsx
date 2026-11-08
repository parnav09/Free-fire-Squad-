import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "text" | "unstyled";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "primary-button",
  secondary: "secondary-button",
  danger: "danger-button",
  text: "text-button",
  unstyled: "",
};

/** Shared button primitive. Defaults to a non-submitting button for safe form behavior. */
export default function Button({
  variant = "unstyled",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  const classes = [variantClasses[variant], className].filter(Boolean).join(" ");
  return <button {...props} type={type} className={classes || undefined} />;
}
