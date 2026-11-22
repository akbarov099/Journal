import { useId } from "react";
import { formatPhone, normalizePhone } from "@/shared/lib/phone.js";

export default function PhoneInput({ value, onValueChange, onBlur, previousValue, "aria-describedby": describedBy, ...props }) {
  const errorId = useId();
  const invalid = normalizePhone(value) === null && value !== previousValue;

  return (
    <>
      <input
        type="tel"
        inputMode="tel"
        placeholder="+996505 333 233"
        {...props}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onBlur={(event) => {
          const formatted = formatPhone(value);
          if (typeof formatted === "string" && formatted !== value) {
            onValueChange(formatted);
          }
          onBlur?.(event);
        }}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? [describedBy, errorId].filter(Boolean).join(" ") : describedBy}
      />
      {invalid && <small id={errorId} className="phone-error">Введите 9 цифр номера Кыргызстана.</small>}
    </>
  );
}
