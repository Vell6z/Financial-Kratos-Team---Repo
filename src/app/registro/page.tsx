import { Suspense } from "react";
import { RegisterWizard } from "./register-wizard";

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterWizard />
    </Suspense>
  );
}
